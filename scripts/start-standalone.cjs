#!/usr/bin/env node
/**
 * Next standalone uses process.env.HOSTNAME for the bind address.
 * Railway/Docker set HOSTNAME to the container hostname (e.g. ffc3bd32d8b0),
 * so the server does not listen on 0.0.0.0 and platform healthchecks fail.
 * Force IPv4 all-interfaces bind before starting the standalone server.
 */
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const server = path.join(root, ".next", "standalone", "server.js");

process.env.HOSTNAME = "0.0.0.0";

function runMigrateIfConfigured() {
  if (process.env.SKIP_DB_MIGRATE === "1" || process.env.SKIP_DB_MIGRATE === "true") {
    console.log("[start] SKIP_DB_MIGRATE set — skipping migrate.sql");
    return;
  }
  const hasDb =
    process.env.DATABASE_URL ||
    process.env.MYSQL_URL ||
    process.env.MYSQLPRIVATE_URL ||
    process.env.MYSQL_HOST ||
    process.env.MYSQLHOST;
  if (!hasDb) {
    console.log(
      "[start] No DATABASE_URL / MYSQL_URL / MYSQL_HOST — skipping migrate.sql (link MySQL on Railway or set variables)."
    );
    return;
  }
  const script = path.join(root, "scripts", "apply-migrate.mjs");
  console.log("[start] Running migrate.sql …");
  const r = spawnSync(process.execPath, [script], {
    cwd: root,
    env: {
      ...process.env,
      // Shorter retries + connect timeout inside apply-migrate.mjs — don’t block deploy for minutes
      STARTUP_MIGRATE: "1",
    },
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error(
      "[start] migrate.sql did not complete (DB unreachable or wrong credentials). Starting the app anyway so healthchecks pass."
    );
    console.error(
      "[start] Fix: link MySQL to this service on Railway, use the private DATABASE_URL, or run migrate from Railway shell. Optional: SKIP_DB_MIGRATE=1. Strict fail: MIGRATE_EXIT_ON_FAIL=1"
    );
    if (process.env.MIGRATE_EXIT_ON_FAIL === "1" || process.env.MIGRATE_EXIT_ON_FAIL === "true") {
      process.exit(r.status ?? 1);
    }
  }
}

runMigrateIfConfigured();

const child = spawn(process.execPath, [server], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code == null ? 1 : code);
});
