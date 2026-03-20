import { db } from "./index";
import mysql from "mysql2/promise";

// Re-export a raw query helper that returns properly typed rows
// mysql2 execute returns [rows, fields] — rows is RowDataPacket[] for SELECT
// and ResultSetHeader for INSERT/UPDATE/DELETE

type RowRecord = Record<string, unknown>;

/**
 * Run a SELECT query and get typed rows back.
 * Always returns an array (empty if no results).
 */
export async function queryRows<T extends RowRecord = RowRecord>(
  sql: string,
  params: (string | number | boolean | null)[] = []
): Promise<T[]> {
  const pool = (db as unknown as { session: { client: mysql.Pool } }).session?.client;
  // fallback: get the underlying pool from drizzle
  const connection = await getConnection();
  const [rows] = await connection.execute(sql, params);
  connection.release();
  return (rows as T[]) || [];
}

/**
 * Run a SELECT that returns exactly one row or null.
 */
export async function queryOne<T extends RowRecord = RowRecord>(
  sql: string,
  params: (string | number | boolean | null)[] = []
): Promise<T | null> {
  const rows = await queryRows<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Run an INSERT/UPDATE/DELETE and get the insertId / affectedRows back.
 */
export async function queryExec(
  sql: string,
  params: (string | number | boolean | null)[] = []
): Promise<{ insertId: number; affectedRows: number }> {
  const connection = await getConnection();
  const [result] = await connection.execute(sql, params);
  connection.release();
  const r = result as mysql.ResultSetHeader;
  return { insertId: r.insertId, affectedRows: r.affectedRows };
}

// ─── Pool accessor ────────────────────────────────────────────────────────────
// We need the raw mysql2 pool. Keep it in a module-level singleton.
let _pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT || "3306"),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    });
  }
  return _pool;
}

async function getConnection(): Promise<mysql.PoolConnection> {
  return getPool().getConnection();
}

export { getPool };

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
