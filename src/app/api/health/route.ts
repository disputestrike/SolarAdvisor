import { NextResponse } from "next/server";
import { checkDbConnection } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Liveness probe — must return 2xx so PaaS healthchecks (e.g. Railway) pass even if
 * MySQL is still provisioning or optional. Use /api/health/ready for strict DB checks.
 */
export async function GET() {
  let dbOk = false;
  try {
    dbOk = await checkDbConnection();
  } catch {
    dbOk = false;
  }

  const status = dbOk ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: dbOk ? "ok" : "error",
        smtp: process.env.SMTP_USER ? "configured" : "not_configured",
        twilio: process.env.TWILIO_ACCOUNT_SID ? "configured" : "not_configured",
      },
    },
    { status: 200 }
  );
}
