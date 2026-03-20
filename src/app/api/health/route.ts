import { NextResponse } from "next/server";
import { checkDbConnection } from "@/db";

export async function GET() {
  const dbOk = await checkDbConnection();
  return NextResponse.json(
    {
      status: dbOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        database: dbOk ? "ok" : "error",
        smtp: !!process.env.SMTP_USER ? "configured" : "not_configured",
        twilio: !!process.env.TWILIO_ACCOUNT_SID ? "configured" : "not_configured",
      },
    },
    { status: dbOk ? 200 : 503 }
  );
}
