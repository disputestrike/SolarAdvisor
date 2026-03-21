/**
 * One-shot: apply migrate.sql (schema + embedded seeds) then migrate_seed_state_incentives.sql.
 * Use when Railway MySQL is empty or you need state_incentives rows without re-running full migrate.
 *
 *   node scripts/db-setup.mjs
 *   railway run node scripts/db-setup.mjs
 *
 * Env: MYSQL_URL (preferred) or MYSQL_HOST + MYSQL_USER + MYSQL_PASSWORD + MYSQL_DATABASE
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
  const connectTimeout = parseInt(process.env.MYSQL_CONNECT_TIMEOUT_MS || "20000", 10);
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
  return {
    host: process.env.MYSQL_HOST || process.env.MYSQLHOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || process.env.MYSQLPORT || "3306", 10),
    user: process.env.MYSQL_USER || process.env.MYSQLUSER || "root",
    password: process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD || "",
    database: process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || "solaradvisor",
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

async function main() {
  if (!hasDbEnv()) {
    console.error(
      "Set MYSQL_URL (mysql://...) or MYSQL_HOST + MYSQL_USER + MYSQL_PASSWORD + MYSQL_DATABASE."
    );
    process.exit(1);
  }

  const migratePath = path.join(root, "migrate.sql");
  const seedPath = path.join(root, "migrate_seed_state_incentives.sql");
  const migrateSql = fs.readFileSync(migratePath, "utf8");
  const seedSql = fs.existsSync(seedPath) ? fs.readFileSync(seedPath, "utf8") : "";

  console.log("Connecting to MySQL…");
  const conn = await mysql.createConnection(getConnectionConfig());

  console.log(`Applying ${path.basename(migratePath)} …`);
  await conn.query(migrateSql);

  if (seedSql.trim()) {
    console.log(`Applying ${path.basename(seedPath)} …`);
    await conn.query(seedSql);
  }

  await conn.end();
  console.log("db-setup: done (tables + state incentives).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
