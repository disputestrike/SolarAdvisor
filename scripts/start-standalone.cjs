#!/usr/bin/env node
/**
 * SolarAdvisor — Railway startup script
 * 1. Copies public/ and static assets into .next/standalone (required for standalone output)
 * 2. Forces 0.0.0.0 bind so Railway healthchecks reach the port
 * 3. Starts Next.js immediately — healthcheck passes fast
 * 4. Runs migrate.sql in background after 4s — CREATE TABLE IF NOT EXISTS, safe every deploy
 */
const path  = require("path");
const fs    = require("fs");
const { spawn, execSync } = require("child_process");

const root   = path.resolve(__dirname, "..");
const server = path.join(root, ".next", "standalone", "server.js");

// ─── Copy public assets into standalone build ────────────────────────────────
// Next.js standalone output does NOT auto-copy public/ or .next/static/
// Without this, /sunshot-powered.png and all static assets return 404.
function copyAssets() {
  try {
    const standaloneDir = path.join(root, ".next", "standalone");
    const publicSrc  = path.join(root, "public");
    const publicDst  = path.join(standaloneDir, "public");
    const staticSrc  = path.join(root, ".next", "static");
    const staticDst  = path.join(standaloneDir, ".next", "static");

    if (fs.existsSync(publicSrc) && !fs.existsSync(publicDst)) {
      execSync(`cp -r "${publicSrc}" "${publicDst}"`);
      console.log("[start] ✓ Copied public/ into standalone");
    }
    if (fs.existsSync(staticSrc) && !fs.existsSync(staticDst)) {
      execSync(`cp -r "${staticSrc}" "${staticDst}"`);
      console.log("[start] ✓ Copied .next/static/ into standalone");
    }
  } catch (e) {
    console.error("[start] Asset copy failed (non-fatal):", e.message);
  }
}

// ─── Force 0.0.0.0 bind ──────────────────────────────────────────────────────
process.env.HOSTNAME = "0.0.0.0";
process.env.HOST     = "0.0.0.0";

// ─── Log DB env vars ─────────────────────────────────────────────────────────
function logDbEnv() {
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
    console.log("[start] ⚠️  No MySQL env vars — link MySQL plugin on Railway.");
    return false;
  }
  console.log("[start] DB vars present:", found.join(", "));
  if (process.env.MYSQL_URL) {
    console.log("[start] MYSQL_URL →", process.env.MYSQL_URL.replace(/:([^:@]+)@/, ":***@"));
  }
  return true;
}

// ─── Run migration in background ─────────────────────────────────────────────
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

// ─── Boot sequence ────────────────────────────────────────────────────────────
copyAssets();

const child = spawn(process.execPath, [server], {
  cwd: root, env: process.env, stdio: "inherit"
});

// Give MySQL 4s to be ready, then migrate
setTimeout(runMigrate, 4000);

child.on("exit",  (code, sig) => { if (sig) process.kill(process.pid, sig); process.exit(code ?? 1); });
child.on("error", err => { console.error("[start] Server error:", err.message); process.exit(1); });
