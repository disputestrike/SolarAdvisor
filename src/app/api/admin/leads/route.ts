import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { q, q1, qExec } from "@/db";
import { leadActivity } from "@/db/schema";
import { leadUpdateSchema } from "@/lib/validation";
import { getAdminFromCookie } from "@/lib/auth";

async function requireAdmin(req: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return { admin: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { admin, error: null };
}

export async function GET(req: NextRequest) {
  const { admin, error } = await requireAdmin(req);
  if (error) return error;

  const params = req.nextUrl.searchParams;
  const page = parseInt(params.get("page") || "1");
  const limit = parseInt(params.get("limit") || "20");
  const tier = params.get("tier");
  const status = params.get("status");
  const search = params.get("search");
  const offset = (page - 1) * limit;

  try {
    // Build WHERE dynamically
    const conditions: string[] = ["1=1"];
    const vals: (string | number)[] = [];

    if (tier) { conditions.push("tier = ?"); vals.push(tier); }
    if (status) { conditions.push("status = ?"); vals.push(status); }
    if (search) {
      conditions.push("(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ? OR zip_code LIKE ?)");
      const s = `%${search}%`;
      vals.push(s, s, s, s, s);
    }

    const where = conditions.join(" AND ");

    const [leads, countRows, statsRows] = await Promise.all([
      q(`SELECT * FROM leads WHERE ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, vals),
      q1<{ total: number }>(`SELECT COUNT(*) as total FROM leads WHERE ${where}`, vals),
      q1<{
        total_leads: number; hot_leads: number; medium_leads: number; cold_leads: number;
        converted: number; total_commission: number; total_sold_value: number;
        avg_score: number; today_leads: number;
      }>(`SELECT
        COUNT(*) as total_leads,
        SUM(CASE WHEN tier='hot' THEN 1 ELSE 0 END) as hot_leads,
        SUM(CASE WHEN tier='medium' THEN 1 ELSE 0 END) as medium_leads,
        SUM(CASE WHEN tier='cold' THEN 1 ELSE 0 END) as cold_leads,
        SUM(CASE WHEN status IN ('converted','sold') THEN 1 ELSE 0 END) as converted,
        SUM(COALESCE(commission_earned,0)) as total_commission,
        SUM(COALESCE(sold_price,0)) as total_sold_value,
        AVG(score) as avg_score,
        SUM(CASE WHEN DATE(created_at)=CURDATE() THEN 1 ELSE 0 END) as today_leads
        FROM leads`),
    ]);

    const total = countRows?.total ?? 0;

    return NextResponse.json({
      leads,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: statsRows,
    });
  } catch (err) {
    console.error("[Admin Leads GET]", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { admin, error } = await requireAdmin(req);
  if (error) return error;

  const body = await req.json();
  const { id, ...updateData } = body;
  if (!id) return NextResponse.json({ error: "Lead ID required" }, { status: 400 });

  const parsed = leadUpdateSchema.safeParse(updateData);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  try {
    const f = parsed.data;
    const sets: string[] = [];
    const vals: (string | number | null)[] = [];

    if (f.status !== undefined) { sets.push("status=?"); vals.push(f.status); }
    if (f.assignedTo !== undefined) { sets.push("assigned_to=?"); vals.push(f.assignedTo); }
    if (f.notes !== undefined) { sets.push("notes=?"); vals.push(f.notes); }
    if (f.appointmentAt !== undefined) { sets.push("appointment_at=?"); vals.push(f.appointmentAt); }
    if (f.soldPrice !== undefined) { sets.push("sold_price=?"); vals.push(f.soldPrice); }
    if (f.soldTo !== undefined) { sets.push("sold_to=?"); vals.push(f.soldTo); }
    if (f.commissionEarned !== undefined) { sets.push("commission_earned=?"); vals.push(f.commissionEarned); }

    if (sets.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    vals.push(id);
    await qExec(`UPDATE leads SET ${sets.join(",")} WHERE id=?`, vals);

    await db.insert(leadActivity).values({
      leadId: parseInt(id),
      type: "status_changed",
      description: `Updated by admin: ${admin!.email}`,
      metadata: JSON.stringify(f),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin Leads PATCH]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
