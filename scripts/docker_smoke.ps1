$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed or not available in PATH."
}

docker compose version | Out-Null

if (-not $env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD = "artinazma_smoke_password" }
if (-not $env:DOMAIN) { $env:DOMAIN = "localhost" }
if (-not $env:CERTBOT_EMAIL) { $env:CERTBOT_EMAIL = "admin@example.com" }

$backendEnv = Join-Path $Root "backend\.env"
$createdBackendEnv = $false
if (-not (Test-Path $backendEnv)) {
    $createdBackendEnv = $true
    @"
OPENAI_API_KEY=sk-docker-smoke-placeholder
ADMIN_API_KEY=docker-smoke-admin-key
JWT_SECRET=docker-smoke-jwt-secret
OPENAI_MODEL=gpt-5.4
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
FRONTEND_ORIGINS=http://localhost,http://127.0.0.1
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=
"@ | Set-Content -Path $backendEnv -Encoding UTF8
}

function Invoke-Cleanup {
    docker compose down --remove-orphans
    if ($createdBackendEnv -and (Test-Path $backendEnv)) {
        Remove-Item -LiteralPath $backendEnv -Force
    }
}

function Wait-ContainerHealth {
    param(
        [Parameter(Mandatory = $true)][string]$Container,
        [Parameter(Mandatory = $true)][string]$Service,
        [int]$Attempts = 60
    )

    for ($i = 0; $i -lt $Attempts; $i++) {
        $status = docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" $Container 2>$null
        if ($status -eq "healthy" -or $status -eq "running") {
            Write-Host "$Service is $status"
            return
        }
        Start-Sleep -Seconds 3
    }

    docker compose ps
    docker compose logs --tail=120 $Service
    throw "$Service did not become healthy in time."
}

try {
    Write-Host "Validating docker-compose.yml..."
    docker compose config | Out-Null

    Write-Host "Building backend and frontend images..."
    docker compose build backend frontend

    Write-Host "Starting core services..."
    docker compose up -d postgres redis qdrant backend frontend

    Wait-ContainerHealth artin_postgres postgres
    Wait-ContainerHealth artin_redis redis
    Wait-ContainerHealth artin_qdrant qdrant
    Wait-ContainerHealth artin_backend backend
    Wait-ContainerHealth artin_frontend frontend

    Write-Host "Checking backend health endpoint..."
    docker compose exec -T backend curl -fsS http://localhost:8000/health | Out-Null

    Write-Host "Checking frontend HTTP response..."
    docker compose exec -T frontend node -e "fetch('http://localhost:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

    Write-Host "Checking migrated database schema..."
    docker compose exec -T backend python -c "from db_service import get_connection; c=get_connection(); c.execute('SELECT COUNT(*) FROM expert_questions').fetchone(); c.close()"

    Write-Host "Docker smoke test passed."
}
finally {
    Invoke-Cleanup
}
