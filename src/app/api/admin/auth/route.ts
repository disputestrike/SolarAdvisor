import { NextRequest, NextResponse } from "next/server";
import { q1 } from "@/db";
import { adminLoginSchema } from "@/lib/validation";
import { verifyPassword, createToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = adminLoginSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid credentials format" }, { status: 400 });

    const { email, password } = parsed.data;

    const admin = await q1<{
      id: number; email: string; password_hash: string; name: string; role: string;
    }>(
      "SELECT id, email, password_hash, name, role FROM admin_users WHERE email = ? LIMIT 1",
      [email]
    );

    if (!admin) {
      await verifyPassword(password, "$2b$12$invalidhashplaceholderpadding00");
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await verifyPassword(password, admin.password_hash);
    if (!valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

    await import("@/db").then(({ qExec }) =>
      qExec("UPDATE admin_users SET last_login_at=NOW() WHERE id=?", [admin.id])
    );

    const token = await createToken({ id: admin.id, email: admin.email, role: admin.role });

    const response = NextResponse.json({
      success: true,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    });

    response.cookies.set("sa_admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[Admin Login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("sa_admin_token");
  return response;
}
