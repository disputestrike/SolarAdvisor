import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness — must respond fast. Do NOT touch MySQL here: a bad DATABASE_URL
 * causes mysql2 to block until connectTimeout (~15s), and Railway healthchecks
 * time out → "service unavailable" even when the app is up.
 *
 * Database status: GET /api/health/ready
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        smtp: process.env.SMTP_USER ? "configured" : "not_configured",
        twilio: process.env.TWILIO_ACCOUNT_SID ? "configured" : "not_configured",
      },
      database: "use /api/health/ready",
    },
    { status: 200 }
  );
}
