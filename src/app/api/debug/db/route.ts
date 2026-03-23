import { NextResponse } from "next/server";
import { checkDbConnection, q } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  function isPlaceholder(s: string | undefined) {
    if (!s) return true;
    return /your-password|your-railway-host|localhost:3306\/solaradvisor|\$\{\{/.test(s);
  }

  const vars = {
    MYSQLHOST:           process.env.MYSQLHOST        || null,
    MYSQLPORT:           process.env.MYSQLPORT         || null,
    MYSQLUSER:           process.env.MYSQLUSER         || null,
    MYSQLPASSWORD:       process.env.MYSQLPASSWORD     ? "***SET***" : null,
    MYSQLDATABASE:       process.env.MYSQLDATABASE     || null,
    MYSQL_ROOT_PASSWORD: process.env.MYSQL_ROOT_PASSWORD ? "***SET***" : null,
    MYSQL_URL:           process.env.MYSQL_URL         ? process.env.MYSQL_URL.replace(/:([^:@]+)@/, ":***@") : null,
    DATABASE_URL:        process.env.DATABASE_URL      ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ":***@") : null,
    RAILWAY_PRIVATE_DOMAIN: process.env.RAILWAY_PRIVATE_DOMAIN || null,
  };

  const host = process.env.MYSQLHOST || process.env.RAILWAY_PRIVATE_DOMAIN || "";
  let connectionPath = "none";
  if (host && !isPlaceholder(host)) {
    connectionPath = `individual_vars → ${host}`;
  } else if (process.env.DATABASE_URL && isPlaceholder(process.env.DATABASE_URL)) {
    connectionPath = "❌ BLOCKED — DATABASE_URL contains placeholder text — DELETE IT from Railway vars";
  } else if (process.env.MYSQL_URL && !isPlaceholder(process.env.MYSQL_URL)) {
    connectionPath = "MYSQL_URL";
  } else {
    connectionPath = "❌ No valid DB config found";
  }

  let connected = false;
  let tables: string[] = [];
  let connectError = "";
  try {
    connected = await checkDbConnection();
    if (connected) {
      const rows = await q<{ TABLE_NAME: string }>(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME"
      );
      tables = rows.map(r => r.TABLE_NAME);
    }
  } catch (e) {
    connectError = e instanceof Error ? e.message : String(e);
  }

  const required = ["leads","lead_activity","drip_messages","admin_users","state_incentives","zip_cache"];
  return NextResponse.json({
    vars,
    connectionPath,
    connected,
    tables,
    tablesReady: required.every(t => tables.includes(t)),
    missingTables: required.filter(t => !tables.includes(t)),
    error: connectError || null,
    action: !connected
      ? "DELETE DATABASE_URL from Railway SolarAdvisor service Variables, then Redeploy"
      : "Connected OK",
  }, { status: connected ? 200 : 503 });
}
