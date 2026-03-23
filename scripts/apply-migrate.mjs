/**
 * SolarAdvisor — auto-migration on Railway deploy
 * Same connection priority as src/db/index.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function isPlaceholder(s) {
  return /your-password|your-railway-host|localhost:3306\/solaradvisor|\$\{\{/.test(s);
}

function isValidUrl(raw) {
  if (!raw) return false;
  const u = String(raw).trim();
  return /^mysql(2)?:\/\//i.test(u) && !isPlaceholder(u);
}

function getConfig() {
  const ssl = { rejectUnauthorized: false };
  const connectTimeout = 20000;

  // Priority 1: individual Railway vars
  const host = process.env.MYSQLHOST || process.env.RAILWAY_PRIVATE_DOMAIN || process.env.MYSQL_HOST || "";
  const port = parseInt(process.env.MYSQLPORT || process.env.MYSQL_PORT || "3306", 10);
  const user = process.env.MYSQLUSER || process.env.MYSQL_USER || "root";
  const password = process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || "railway";

  if (host && !isPlaceholder(host)) {
    console.log(`[migrate] Connecting: ${user}@${host}:${port}/${database}`);
    return { host, port, user, password, database, multipleStatements: true, connectTimeout, ssl };
  }

  // Priority 2: URL (DATABASE_URL last — often has placeholder)
  const urls = [process.env.MYSQL_URL, process.env.MYSQLPRIVATE_URL, process.env.MYSQL_PUBLIC_URL, process.env.DATABASE_URL];
  for (const raw of urls) {
    if (isValidUrl(raw)) {
      const u = String(raw).trim();
      console.log(`[migrate] Connecting via URL: ${u.replace(/:([^:@]+)@/, ":***@")}`);
      return { uri: u, multipleStatements: true, connectTimeout, ssl };
    }
  }

  return null;
}

function hasConfig() {
  const host = process.env.MYSQLHOST || process.env.RAILWAY_PRIVATE_DOMAIN || process.env.MYSQL_HOST || "";
  if (host && !isPlaceholder(host)) return true;
  const urls = [process.env.MYSQL_URL, process.env.MYSQLPRIVATE_URL, process.env.MYSQL_PUBLIC_URL];
  return urls.some(u => isValidUrl(u));
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  if (!hasConfig()) {
    console.log("[migrate] ⚠️  No valid DB config. On Railway: link MySQL plugin → service gets MYSQLHOST injected automatically.");
    return;
  }

  const sqlPath = path.join(root, "migrate.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const maxAttempts = 6;

  console.log(`[migrate] Running migrate.sql (${maxAttempts} attempts max)…`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let conn;
    try {
      const cfg = getConfig();
      if (!cfg) { console.error("[migrate] Could not build config"); return; }
      conn = await mysql.createConnection(cfg);
      await conn.query(sql);
      await conn.end();
      console.log("[migrate] ✅ All tables ready.");
      return;
    } catch (e) {
      if (conn) { try { await conn.end(); } catch { /**/ } }
      console.warn(`[migrate] attempt ${attempt}/${maxAttempts}: ${e instanceof Error ? e.message : e}`);
      if (attempt < maxAttempts) await sleep(4000);
    }
  }
  console.error("[migrate] ❌ All attempts failed — check MYSQLHOST is set in Railway service Variables.");
}

main().catch(e => console.error(e));
