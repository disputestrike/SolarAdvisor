import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

type SqlParam = string | number | bigint | Date | Buffer | null;

function toSqlParams(
  params: (string | number | boolean | null | undefined)[]
): SqlParam[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === "boolean") return p ? 1 : 0;
    return p as SqlParam;
  });
}

let _pool: mysql.Pool | null = null;

/**
 * Resolve MySQL connection from Railway env vars.
 *
 * Railway MySQL plugin injects ALL of these — we try each in priority order:
 *   MYSQL_URL              mysql://root:pass@private-domain:3306/railway
 *   MYSQLPRIVATE_URL       alias
 *   MYSQL_PUBLIC_URL       public TCP proxy URL (fallback)
 *   DATABASE_URL           only if it looks like a real mysql:// URL
 *
 * Individual var fallback (Railway also injects these):
 *   MYSQLHOST / MYSQL_HOST / RAILWAY_PRIVATE_DOMAIN
 *   MYSQLPORT / MYSQL_PORT
 *   MYSQLUSER / MYSQL_USER
 *   MYSQLPASSWORD / MYSQL_PASSWORD / MYSQL_ROOT_PASSWORD
 *   MYSQLDATABASE / MYSQL_DATABASE  (Railway default: "railway")
 */
function getMysqlUri(): string | undefined {
  const candidates = [
    process.env.MYSQL_URL,
    process.env.MYSQLPRIVATE_URL,
    process.env.MYSQL_PUBLIC_URL,
    process.env.DATABASE_URL,
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    const u = raw.trim();
    if (!/^mysql(2)?:\/\//i.test(u)) continue;
    // Skip unresolved Railway template references like ${{VAR}}
    if (/\$\{\{/.test(u)) continue;
    // Skip obvious placeholder values from .env.example
    if (/your-password|your-railway-host|localhost:3306\/solaradvisor$/.test(u)) continue;
    return u;
  }
  return undefined;
}

function getPoolOptions(): mysql.PoolOptions {
  const uri = getMysqlUri();

  if (uri) {
    return {
      uri,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 20000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      ssl: { rejectUnauthorized: false },
    };
  }

  // Individual vars — Railway injects both MYSQLHOST and MYSQL_HOST forms
  const host =
    process.env.MYSQLHOST ||
    process.env.MYSQL_HOST ||
    process.env.RAILWAY_PRIVATE_DOMAIN ||
    "localhost";

  const port = parseInt(
    process.env.MYSQLPORT ||
    process.env.MYSQL_PORT ||
    "3306",
    10
  );

  const user =
    process.env.MYSQLUSER ||
    process.env.MYSQL_USER ||
    "root";

  const password =
    process.env.MYSQLPASSWORD ||
    process.env.MYSQL_PASSWORD ||
    process.env.MYSQL_ROOT_PASSWORD ||
    "";

  // Railway default DB name is "railway" not "solaradvisor"
  const database =
    process.env.MYSQLDATABASE ||
    process.env.MYSQL_DATABASE ||
    "railway";

  return {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ssl: { rejectUnauthorized: false },
  };
}

export function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = mysql.createPool(getPoolOptions());
  }
  return _pool;
}

export const db = drizzle(getPool(), { schema, mode: "default" });

type Row = Record<string, unknown>;

export async function q<T extends Row = Row>(
  sql: string,
  params: (string | number | boolean | null | undefined)[] = []
): Promise<T[]> {
  const conn = await getPool().getConnection();
  try {
    const [rows] = await conn.execute(sql, toSqlParams(params));
    return (rows as T[]) || [];
  } finally {
    conn.release();
  }
}

export async function q1<T extends Row = Row>(
  sql: string,
  params: (string | number | boolean | null | undefined)[] = []
): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

export async function qExec(
  sql: string,
  params: (string | number | boolean | null | undefined)[] = []
): Promise<{ insertId: number; affectedRows: number }> {
  const conn = await getPool().getConnection();
  try {
    const [result] = await conn.execute(sql, toSqlParams(params));
    const r = result as mysql.ResultSetHeader;
    return { insertId: r.insertId, affectedRows: r.affectedRows };
  } finally {
    conn.release();
  }
}

export async function checkDbConnection(): Promise<boolean> {
  try {
    const conn = await getPool().getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch {
    return false;
  }
}
