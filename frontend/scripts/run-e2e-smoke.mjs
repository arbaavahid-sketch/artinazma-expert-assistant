import http from "node:http";
import { spawn } from "node:child_process";

const port = process.env.PLAYWRIGHT_PORT || "3001";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const isWindows = process.platform === "win32";

function spawnCommand(commandLine, options) {
  if (isWindows) {
    return spawn(commandLine, [], { ...options, shell: true });
  }

  const [cmd, ...args] = commandLine.split(" ");
  return spawn(cmd, args, options);
}

function waitForServer(url, timeoutMs = 120_000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(check, 750);
      });

      req.setTimeout(2_000, () => {
        req.destroy();
      });
    };

    check();
  });
}

function killProcessTree(child) {
  if (!child.pid) return;
  if (isWindows) {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
}

const server = spawnCommand(
  `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:8000",
    },
  },
);

let exitCode = 1;

try {
  await waitForServer(baseURL);
  const tests = spawnCommand("npx playwright test --workers=1", {
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: baseURL,
      PLAYWRIGHT_SKIP_WEBSERVER: "1",
    },
  });

  exitCode = await new Promise((resolve) => {
    tests.on("exit", (code) => resolve(code ?? 1));
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  killProcessTree(server);
}

process.exit(exitCode);
