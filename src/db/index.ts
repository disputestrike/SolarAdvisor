import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

type SqlParam = string | number | bigint | Date | Buffer | null;

function toSqlParams(params: (string | number | boolean | null | undefined)[]): SqlParam[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === "boolean") return p ? 1 : 0;
    return p as SqlParam;
  });
}

let _pool: mysql.Pool | null = null;

/**
 * Connection priority (highest → lowest):
 *
 * 1. MYSQLHOST individual vars — these are what Railway injects when the
 *    MySQL plugin is linked to the service. Most reliable.
 *
 * 2. MYSQL_URL / MYSQLPRIVATE_URL — Railway also injects these, but only
 *    after the service link is established.
 *
 * 3. MYSQL_PUBLIC_URL — fallback for external access.
 *
 * DATABASE_URL is DELIBERATELY LAST and skipped if it contains placeholder
 * text like "your-password" or "your-railway-host" — this is the variable
 * that has been blocking the connection by overriding the real MySQL vars.
 */
function isPlaceholder(s: string): boolean {
  return /your-password|your-railway-host|localhost:3306\/solaradvisor|\$\{\{/.test(s);
}

function isValidMysqlUrl(raw: string | undefined): raw is string {
  if (!raw) return false;
  const u = raw.trim();
  return /^mysql(2)?:\/\//i.test(u) && !isPlaceholder(u);
}

function getPoolOptions(): mysql.PoolOptions {
  const base: Partial<mysql.PoolOptions> = {
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    ssl: { rejectUnauthorized: false },
  };

  // ── Priority 1: individual Railway vars ──────────────────────────────────
  const host = process.env.MYSQLHOST || process.env.RAILWAY_PRIVATE_DOMAIN || process.env.MYSQL_HOST || "";
  const port = parseInt(process.env.MYSQLPORT || process.env.MYSQL_PORT || "3306", 10);
  const user = process.env.MYSQLUSER || process.env.MYSQL_USER || "root";
  const password = process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || "railway";

  if (host && !isPlaceholder(host)) {
    console.log(`[db] Connecting: ${user}@${host}:${port}/${database}`);
    return { ...base, host, port, user, password, database } as mysql.PoolOptions;
  }

  // ── Priority 2: URL vars (skip DATABASE_URL with placeholder) ────────────
  const urlCandidates = [
    process.env.MYSQL_URL,
    process.env.MYSQLPRIVATE_URL,
    process.env.MYSQL_PUBLIC_URL,
    process.env.DATABASE_URL, // last — often has placeholder text
  ];

  for (const raw of urlCandidates) {
    if (isValidMysqlUrl(raw)) {
      console.log(`[db] Connecting via URL: ${raw.replace(/:([^:@]+)@/, ":***@")}`);
      return { ...base, uri: raw.trim() } as mysql.PoolOptions;
    }
  }

  // ── Fallback: localhost (local dev) ───────────────────────────────────────
  console.warn("[db] ⚠️  No valid DB config — using localhost. On Railway: link MySQL plugin to this service.");
  return { ...base, host: "localhost", port: 3306, user: "root", password, database: "solaradvisor" } as mysql.PoolOptions;
}

export function getPool(): mysql.Pool {
  if (!_pool) _pool = mysql.createPool(getPoolOptions());
  return _pool;
}

export const db = drizzle(getPool(), { schema, mode: "default" });

type Row = Record<string, unknown>;

export async function q<T extends Row = Row>(sql: string, params: (string | number | boolean | null | undefined)[] = []): Promise<T[]> {
  const conn = await getPool().getConnection();
  try {
    const [rows] = await conn.execute(sql, toSqlParams(params));
    return (rows as T[]) || [];
  } finally { conn.release(); }
}

export async function q1<T extends Row = Row>(sql: string, params: (string | number | boolean | null | undefined)[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

export async function qExec(sql: string, params: (string | number | boolean | null | undefined)[] = []): Promise<{ insertId: number; affectedRows: number }> {
  const conn = await getPool().getConnection();
  try {
    const [result] = await conn.execute(sql, toSqlParams(params));
    const r = result as mysql.ResultSetHeader;
    return { insertId: r.insertId, affectedRows: r.affectedRows };
  } finally { conn.release(); }
}

export async function checkDbConnection(): Promise<boolean> {
  try {
    const conn = await getPool().getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch { return false; }
}
