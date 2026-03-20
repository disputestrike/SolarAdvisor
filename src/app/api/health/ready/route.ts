import { NextResponse } from "next/server";
import { checkDbConnection } from "@/db";

export const dynamic = "force-dynamic";

/** Readiness probe — 503 until MySQL accepts connections. Point Railway here only if you require DB before traffic. */
export async function GET() {
  try {
    const ok = await checkDbConnection();
    if (!ok) {
      return NextResponse.json({ ready: false, reason: "database" }, { status: 503 });
    }
    return NextResponse.json({ ready: true });
  } catch {
    return NextResponse.json({ ready: false, reason: "database" }, { status: 503 });
  }
}
