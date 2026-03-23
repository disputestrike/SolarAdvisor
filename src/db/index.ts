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
 * Build connection config from Railway MySQL plugin vars.
 *
 * Railway injects these automatically when MySQL is linked to the service:
 *   MYSQL_URL              mysql://root:PASS@private-host:3306/railway
 *   MYSQLHOST              private hostname
 *   MYSQLPASSWORD          root password
 *   MYSQLDATABASE          railway (default DB name)
 *   MYSQL_ROOT_PASSWORD    same as MYSQLPASSWORD
 *   MYSQL_PUBLIC_URL       public TCP proxy URL
 *
 * Strategy: prefer individual vars (MYSQLHOST etc.) since they are always
 * injected correctly by Railway's link mechanism. Fall back to URL parsing.
 */
function getPoolOptions(): mysql.PoolOptions {
  const base = {
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ssl: { rejectUnauthorized: false },
  };

  // ── Priority 1: individual Railway-injected vars (most reliable) ──────────
  const host =
    process.env.MYSQLHOST ||
    process.env.RAILWAY_PRIVATE_DOMAIN ||
    process.env.MYSQL_HOST ||
    "";

  const port = parseInt(
    process.env.MYSQLPORT || process.env.MYSQL_PORT || "3306", 10
  );

  const user =
    process.env.MYSQLUSER || process.env.MYSQL_USER || "root";

  const password =
    process.env.MYSQLPASSWORD ||
    process.env.MYSQL_ROOT_PASSWORD ||
    process.env.MYSQL_PASSWORD ||
    "";

  const database =
    process.env.MYSQLDATABASE ||
    process.env.MYSQL_DATABASE ||
    "railway";

  // If we have a real host (not empty, not a placeholder), use individual vars
  if (host && !/your-railway-host|localhost/.test(host)) {
    console.log(`[db] Connecting via individual vars: ${user}@${host}:${port}/${database}`);
    return { ...base, host, port, user, password, database };
  }

  // ── Priority 2: connection URL ─────────────────────────────────────────────
  const urlCandidates = [
    process.env.MYSQL_URL,
    process.env.MYSQLPRIVATE_URL,
    process.env.MYSQL_PUBLIC_URL,
  ].filter(Boolean) as string[];

  for (const raw of urlCandidates) {
    const u = raw.trim();
    if (!/^mysql(2)?:\/\//i.test(u)) continue;
    if (/\$\{\{/.test(u)) continue;         // unresolved Railway template
    if (/your-password|your-railway-host/i.test(u)) continue; // placeholder
    console.log(`[db] Connecting via URL: ${u.replace(/:([^:@]+)@/, ":***@")}`);
    return { ...base, uri: u };
  }

  // ── Fallback: localhost for local dev ──────────────────────────────────────
  console.warn("[db] No Railway vars found — using localhost. Set MYSQLHOST on Railway.");
  return { ...base, host: "localhost", port: 3306, user: "root", password, database };
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
