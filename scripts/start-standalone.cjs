#!/usr/bin/env node
/**
 * SolarAdvisor startup script for Railway / standalone Next.js
 *
 * 1. Forces 0.0.0.0 bind so Railway healthchecks can reach the port
 * 2. Starts Next.js standalone server immediately (healthcheck passes fast)
 * 3. Runs migrate.sql in background after a short delay
 *    — CREATE TABLE IF NOT EXISTS is idempotent, safe to run every deploy
 */
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const server = path.join(root, ".next", "standalone", "server.js");

// Force 0.0.0.0 — Railway sets HOSTNAME to container ID which blocks external connections
process.env.HOSTNAME = "0.0.0.0";
process.env.HOST = "0.0.0.0";

// Log all Railway MySQL env vars found (masked) to help diagnose connection issues
function logDbEnv() {
  const vars = [
    "MYSQL_URL", "MYSQLPRIVATE_URL", "DATABASE_URL",
    "MYSQL_HOST", "MYSQLHOST",
    "MYSQL_PORT", "MYSQLPORT",
    "MYSQL_USER", "MYSQLUSER",
    "MYSQL_DATABASE", "MYSQLDATABASE",
  ];
  const found = vars.filter((v) => process.env[v]);
  if (found.length === 0) {
    console.log("[start] ⚠️  No MySQL env vars found. Link the MySQL plugin on Railway.");
    return false;
  }
  console.log("[start] DB env vars present:", found.join(", "));
  // Mask password
  if (process.env.MYSQL_URL) {
    console.log("[start] MYSQL_URL:", process.env.MYSQL_URL.replace(/:([^:@]+)@/, ":***@"));
  }
  return true;
}

function runMigrate() {
  if (process.env.SKIP_DB_MIGRATE === "1") {
    console.log("[start] SKIP_DB_MIGRATE=1 — skipping migration.");
    return;
  }

  const hasDb = logDbEnv();
  if (!hasDb) return;

  const script = path.join(root, "scripts", "apply-migrate.mjs");
  console.log("[start] Running migrate.sql in background …");

  const m = spawn(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, STARTUP_MIGRATE: "1" },
    stdio: "inherit",
  });

  m.on("exit", (code) => {
    if (code !== 0) {
      console.error(`[start] ❌ Migration failed (exit ${code}). Check logs above.`);
    } else {
      console.log("[start] ✓ Migration complete — all tables ready.");
    }
  });

  m.on("error", (err) => {
    console.error("[start] Failed to spawn migrate script:", err.message);
  });
}

// Start Next.js server immediately so Railway healthcheck passes
const child = spawn(process.execPath, [server], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

// Run migration after 3 seconds — gives Railway MySQL time to accept connections
// and lets Next.js bind to PORT first so healthcheck passes
setTimeout(runMigrate, 3000);

child.on("exit", (code, signal) => {
  if (signal) { process.kill(process.pid, signal); }
  process.exit(code == null ? 1 : code);
});

child.on("error", (err) => {
  console.error("[start] Failed to start Next.js server:", err.message);
  process.exit(1);
});
