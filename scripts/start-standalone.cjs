#!/usr/bin/env node
/**
 * SolarAdvisor — Railway startup script
 * 1. Forces 0.0.0.0 bind (Railway sets HOSTNAME to container ID which breaks healthchecks)
 * 2. Starts Next.js immediately so Railway healthcheck passes
 * 3. Runs migrate.sql in background — CREATE TABLE IF NOT EXISTS, safe every deploy
 */
const path  = require("path");
const { spawn } = require("child_process");

const root   = path.resolve(__dirname, "..");
const server = path.join(root, ".next", "standalone", "server.js");

// Force all-interfaces bind
process.env.HOSTNAME = "0.0.0.0";
process.env.HOST     = "0.0.0.0";

function logDbEnv() {
  // All var names Railway MySQL plugin may inject
  const DB_VARS = [
    "MYSQL_URL","MYSQLPRIVATE_URL","MYSQL_PUBLIC_URL","DATABASE_URL",
    "MYSQL_HOST","MYSQLHOST","RAILWAY_PRIVATE_DOMAIN",
    "MYSQL_PORT","MYSQLPORT",
    "MYSQL_USER","MYSQLUSER",
    "MYSQL_PASSWORD","MYSQLPASSWORD","MYSQL_ROOT_PASSWORD",
    "MYSQL_DATABASE","MYSQLDATABASE",
  ];
  const found = DB_VARS.filter(v => process.env[v]);
  if (!found.length) {
    console.log("[start] ⚠️  No MySQL env vars found — link the MySQL plugin on Railway.");
    return false;
  }
  console.log("[start] DB vars present:", found.join(", "));
  if (process.env.MYSQL_URL) {
    console.log("[start] MYSQL_URL →", process.env.MYSQL_URL.replace(/:([^:@]+)@/, ":***@"));
  }
  return true;
}

function runMigrate() {
  if (process.env.SKIP_DB_MIGRATE === "1") {
    console.log("[start] SKIP_DB_MIGRATE=1 — skipping.");
    return;
  }
  const hasDb = logDbEnv();
  if (!hasDb) return;

  const script = path.join(root, "scripts", "apply-migrate.mjs");
  console.log("[start] Launching migrate.sql in background…");

  const m = spawn(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, STARTUP_MIGRATE: "1" },
    stdio: "inherit",
  });
  m.on("exit",  code => console.log(code === 0 ? "[start] ✅ Migration done." : `[start] ❌ Migration exited ${code}.`));
  m.on("error", err  => console.error("[start] Failed to spawn migrate:", err.message));
}

// Start Next.js immediately — healthcheck must pass before migration finishes
const child = spawn(process.execPath, [server], {
  cwd: root, env: process.env, stdio: "inherit"
});

// Give MySQL 4s to be ready, then migrate
setTimeout(runMigrate, 4000);

child.on("exit",  (code, sig) => { if (sig) process.kill(process.pid, sig); process.exit(code ?? 1); });
child.on("error", err => { console.error("[start] Server error:", err.message); process.exit(1); });
