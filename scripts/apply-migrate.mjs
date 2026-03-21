/**
 * SolarAdvisor — Database migration script
 * Runs automatically on every Railway deploy via start-standalone.cjs
 * Uses CREATE TABLE IF NOT EXISTS — 100% safe to run on every deploy.
 *
 * Railway MySQL plugin injects these vars automatically:
 *   MYSQL_URL              mysql://root:PASS@PRIVATE_DOMAIN:3306/railway
 *   MYSQLPRIVATE_URL       same (alias)
 *   MYSQL_PUBLIC_URL       mysql://root:PASS@TCP_PROXY_DOMAIN:TCP_PORT/railway
 *   MYSQL_ROOT_PASSWORD    the root password
 *   MYSQLHOST              private domain
 *   MYSQLPORT              3306
 *   MYSQLUSER              root
 *   MYSQLPASSWORD          same as MYSQL_ROOT_PASSWORD
 *   MYSQLDATABASE          railway  (default DB name on Railway)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

function getMysqlUri() {
  const candidates = [
    process.env.MYSQL_URL,
    process.env.MYSQLPRIVATE_URL,
    process.env.MYSQL_PUBLIC_URL,
    process.env.DATABASE_URL,
  ].filter(Boolean);

  for (const raw of candidates) {
    const u = String(raw).trim();
    if (!/^mysql(2)?:\/\//i.test(u)) continue;
    if (/\$\{\{/.test(u)) continue; // unresolved Railway template
    /* Skip only .env.example placeholders — real mysql://…@localhost:3306/solaradvisor is valid. */
    if (/your-password|your-railway-host/i.test(u)) continue;
    return u;
  }
  return null;
}

function getConnectionConfig() {
  const uri = getMysqlUri();
  const connectTimeout = 20000;

  if (uri) {
    console.log("[migrate] URL:", uri.replace(/:([^:@]+)@/, ":***@"));
    return { uri, multipleStatements: true, connectTimeout, ssl: { rejectUnauthorized: false } };
  }

  // Fall back to individual vars
  const host     = process.env.MYSQLHOST      || process.env.MYSQL_HOST      || process.env.RAILWAY_PRIVATE_DOMAIN || "localhost";
  const port     = parseInt(process.env.MYSQLPORT || process.env.MYSQL_PORT || "3306", 10);
  const user     = process.env.MYSQLUSER      || process.env.MYSQL_USER      || "root";
  const password = process.env.MYSQLPASSWORD  || process.env.MYSQL_PASSWORD  || process.env.MYSQL_ROOT_PASSWORD || "";
  const database = process.env.MYSQLDATABASE  || process.env.MYSQL_DATABASE  || "railway";

  console.log(`[migrate] Config: ${user}@${host}:${port}/${database}`);
  return { host, port, user, password, database, multipleStatements: true, connectTimeout, ssl: { rejectUnauthorized: false } };
}

function hasDbConfig() {
  return !!(
    getMysqlUri() ||
    process.env.MYSQLHOST || process.env.MYSQL_HOST ||
    process.env.RAILWAY_PRIVATE_DOMAIN
  );
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  if (!hasDbConfig()) {
    console.error(
      "[migrate] ❌ No DB config.\n" +
      "  Railway: link the MySQL plugin → web service gets MYSQL_URL automatically.\n" +
      "  Local:   set MYSQL_HOST + MYSQL_USER + MYSQL_PASSWORD + MYSQL_DATABASE in .env.local"
    );
    process.exit(1);
  }

  const sqlPath = path.join(root, "migrate.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error("[migrate] ❌ migrate.sql not found:", sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  const isStartup = process.env.STARTUP_MIGRATE === "1";
  const maxAttempts = parseInt(process.env.MIGRATE_RETRIES || (isStartup ? "6" : "8"), 10);
  const retryMs = 4000;

  console.log(`[migrate] Applying migrate.sql (up to ${maxAttempts} attempts)…`);

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let conn;
    try {
      conn = await mysql.createConnection(getConnectionConfig());
      await conn.query(sql);
      await conn.end();
      console.log("[migrate] ✅ Tables created / verified successfully.");
      return;
    } catch (e) {
      lastErr = e;
      if (conn) { try { await conn.end(); } catch { /**/ } }
      console.warn(`[migrate] attempt ${attempt}/${maxAttempts}: ${e instanceof Error ? e.message : e}`);
      if (attempt < maxAttempts) {
        console.log(`[migrate] Retrying in ${retryMs}ms…`);
        await sleep(retryMs);
      }
    }
  }

  console.error("[migrate] ❌ All attempts failed:", lastErr?.message || lastErr);
  if (!isStartup) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
