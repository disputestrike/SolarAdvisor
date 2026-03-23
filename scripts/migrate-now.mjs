#!/usr/bin/env node
/**
 * Run this directly in Railway shell to create tables immediately:
 *   node scripts/migrate-now.mjs
 *
 * Or as a Railway one-off command in the dashboard.
 * Local: `npm run migrate:now` (loads .env.local).
 */
import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
dotenv.config({ path: join(root, ".env.local") });
dotenv.config({ path: join(root, ".env") });

function isPlaceholder(s) {
  return !s || /your-password|your-railway-host|localhost:3306\/solaradvisor|\$\{\{/.test(s);
}

// Individual vars first (most reliable on Railway)
const host     = process.env.MYSQLHOST      || process.env.MYSQL_HOST      || "";

// URL candidates — DATABASE_URL last (often has placeholder text)
const uriCandidates = [
  process.env.MYSQL_URL,
  process.env.MYSQLPRIVATE_URL,
  process.env.MYSQL_PUBLIC_URL,
  process.env.DATABASE_URL,
].filter(u => u && /^mysql(2)?:\/\//i.test(u) && !isPlaceholder(u));
const uri = uriCandidates[0] || null;
const port     = parseInt(process.env.MYSQLPORT || process.env.MYSQL_PORT  || "3306");
const user     = process.env.MYSQLUSER      || process.env.MYSQL_USER      || "root";
const password = process.env.MYSQLPASSWORD  || process.env.MYSQL_PASSWORD  || process.env.MYSQL_ROOT_PASSWORD || "";
const database = process.env.MYSQLDATABASE  || process.env.MYSQL_DATABASE  || "railway";

console.log("\n╔══════════════════════════════════╗");
console.log("║  SolarAdvisor — Run Migration    ║");
console.log("╚══════════════════════════════════╝\n");

const cfg =
  uri && /^mysql/i.test(uri) && !/your-password|your-railway-host/i.test(uri)
    ? { uri, multipleStatements: true, ssl: { rejectUnauthorized: false } }
    : { host, port, user, password, database, multipleStatements: true, ssl: { rejectUnauthorized: false } };

console.log("Connecting to:", uri ? uri.replace(/:([^:@]+)@/, ":***@") : `${user}@${host}:${port}/${database}`);

try {
  const conn = await createConnection(cfg);
  const sql = readFileSync(join(root, "migrate.sql"), "utf8");
  console.log("Running migrate.sql...");
  await conn.query(sql);
  await conn.end();
  console.log("\n✅ SUCCESS — all tables created.\n");
  
  // Verify
  const verify = await createConnection(cfg);
  const [rows] = await verify.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME");
  console.log("Tables in database:");
  (rows as Array<{TABLE_NAME: string}>).forEach(r => console.log(`  ✓ ${r.TABLE_NAME}`));
  await verify.end();
} catch (err) {
  console.error("\n❌ FAILED:", err instanceof Error ? err.message : err);
  console.error("\nEnv vars present:", Object.keys(process.env).filter(k => k.includes("MYSQL") || k.includes("DATABASE")).join(", ") || "NONE");
  process.exit(1);
}
