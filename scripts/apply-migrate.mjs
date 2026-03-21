/**
 * Apply migrate.sql to Railway / MySQL (run on deploy or manually).
 *
 * Connection: DATABASE_URL or MYSQL_URL (mysql://...) OR MYSQL_HOST + MYSQL_USER + MYSQL_PASSWORD + MYSQL_DATABASE
 *
 * Usage: node scripts/apply-migrate.mjs
 * Railway: runs automatically from scripts/start-standalone.cjs when DB env is set (unless SKIP_DB_MIGRATE=1).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Same as src/db: prefer MYSQL_URL; skip .env.example DATABASE_URL placeholders. */
function pickMysqlUri() {
  const ordered = [
    process.env.MYSQL_URL,
    process.env.MYSQLPRIVATE_URL,
    process.env.DATABASE_URL,
  ].filter(Boolean);
  for (const raw of ordered) {
    const u = String(raw).trim();
    if (!/^mysql:\/\//i.test(u)) continue;
    if (/your-password|your-railway-host/i.test(u)) continue;
    return u;
  }
  return undefined;
}

function getConnectionConfig() {
  const connectTimeout = parseInt(
    process.env.MYSQL_CONNECT_TIMEOUT_MS ||
      (process.env.STARTUP_MIGRATE === "1" ? "5000" : "10000"),
    10
  );
  const uri = pickMysqlUri();
  if (uri && /^mysql:\/\//i.test(uri.trim())) {
    return {
      uri: uri.trim(),
      multipleStatements: true,
      connectTimeout,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined,
    };
  }
  const host = process.env.MYSQL_HOST || process.env.MYSQLHOST || "localhost";
  const port = parseInt(process.env.MYSQL_PORT || process.env.MYSQLPORT || "3306", 10);
  const user = process.env.MYSQL_USER || process.env.MYSQLUSER || "root";
  const password = process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD || "";
  const database = process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || "solaradvisor";
  return {
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    connectTimeout,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  };
}

function hasDbEnv() {
  if (pickMysqlUri()) return true;
  return !!(process.env.MYSQL_HOST || process.env.MYSQLHOST);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!hasDbEnv()) {
    console.error(
      "No DB config: set DATABASE_URL or MYSQL_URL (mysql://...) or MYSQL_HOST + MYSQL_USER + MYSQL_PASSWORD + MYSQL_DATABASE."
    );
    process.exit(1);
  }

  const sqlPath = path.join(root, "migrate.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  const startup = process.env.STARTUP_MIGRATE === "1";
  const maxAttempts = parseInt(
    process.env.MIGRATE_RETRIES || (startup ? "3" : "8"),
    10
  );
  const retryDelayMs = parseInt(
    process.env.MIGRATE_RETRY_DELAY_MS || (startup ? "2000" : "3000"),
    10
  );
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let conn;
    try {
      const cfg = getConnectionConfig();
      conn = await mysql.createConnection(cfg);
      console.log(
        `Applying ${path.basename(sqlPath)} (attempt ${attempt}/${maxAttempts}) …`
      );
      await conn.query(sql);
      await conn.end();
      console.log("Done. Tables are ready.");
      return;
    } catch (e) {
      lastErr = e;
      if (conn) {
        try {
          await conn.end();
        } catch {
          /* ignore */
        }
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[migrate] attempt ${attempt} failed: ${msg}`);
      if (attempt < maxAttempts) await sleep(retryDelayMs);
    }
  }

  console.error(lastErr);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
