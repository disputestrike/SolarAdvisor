import { NextRequest, NextResponse } from "next/server";
import { db, q1, qExec } from "@/db";
import { leadActivity, dripMessages } from "@/db/schema";
import { leadSchema } from "@/lib/validation";
import { scoreLead, estimateSolar } from "@/lib/scoring";
import { notifyLeadReceived } from "@/lib/notifications";
import { sendLeadWebhook } from "@/lib/webhook";
import { formatPhone } from "@/lib/auth";
import type { Lead } from "@/db/schema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = leadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    // ZIP → state lookup
    let city: string | undefined;
    let state: string | undefined;
    let avgSunHours = 5.0;
    let avgKwhCost = 0.13;

    try {
      const zipRow = await q1<{ city: string; state: string }>(
        "SELECT city, state FROM zip_cache WHERE zip_code = ? LIMIT 1",
        [data.zipCode]
      );
      if (zipRow) { city = zipRow.city; state = zipRow.state; }

      if (state) {
        const inc = await q1<{ avg_sun_hours: string; avg_electricity_cost: string }>(
          "SELECT avg_sun_hours, avg_electricity_cost FROM state_incentives WHERE state = ? LIMIT 1",
          [state]
        );
        if (inc) {
          avgSunHours = parseFloat(inc.avg_sun_hours) || 5.0;
          avgKwhCost = parseFloat(inc.avg_electricity_cost) || 0.13;
        }
      }
    } catch { /* non-blocking */ }

    const finalScore = scoreLead({
      isHomeowner: data.isHomeowner,
      monthlyBill: data.monthlyBill,
      roofSlope: data.roofSlope,
      shadingLevel: data.shadingLevel,
      isDecisionMaker: data.isDecisionMaker,
      state,
    });

    const estimate = estimateSolar(data.monthlyBill, state, avgSunHours, avgKwhCost);

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "";

    // Insert lead with raw SQL to avoid drizzle enum issues
    const { insertId: leadId } = await qExec(
      `INSERT INTO leads (
        first_name, last_name, email, phone, contact_preference,
        zip_code, city, state, is_homeowner, monthly_bill,
        roof_type, roof_slope, shading_level, is_decision_maker,
        estimated_system_kw, estimated_panels, estimated_monthly_savings,
        estimated_annual_savings, estimated_roi, preferred_financing,
        score, tier, status,
        utm_source, utm_medium, utm_campaign,
        ip_address, user_agent, referrer,
        consent_given, consent_text,
        webhook_sent
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        data.firstName, data.lastName, data.email, formatPhone(data.phone),
        data.contactPreference,
        data.zipCode, city ?? null, state ?? null,
        data.isHomeowner ? 1 : 0, data.monthlyBill,
        data.roofType ?? null, data.roofSlope ?? null, data.shadingLevel ?? null,
        (data.isDecisionMaker ?? true) ? 1 : 0,
        estimate.systemKw, estimate.panels, estimate.monthlySavings,
        estimate.annualSavings, estimate.roiYears,
        data.preferredFinancing ?? "undecided",
        finalScore.score, finalScore.tier, "new",
        data.utmSource ?? null, data.utmMedium ?? null, data.utmCampaign ?? null,
        ipAddress, userAgent, req.headers.get("referer") ?? "",
        data.consentGiven ? 1 : 0,
        "I consent to be contacted by SolarAdvisor about my solar estimate.",
        0,
      ]
    );

    // Log activity
    await db.insert(leadActivity).values({
      leadId,
      type: "created",
      description: `Lead created. Score: ${finalScore.score}/100, Tier: ${finalScore.tier}`,
      metadata: JSON.stringify({ scoreBreakdown: finalScore.breakdown }),
    });

    // Schedule drip
    const dripSchedule = getDripSchedule(finalScore.tier);
    if (dripSchedule.length > 0) {
      await db.insert(dripMessages).values(
        dripSchedule.map((item) => ({
          leadId,
          channel: item.channel as "sms" | "email",
          sequenceStep: item.step,
          scheduledAt: new Date(Date.now() + item.delayHours * 3600000),
        }))
      );
    }

    // Async: notify + webhook (don't block response)
    q1<Lead>("SELECT * FROM leads WHERE id = ? LIMIT 1", [leadId])
      .then((fullLead) => {
        if (!fullLead) return;
        const lead = fullLead as unknown as Lead;
        return Promise.all([
          notifyLeadReceived(lead),
          sendLeadWebhook(lead).then(async (wr) => {
            if (wr.success) {
              await qExec(
                "UPDATE leads SET webhook_sent=1, webhook_sent_at=NOW(), webhook_response=? WHERE id=?",
                [wr.response ?? "", leadId]
              );
              await db.insert(leadActivity).values({
                leadId,
                type: "webhook_sent",
                description: "Webhook delivered to partner",
              });
            }
          }),
        ]);
      })
      .catch(console.error);

    return NextResponse.json({
      success: true,
      leadId,
      tier: finalScore.tier,
      score: finalScore.score,
      estimate,
    });
  } catch (err) {
    console.error("[Lead API]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getDripSchedule(tier: "hot" | "medium" | "cold") {
  if (tier === "hot") return [
    { step: 1, delayHours: 1, channel: "sms" },
    { step: 2, delayHours: 24, channel: "email" },
    { step: 3, delayHours: 72, channel: "sms" },
  ];
  if (tier === "medium") return [
    { step: 1, delayHours: 2, channel: "email" },
    { step: 2, delayHours: 48, channel: "sms" },
    { step: 3, delayHours: 168, channel: "email" },
  ];
  return [
    { step: 1, delayHours: 24, channel: "email" },
    { step: 2, delayHours: 336, channel: "email" },
  ];
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ exists: false });
  try {
    const row = await q1("SELECT id FROM leads WHERE email = ? LIMIT 1", [email]);
    return NextResponse.json({ exists: !!row });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
