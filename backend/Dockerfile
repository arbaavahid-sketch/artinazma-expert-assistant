FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create required directories and non-root user
RUN mkdir -p storage uploads knowledge_files \
    && addgroup --system appuser \
    && adduser --system --ingroup appuser appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# --proxy-headers + --forwarded-allow-ips: trust X-Forwarded-For/X-Real-IP from nginx
# so request.client.host is the real client IP (required for per-IP rate limiting and
# brute-force lockout). Safe here because only nginx reaches the backend on the internal network.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
