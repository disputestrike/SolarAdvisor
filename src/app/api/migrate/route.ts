import { NextResponse } from "next/server";
import { getPool } from "@/db";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const sqlPath = path.join(process.cwd(), "migrate.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    const statements = sql.split(";").map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith("--"));
    const conn = await getPool().getConnection();
    const results: string[] = [];
    try {
      for (const stmt of statements) {
        try {
          await conn.execute(stmt);
          results.push(`✓ ${stmt.slice(0, 50)}`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes("Duplicate entry")) results.push(`⚠ ${msg.slice(0, 80)}`);
        }
      }
    } finally { conn.release(); }
    return NextResponse.json({ success: true, count: results.length, results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const conn = await getPool().getConnection();
    try {
      await conn.execute("SELECT first_name FROM leads LIMIT 1");
      conn.release();
      return NextResponse.json({ status: "schema_ok" });
    } catch (e) {
      conn.release();
      return NextResponse.json({ status: "schema_broken", error: e instanceof Error ? e.message : String(e) });
    }
  } catch (e) {
    return NextResponse.json({ status: "no_connection", error: e instanceof Error ? e.message : String(e) });
  }
}
