/**
 * SolarAdvisor — auto-migration
 * Runs on every deploy via start-standalone.cjs
 * Uses CREATE TABLE IF NOT EXISTS — safe every time.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function getConfig() {
  const connectTimeout = 20000;
  const ssl = { rejectUnauthorized: false };

  // ── Priority 1: individual Railway vars (injected by the service link) ──
  const host =
    process.env.MYSQLHOST ||
    process.env.RAILWAY_PRIVATE_DOMAIN ||
    process.env.MYSQL_HOST || "";

  const port = parseInt(process.env.MYSQLPORT || process.env.MYSQL_PORT || "3306", 10);
  const user = process.env.MYSQLUSER || process.env.MYSQL_USER || "root";
  const password =
    process.env.MYSQLPASSWORD ||
    process.env.MYSQL_ROOT_PASSWORD ||
    process.env.MYSQL_PASSWORD || "";
  const database =
    process.env.MYSQLDATABASE ||
    process.env.MYSQL_DATABASE || "railway";

  if (host && !/your-railway-host|^localhost$/.test(host)) {
    console.log(`[migrate] Using: ${user}@${host}:${port}/${database}`);
    return { host, port, user, password, database, multipleStatements: true, connectTimeout, ssl };
  }

  // ── Priority 2: URL ──────────────────────────────────────────────────────
  const urls = [
    process.env.MYSQL_URL,
    process.env.MYSQLPRIVATE_URL,
    process.env.MYSQL_PUBLIC_URL,
  ].filter(Boolean);

  for (const raw of urls) {
    const u = String(raw).trim();
    if (!/^mysql(2)?:\/\//i.test(u)) continue;
    if (/\$\{\{/.test(u)) continue;
    if (/your-password|your-railway-host/i.test(u)) continue;
    console.log(`[migrate] Using URL: ${u.replace(/:([^:@]+)@/, ":***@")}`);
    return { uri: u, multipleStatements: true, connectTimeout, ssl };
  }

  return null;
}

function hasConfig() {
  const host = process.env.MYSQLHOST || process.env.RAILWAY_PRIVATE_DOMAIN || process.env.MYSQL_HOST || "";
  if (host && !/your-railway-host|^localhost$/.test(host)) return true;
  return !!(process.env.MYSQL_URL || process.env.MYSQLPRIVATE_URL || process.env.MYSQL_PUBLIC_URL);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  if (!hasConfig()) {
    console.log("[migrate] No DB config — skipping (link MySQL plugin on Railway).");
    return;
  }

  const sqlPath = path.join(root, "migrate.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error("[migrate] migrate.sql not found:", sqlPath);
    return;
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  const maxAttempts = parseInt(process.env.MIGRATE_RETRIES || "6", 10);

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
  console.error("[migrate] ❌ All attempts failed — check Railway service link to MySQL.");
}

main().catch(e => { console.error(e); });
