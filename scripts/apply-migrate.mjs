/**
 * SolarAdvisor — Auto-migration script
 * Runs on every Railway deploy via scripts/start-standalone.cjs
 * Uses CREATE TABLE IF NOT EXISTS — safe to run multiple times.
 *
 * Railway MySQL plugin injects these variables automatically:
 *   MYSQL_URL             mysql://root:password@host:port/railway  (private TCP)
 *   MYSQLPRIVATE_URL      same (alias)
 *   MYSQL_HOST / MYSQLHOST
 *   MYSQL_PORT / MYSQLPORT
 *   MYSQL_USER / MYSQLUSER
 *   MYSQL_PASSWORD / MYSQLPASSWORD
 *   MYSQL_DATABASE / MYSQLDATABASE  (value is "railway" by default)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// ─── Connection resolution ────────────────────────────────────────────────────
// Railway injects MYSQL_URL automatically when MySQL plugin is linked.
// Fallback to individual vars so it also works with manual configuration.
function getConnectionConfig() {
  const connectTimeout = 15000;

  // Priority 1: MYSQL_URL or MYSQLPRIVATE_URL (Railway plugin auto-injects these)
  const uri =
    process.env.MYSQL_URL ||
    process.env.MYSQLPRIVATE_URL ||
    process.env.DATABASE_URL;

  if (uri && /^mysql(2)?:\/\//i.test(uri.trim())) {
    const u = uri.trim();
    // Skip placeholder values from .env.example
    if (!/your-password|your-railway|localhost:3306\/solaradvisor$/.test(u)) {
      console.log("[migrate] Using connection URL:", u.replace(/:([^:@]+)@/, ":***@"));
      return {
        uri: u,
        multipleStatements: true,
        connectTimeout,
        ssl: { rejectUnauthorized: false },
      };
    }
  }

  // Priority 2: Individual env vars (Railway also injects these)
  const host =
    process.env.MYSQL_HOST ||
    process.env.MYSQLHOST ||
    process.env.RAILWAY_TCP_PROXY_DOMAIN ||
    "localhost";
  const port = parseInt(
    process.env.MYSQL_PORT ||
    process.env.MYSQLPORT ||
    process.env.RAILWAY_TCP_PROXY_PORT ||
    "3306",
    10
  );
  const user =
    process.env.MYSQL_USER ||
    process.env.MYSQLUSER ||
    "root";
  const password =
    process.env.MYSQL_PASSWORD ||
    process.env.MYSQLPASSWORD ||
    "";
  // Railway default database name is "railway"
  const database =
    process.env.MYSQL_DATABASE ||
    process.env.MYSQLDATABASE ||
    process.env.MYSQL_DBNAME ||
    "railway";

  console.log(`[migrate] Using host config: ${user}@${host}:${port}/${database}`);
  return {
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    connectTimeout,
    ssl: { rejectUnauthorized: false },
  };
}

function hasDbConfig() {
  return !!(
    process.env.MYSQL_URL ||
    process.env.MYSQLPRIVATE_URL ||
    process.env.MYSQL_HOST ||
    process.env.MYSQLHOST ||
    process.env.DATABASE_URL
  );
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!hasDbConfig()) {
    console.error(
      "[migrate] No DB config found.\n" +
      "  On Railway: link the MySQL plugin to your service — MYSQL_URL is injected automatically.\n" +
      "  Locally: set MYSQL_HOST + MYSQL_USER + MYSQL_PASSWORD + MYSQL_DATABASE in .env.local"
    );
    process.exit(1);
  }

  const sqlPath = path.join(root, "migrate.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error("[migrate] migrate.sql not found at:", sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  const isStartup = process.env.STARTUP_MIGRATE === "1";
  const maxAttempts = parseInt(process.env.MIGRATE_RETRIES || (isStartup ? "5" : "8"), 10);
  const retryDelayMs = parseInt(process.env.MIGRATE_RETRY_DELAY_MS || "3000", 10);

  console.log(`[migrate] Applying migrate.sql (${maxAttempts} attempts max) …`);

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let conn;
    try {
      const cfg = getConnectionConfig();
      conn = await mysql.createConnection(cfg);
      await conn.query(sql);
      await conn.end();
      console.log("[migrate] ✓ All tables created / verified. Migration complete.");
      return;
    } catch (e) {
      lastErr = e;
      if (conn) { try { await conn.end(); } catch { /* ignore */ } }
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[migrate] attempt ${attempt}/${maxAttempts} failed: ${msg}`);
      if (attempt < maxAttempts) {
        console.log(`[migrate] Retrying in ${retryDelayMs}ms …`);
        await sleep(retryDelayMs);
      }
    }
  }

  console.error("[migrate] All attempts failed. Last error:");
  console.error(lastErr);
  // Don't hard-exit on startup — app can still serve non-DB routes
  if (!isStartup) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
