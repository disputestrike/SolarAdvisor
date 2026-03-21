import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

// mysql2 ExecuteValues is: string | number | bigint | Date | Buffer | null
// We need to coerce undefined → null
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

export function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "localhost",
      port: parseInt(process.env.MYSQL_PORT || "3306"),
      database: process.env.MYSQL_DATABASE || "solaradvisor",
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 4000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : undefined,
    });
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
