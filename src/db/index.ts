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

function isPlaceholder(s: string | undefined): boolean {
  if (!s) return true;
  return /your-password|your-railway|placeholder|\$\{\{|localhost:3306\/solaradvisor/i.test(s);
}

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

  // Priority 1: MYSQLHOST individual vars (Railway injects these when plugin is linked)
  const host = process.env.MYSQLHOST || process.env.RAILWAY_PRIVATE_DOMAIN || process.env.MYSQL_HOST || "";
  const port = parseInt(process.env.MYSQLPORT || process.env.MYSQL_PORT || "3306", 10);
  const user = process.env.MYSQLUSER || process.env.MYSQL_USER || "root";
  const password = process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || "railway";

  if (host && !isPlaceholder(host)) {
    console.log(`[db] ${user}@${host}:${port}/${database}`);
    return { ...base, host, port, user, password, database } as mysql.PoolOptions;
  }

  // Priority 2: MYSQL_URL or MYSQLPRIVATE_URL (NOT DATABASE_URL — it has placeholder text)
  for (const raw of [process.env.MYSQL_URL, process.env.MYSQLPRIVATE_URL, process.env.MYSQL_PUBLIC_URL]) {
    if (raw && /^mysql/i.test(raw) && !isPlaceholder(raw)) {
      console.log(`[db] URL: ${raw.replace(/:([^:@]+)@/, ":***@")}`);
      return { ...base, uri: raw } as mysql.PoolOptions;
    }
  }

  // DATABASE_URL is intentionally excluded — it always contains placeholder text in this project
  console.warn("[db] No valid DB config. Link MySQL plugin to this service in Railway.");
  return { ...base, host: "127.0.0.1", port: 3306, user, password, database } as mysql.PoolOptions;
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
