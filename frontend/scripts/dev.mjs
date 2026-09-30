import { spawn } from "node:child_process";

/**
 * Behind a local proxy (the usual setup here), `curl` honours HTTP(S)_PROXY
 * but Node's fetch does not — so calls that leave the machine (OpenAI, Google)
 * time out. Node only reads NODE_USE_ENV_PROXY at start-up, too late for
 * .env.local, so the dev server is spawned with it. Nothing changes where no
 * proxy variables exist.
 */
const env = { ...process.env };
const proxied =
  env.HTTPS_PROXY || env.HTTP_PROXY || env.https_proxy || env.http_proxy;
if (proxied && !env.NODE_USE_ENV_PROXY) env.NODE_USE_ENV_PROXY = "1";

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", ...process.argv.slice(2)],
  { stdio: "inherit", env },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
