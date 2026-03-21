import { NextResponse } from "next/server";
import { checkDbConnection } from "@/db";

export const dynamic = "force-dynamic";

/** Readiness — pings MySQL (can be slow if DB is down). Not for Railway liveness. */
export async function GET() {
  let dbOk = false;
  try {
    dbOk = await checkDbConnection();
  } catch {
    dbOk = false;
  }

  return NextResponse.json(
    {
      status: dbOk ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
      database: dbOk ? "ok" : "error",
    },
    { status: dbOk ? 200 : 503 }
  );
}
