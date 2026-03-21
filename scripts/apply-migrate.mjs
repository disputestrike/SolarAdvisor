/**
 * Apply migrate.sql to Railway / MySQL (run once).
 * Usage (from repo root, with env loaded):
 *   node scripts/apply-migrate.mjs
 * Or: railway run node scripts/apply-migrate.mjs
 *
 * Requires: MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_PORT (optional)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

async function main() {
  const host = process.env.MYSQL_HOST || "localhost";
  const port = parseInt(process.env.MYSQL_PORT || "3306", 10);
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || "solaradvisor";

  if (!process.env.MYSQL_HOST && !process.env.DATABASE_URL) {
    console.error("Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE (or use Railway Variables).");
    process.exit(1);
  }

  const sqlPath = path.join(root, "migrate.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });

  console.log(`Applying ${path.basename(sqlPath)} to ${host}/${database} ...`);
  await conn.query(sql);
  await conn.end();
  console.log("Done. Tables should exist now.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
