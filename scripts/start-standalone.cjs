#!/usr/bin/env node
/**
 * Next standalone uses process.env.HOSTNAME for the bind address.
 * Railway/Docker set HOSTNAME to the container hostname (e.g. ffc3bd32d8b0),
 * so the server does not listen on 0.0.0.0 and platform healthchecks fail.
 * Force IPv4 all-interfaces bind before starting the standalone server.
 *
 * MySQL migrate.sql must NOT block the first HTTP bind — Railway healthchecks
 * start immediately; blocking on ETIMEDOUT keeps the port closed until timeouts finish.
 */
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const server = path.join(root, ".next", "standalone", "server.js");

process.env.HOSTNAME = "0.0.0.0";
process.env.HOST = "0.0.0.0";

function runMigrateInBackground() {
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
  console.log("[start] Scheduling migrate.sql in background (does not block /api/health) …");
  const m = spawn(process.execPath, [script], {
    cwd: root,
    env: {
      ...process.env,
      STARTUP_MIGRATE: "1",
    },
    stdio: "inherit",
  });
  m.on("exit", (code) => {
    if (code !== 0) {
      console.error(
        "[start] migrate.sql exited with code %s — tables may be missing. Fix DB networking or run SQL manually.",
        code
      );
    } else {
      console.log("[start] migrate.sql finished successfully.");
    }
  });
}

const child = spawn(process.execPath, [server], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

// Let Next bind to PORT before any DB work competes for the event loop / network stack.
setTimeout(() => {
  runMigrateInBackground();
}, 1500);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code == null ? 1 : code);
});
