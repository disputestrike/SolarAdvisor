import { NextResponse } from "next/server";
import { checkDbConnection, q } from "@/db";

export const dynamic = "force-dynamic";

/** Readiness — pings MySQL and checks tables exist. */
export async function GET() {
  let dbOk = false;
  let tablesOk = false;
  let tableList: string[] = [];
  let dbError = "";

  try {
    dbOk = await checkDbConnection();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  if (dbOk) {
    try {
      const rows = await q<{ TABLE_NAME: string }>(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME"
      );
      tableList = rows.map((r) => r.TABLE_NAME);
      const required = ["leads", "lead_activity", "drip_messages", "admin_users", "state_incentives", "zip_cache"];
      tablesOk = required.every((t) => tableList.includes(t));
    } catch (e) {
      dbError = e instanceof Error ? e.message : String(e);
    }
  }

  const status = dbOk && tablesOk ? "ready" : dbOk ? "db_connected_tables_missing" : "db_unreachable";

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      database: dbOk ? "connected" : "error",
      tables: {
        found: tableList,
        ready: tablesOk,
      },
      ...(dbError ? { error: dbError } : {}),
    },
    { status: status === "ready" ? 200 : 503 }
  );
}
