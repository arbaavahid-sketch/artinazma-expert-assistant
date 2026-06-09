#!/usr/bin/env node
/**
 * Gating npm-audit check.
 *
 * Runs `npm audit --json` and fails (exit 1) if there is any high or critical
 * advisory that is NOT listed in frontend/security-audit-ignore.txt. This turns
 * npm audit from informational into a real gate, while still allowing the team
 * to triage and accept individual advisories.
 *
 * An allowlist line may be a GHSA id, a numeric advisory "source" id, or a
 * package name. Usage: `node scripts/check-npm-audit.mjs [--level=high]`.
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = join(__dirname, "..");
const ALLOWLIST_FILE = join(FRONTEND_DIR, "security-audit-ignore.txt");

const levelArg = process.argv.find((a) => a.startsWith("--level="));
const MIN_LEVEL = levelArg ? levelArg.split("=")[1] : "high";
const SEVERITY_ORDER = ["info", "low", "moderate", "high", "critical"];
const minIdx = SEVERITY_ORDER.indexOf(MIN_LEVEL);

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_FILE)) return new Set();
  const ids = readFileSync(ALLOWLIST_FILE, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(/\s+/)[0].toLowerCase());
  return new Set(ids);
}

function runAudit() {
  // npm audit exits non-zero when vulnerabilities exist; capture stdout anyway.
  try {
    return execSync("npm audit --json", {
      cwd: FRONTEND_DIR,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch (err) {
    if (err.stdout) return err.stdout;
    throw err;
  }
}

function identifiersFor(pkgName, node) {
  const ids = new Set([pkgName.toLowerCase()]);
  for (const via of node.via || []) {
    if (typeof via === "object" && via) {
      if (via.source != null) ids.add(String(via.source).toLowerCase());
      if (via.url) {
        const m = String(via.url).match(/GHSA-[0-9a-z-]+/i);
        if (m) ids.add(m[0].toLowerCase());
      }
    } else if (typeof via === "string") {
      ids.add(via.toLowerCase());
    }
  }
  return ids;
}

function main() {
  const allow = loadAllowlist();
  let report;
  try {
    report = JSON.parse(runAudit());
  } catch (e) {
    console.error("Could not parse `npm audit --json` output:", e.message);
    process.exit(2);
  }

  const vulns = report.vulnerabilities || {};
  const blocking = [];
  const suppressed = [];

  for (const [pkg, node] of Object.entries(vulns)) {
    const severity = node.severity || "info";
    if (SEVERITY_ORDER.indexOf(severity) < minIdx) continue;
    const ids = identifiersFor(pkg, node);
    const isAllowed = [...ids].some((id) => allow.has(id));
    (isAllowed ? suppressed : blocking).push({ pkg, severity });
  }

  if (suppressed.length) {
    console.log(`Suppressed (allow-listed) advisories: ${suppressed.length}`);
    for (const s of suppressed) console.log(`  - ${s.pkg} (${s.severity}) [allow-listed]`);
  }

  if (blocking.length === 0) {
    console.log(`npm audit: no un-allow-listed advisories at level >= ${MIN_LEVEL}. OK`);
    process.exit(0);
  }

  console.error(`\nnpm audit FAILED: ${blocking.length} advisory(ies) at level >= ${MIN_LEVEL}:`);
  for (const b of blocking) console.error(`  - ${b.pkg} (${b.severity})`);
  console.error(
    "\nFix by upgrading the dependency (preferred), or — after triage — add the " +
      "advisory id / package name to frontend/security-audit-ignore.txt."
  );
  process.exit(1);
}

main();
