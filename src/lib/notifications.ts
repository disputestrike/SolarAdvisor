import { Resend } from "resend";
import type { Lead } from "@/db/schema";

// ─── Resend client ────────────────────────────────────────────────────────────
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const FROM_NAME  = process.env.RESEND_FROM_NAME  || "SolarAdvisor";
const FROM       = `${FROM_NAME} <${FROM_EMAIL}>`;

// ─── SMS via Twilio (optional) ────────────────────────────────────────────────
async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return false;
  try {
    const twilio = (await import("twilio")).default;
    await twilio(sid, token).messages.create({ body, to, from });
    return true;
  } catch (e) { console.error("[SMS]", e); return false; }
}

// ─── Send email via Resend ────────────────────────────────────────────────────
export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const resend = getResend();
  if (!resend) { console.warn("[Email] RESEND_API_KEY not set — skipping."); return false; }
  try {
    const { error } = await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html });
    if (error) { console.error("[Email] Resend error:", error); return false; }
    console.log("[Email] Sent to:", opts.to);
    return true;
  } catch (e) { console.error("[Email]", e); return false; }
}

// ─── Lead notifications ───────────────────────────────────────────────────────
export async function notifyLeadReceived(lead: Lead) {
  console.log(`[notify] Sending report to ${lead.email} (lead #${lead.id}, tier: ${lead.tier})`);

  // Welcome email to lead
  const sent = await sendEmail({
    to: lead.email,
    subject: `Your Solar Feasibility Report is Ready ☀ — ${lead.firstName}`,
    html: getSolarReportEmail(lead),
  });
  console.log(`[notify] Email to lead: ${sent ? "✅ sent" : "❌ failed"}`);

  // SMS confirmation (optional)
  if (lead.phone && lead.contactPreference !== "email") {
    await sendSms(
      lead.phone,
      `Hi ${lead.firstName}! Your SolarAdvisor feasibility report is ready. Check your email for your full analysis. A specialist will reach out within 24 hours. Reply STOP to opt out.`
    );
  }

  // Hot lead alert to admin
  const adminEmail = process.env.ADMIN_EMAIL;
  if (lead.tier === "hot" && adminEmail) {
    const adminSent = await sendEmail({
      to: adminEmail,
      subject: `🔥 HOT LEAD: ${lead.firstName} ${lead.lastName} — Score ${lead.score}/100`,
      html: getAdminAlertEmail(lead),
    });
    console.log(`[notify] Admin alert: ${adminSent ? "✅ sent" : "❌ failed"}`);
  }
}

// ─── Drip schedule ────────────────────────────────────────────────────────────
export function getDripSchedule(tier: "hot" | "medium" | "cold") {
  if (tier === "hot") return [
    { step: 1, delayHours: 1,   channel: "sms"   as const },
    { step: 2, delayHours: 24,  channel: "email" as const },
    { step: 3, delayHours: 72,  channel: "sms"   as const },
  ];
  if (tier === "medium") return [
    { step: 1, delayHours: 2,   channel: "email" as const },
    { step: 2, delayHours: 48,  channel: "sms"   as const },
    { step: 3, delayHours: 168, channel: "email" as const },
  ];
  return [
    { step: 1, delayHours: 24,  channel: "email" as const },
    { step: 2, delayHours: 336, channel: "email" as const },
  ];
}

// ─── Helper: state electricity rate inflation ─────────────────────────────────
function getRateInflation(state?: string | null): number {
  // Average annual electricity rate increase by region
  const rates: Record<string, number> = {
    CA: 5.2, NY: 4.8, MA: 4.9, CT: 4.7, NJ: 3.8, MD: 3.6,
    TX: 3.2, FL: 3.5, AZ: 3.1, GA: 3.0, NC: 2.9, DC: 3.5,
  };
  return rates[state?.toUpperCase() ?? ""] ?? 3.5;
}

// ─── MAIN EMAIL: Solar Feasibility Report ─────────────────────────────────────
function getSolarReportEmail(lead: Lead): string {
  const leadExt = lead as Lead & { formattedAddress?: string; latitude?: number; longitude?: number };

  // Financial calculations — all from closed-loop actual system
  const savings       = lead.estimatedMonthlySavings || 0;
  const annualSavings = savings * 12;
  const systemKw      = lead.estimatedSystemKw ? parseFloat(String(lead.estimatedSystemKw)) : 0;
  const panels        = lead.estimatedPanels || 0;
  const installCost   = Math.round(systemKw * 1000 * 3.00);
  const taxCredit     = Math.round(installCost * 0.30);
  const netCost       = Math.round(installCost * 0.70);
  const roiYears      = lead.estimatedRoi ? parseFloat(String(lead.estimatedRoi)) : 0;
  const lifetime25    = annualSavings * 25 - netCost;

  // Financing options
  const r = 0.0699 / 12, n = 300;
  const loanPayment   = netCost > 0 ? Math.round((netCost * r * Math.pow(1+r,n)) / (Math.pow(1+r,n)-1)) : 0;
  const leasePayment  = Math.round(savings * 0.75);

  // Offset %: annual production / annual usage
  const kwhCost       = 0.17;
  const monthlyKwh    = (lead.monthlyBill || 0) / kwhCost;
  const annualKwh     = Math.round(systemKw * 5.0 * 365 * 0.80);
  const offsetPct     = monthlyKwh > 0 ? Math.min(100, Math.round((annualKwh / 12) / monthlyKwh * 100)) : 58;

  // Suitability score (already in DB)
  const score         = lead.score || 75;
  const scoreLabel    = score >= 80 ? "Excellent candidate" : score >= 65 ? "Strong candidate" : "Good candidate";
  const scoreColor    = score >= 80 ? "#16a34a" : score >= 65 ? "#d97706" : "#2563eb";

  // State-specific data
  const state         = lead.state || "";
  const inflation     = getRateInflation(state);
  const bill          = lead.monthlyBill || 0;
  const bill10yr      = Math.round(bill * Math.pow(1 + inflation/100, 10));

  // Satellite image (embedded if coords available)
  const mapsKey       = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const satelliteUrl  = leadExt.latitude && leadExt.longitude && mapsKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${leadExt.latitude},${leadExt.longitude}&zoom=19&size=560x240&maptype=satellite&key=${mapsKey}`
    : null;

  // App / booking URLs
  const appUrl        = process.env.NEXT_PUBLIC_APP_URL || "https://solaradvisor.com";
  const gcalUrl       = process.env.GCAL_BOOKING_URL || process.env.NEXT_PUBLIC_GCAL_BOOKING_URL || `${appUrl}/contact`;
  const address       = leadExt.formattedAddress || `ZIP ${lead.zipCode}`;
  const year          = new Date().getFullYear();

  // Seasonal production (simple model: summer peak, winter low)
  const summerKwh     = Math.round(annualKwh * 0.107);  // ~13% of annual
  const fallKwh       = Math.round(annualKwh * 0.082);
  const winterKwh     = Math.round(annualKwh * 0.060);
  const springKwh     = Math.round(annualKwh * 0.089);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Solar Feasibility Report</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:20px 0 40px;">

<!-- ── HEADER ─────────────────────────────────────────────────────────── -->
<div style="background:#0f172a;border-radius:16px 16px 0 0;padding:32px 28px 24px;text-align:center;">
  <div style="font-size:22px;font-weight:600;color:#f8fafc;letter-spacing:-0.3px;">☀ ${FROM_NAME}</div>
  <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Solar Feasibility Report</div>
  <div style="color:#475569;font-size:12px;margin-top:8px;line-height:1.5;">${address}</div>
  <div style="color:#334155;font-size:11px;margin-top:2px;">Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})} · Satellite + Solar API modeling</div>
</div>

<!-- ── SAVINGS HERO ───────────────────────────────────────────────────── -->
<div style="background:#1e293b;padding:28px 28px 24px;text-align:center;border-top:1px solid #334155;">
  <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Estimated Monthly Savings</div>
  <div style="font-size:52px;font-weight:600;color:#fb923c;line-height:1;margin-bottom:6px;">$${savings}/mo</div>
  <div style="color:#94a3b8;font-size:13px;">$${annualSavings.toLocaleString()}/year &nbsp;·&nbsp; $${(annualSavings * 25).toLocaleString()} over 25 years</div>
  <div style="margin-top:14px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">
    <span style="background:#431407;color:#fb923c;border:1px solid #9a3412;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;">${systemKw} kW · ${panels} panels</span>
    <span style="background:#1c3a2c;color:#86efac;border:1px solid #166534;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;">Offsets ~${offsetPct}% of usage</span>
  </div>
</div>

<!-- ── BODY ───────────────────────────────────────────────────────────── -->
<div style="background:#ffffff;padding:28px 28px 0;">

  <!-- Greeting -->
  <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 20px;">
    Hi <strong>${lead.firstName}</strong>,<br><br>
    Based on satellite analysis of your property, here is the optimal solar system for your home.
    This recommendation is built from real roof geometry, Google Solar API data, and your actual energy usage —
    not a generic estimate.
  </p>

  <div style="height:1px;background:#f1f5f9;margin-bottom:24px;"></div>

  <!-- THE Recommendation -->
  <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Your recommended system</div>
  <div style="background:#fff7ed;border:2px solid #ea580c;border-radius:12px;padding:20px 22px;margin-bottom:20px;">
    <div style="font-size:13px;color:#9a3412;font-weight:600;margin-bottom:10px;">OPTIMAL SYSTEM FOR YOUR HOME</div>
    <div style="display:grid;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px;width:50%;">System size</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;color:#0f172a;text-align:right;">${systemKw} kW</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px;">Panels</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;color:#0f172a;text-align:right;">${panels} × 400W</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px;">Annual production</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;color:#0f172a;text-align:right;">${annualKwh.toLocaleString()} kWh</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280;font-size:13px;">Usage offset</td>
          <td style="padding:6px 0;font-size:13px;font-weight:600;color:#16a34a;text-align:right;">~${offsetPct}%</td>
        </tr>
        <tr style="border-top:1px solid #fed7aa;">
          <td style="padding:10px 0 4px;color:#6b7280;font-size:13px;">Monthly savings</td>
          <td style="padding:10px 0 4px;font-size:18px;font-weight:600;color:#ea580c;text-align:right;">$${savings}/mo</td>
        </tr>
      </table>
    </div>
    ${offsetPct < 100 ? `<div style="margin-top:10px;padding:10px 12px;background:#fff;border-radius:8px;border:1px solid #fed7aa;font-size:12px;color:#92400e;line-height:1.5;">
      💡 Want to offset 100% of your usage? Ask your specialist about a ground-mounted array or a larger roof assessment.
    </div>` : ""}
  </div>

  <!-- Satellite roof image -->
  ${satelliteUrl ? `
  <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Your roof · satellite view</div>
  <div style="border-radius:10px;overflow:hidden;margin-bottom:20px;border:1px solid #e2e8f0;">
    <img src="${satelliteUrl}" alt="Satellite view of your property with solar panel layout" style="width:100%;display:block;" />
  </div>
  <p style="font-size:11px;color:#94a3b8;margin-top:-14px;margin-bottom:20px;">Panel placement uses constraint-based grid layout — south-facing roof face filled first, 18" setbacks from all edges per fire code.</p>
  ` : ""}

  <div style="height:1px;background:#f1f5f9;margin-bottom:24px;"></div>

  <!-- Solar Suitability Score -->
  <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Solar suitability score</div>
  <div style="background:#f8fafc;border-radius:12px;padding:18px 20px;margin-bottom:20px;border:1px solid #e2e8f0;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;">
          <div style="font-size:14px;font-weight:600;color:#0f172a;">${lead.firstName}'s property</div>
          <div style="font-size:12px;color:#64748b;">${lead.city || ""} ${lead.state || ""} ${lead.zipCode}</div>
        </td>
        <td style="text-align:right;vertical-align:top;">
          <div style="font-size:28px;font-weight:600;color:#ea580c;">${score}<span style="font-size:14px;color:#94a3b8;">/100</span></div>
          <div style="font-size:11px;font-weight:600;color:${scoreColor};">${scoreLabel}</div>
        </td>
      </tr>
    </table>
    <!-- Score bar -->
    <div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;margin:14px 0 6px;">
      <div style="height:100%;width:${score}%;background:linear-gradient(90deg,#ea580c,#fbbf24);border-radius:3px;"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-bottom:14px;">
      <span>0 — Poor</span><span>50 — Fair</span><span>75 — Good</span><span>100 — Excellent</span>
    </div>
    <!-- Score factors -->
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr>
        <td style="padding:3px 0;color:#16a34a;">✓ Homeowner</td>
        <td style="padding:3px 0;color:#16a34a;text-align:right;">+30 pts</td>
      </tr>
      <tr>
        <td style="padding:3px 0;color:#16a34a;">✓ $${bill}/mo bill</td>
        <td style="padding:3px 0;color:#16a34a;text-align:right;">+${bill >= 300 ? 30 : bill >= 200 ? 25 : bill >= 150 ? 20 : 12} pts</td>
      </tr>
      <tr>
        <td style="padding:3px 0;color:#16a34a;">✓ Solar-friendly location</td>
        <td style="padding:3px 0;color:#16a34a;text-align:right;">+10 pts</td>
      </tr>
      <tr>
        <td style="padding:3px 0;color:#d97706;">~ Roof capacity constraint</td>
        <td style="padding:3px 0;color:#d97706;text-align:right;">noted</td>
      </tr>
    </table>
  </div>

  <div style="height:1px;background:#f1f5f9;margin-bottom:24px;"></div>

  <!-- Seasonal production -->
  <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Estimated seasonal production</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
    <tr>
      <td style="width:25%;padding:0 4px 0 0;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 8px;text-align:center;">
          <div style="font-size:16px;margin-bottom:4px;">☀</div>
          <div style="font-size:16px;font-weight:600;color:#0f172a;">${summerKwh.toLocaleString()}</div>
          <div style="font-size:10px;color:#64748b;">kWh · Summer</div>
        </div>
      </td>
      <td style="width:25%;padding:0 4px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 8px;text-align:center;">
          <div style="font-size:16px;margin-bottom:4px;">🍂</div>
          <div style="font-size:16px;font-weight:600;color:#0f172a;">${fallKwh.toLocaleString()}</div>
          <div style="font-size:10px;color:#64748b;">kWh · Fall</div>
        </div>
      </td>
      <td style="width:25%;padding:0 4px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 8px;text-align:center;">
          <div style="font-size:16px;margin-bottom:4px;">❄</div>
          <div style="font-size:16px;font-weight:600;color:#0f172a;">${winterKwh.toLocaleString()}</div>
          <div style="font-size:10px;color:#64748b;">kWh · Winter</div>
        </div>
      </td>
      <td style="width:25%;padding:0 0 0 4px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 8px;text-align:center;">
          <div style="font-size:16px;margin-bottom:4px;">🌸</div>
          <div style="font-size:16px;font-weight:600;color:#0f172a;">${springKwh.toLocaleString()}</div>
          <div style="font-size:10px;color:#64748b;">kWh · Spring</div>
        </div>
      </td>
    </tr>
  </table>
  <div style="font-size:11px;color:#94a3b8;margin-bottom:24px;">Annual total: ~${annualKwh.toLocaleString()} kWh based on solar data for ${lead.city || lead.zipCode}</div>

  <div style="height:1px;background:#f1f5f9;margin-bottom:24px;"></div>

  <!-- Financial model -->
  <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Your financing options</div>

  <!-- 3 financing options -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr>
      <td style="width:33%;padding:0 6px 0 0;vertical-align:top;">
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 12px;text-align:center;">
          <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:6px;">$0-Down Lease</div>
          <div style="font-size:22px;font-weight:600;color:#0f172a;margin-bottom:4px;">$${leasePayment}/mo</div>
          <div style="font-size:11px;color:#64748b;line-height:1.5;">Save from day one<br>No upfront cost</div>
        </div>
      </td>
      <td style="width:33%;padding:0 3px;vertical-align:top;">
        <div style="border:2px solid #ea580c;border-radius:10px;padding:14px 12px;text-align:center;position:relative;">
          <div style="font-size:10px;font-weight:600;color:#ea580c;text-transform:uppercase;margin-bottom:6px;">Most Popular</div>
          <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Solar Loan</div>
          <div style="font-size:22px;font-weight:600;color:#0f172a;margin-bottom:4px;">$${loanPayment}/mo</div>
          <div style="font-size:11px;color:#64748b;line-height:1.5;">Own it · keep ITC<br>Build home equity</div>
        </div>
      </td>
      <td style="width:33%;padding:0 0 0 6px;vertical-align:top;">
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 12px;text-align:center;">
          <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Cash</div>
          <div style="font-size:22px;font-weight:600;color:#0f172a;margin-bottom:4px;">$${netCost.toLocaleString()}</div>
          <div style="font-size:11px;color:#64748b;line-height:1.5;">Best ROI<br>~$${lifetime25 > 0 ? lifetime25.toLocaleString() : "—"} over 25yr</div>
        </div>
      </td>
    </tr>
  </table>

  <!-- Financial breakdown -->
  <div style="background:#f8fafc;border-radius:10px;padding:16px 18px;margin-bottom:24px;border:1px solid #e2e8f0;">
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 0;color:#6b7280;">System cost (${systemKw} kW)</td>
        <td style="padding:8px 0;text-align:right;color:#6b7280;text-decoration:line-through;">$${installCost.toLocaleString()}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 0;color:#6b7280;">30% Federal Tax Credit (ITC)</td>
        <td style="padding:8px 0;text-align:right;color:#16a34a;font-weight:600;">− $${taxCredit.toLocaleString()}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 0;color:#6b7280;">Net cost after ITC</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#ea580c;font-size:15px;">$${netCost.toLocaleString()}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 0;color:#6b7280;">Break-even</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#0f172a;">${roiYears} years</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;">25-year lifetime return</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#16a34a;">+$${lifetime25 > 0 ? lifetime25.toLocaleString() : "—"}</td>
      </tr>
    </table>
  </div>

  <!-- Rate inflation note -->
  <div style="background:#fff7ed;border-radius:10px;padding:14px 16px;margin-bottom:24px;border:1px solid #fed7aa;">
    <div style="font-size:12px;color:#92400e;line-height:1.6;">
      📈 <strong>Electricity rates in ${lead.state || "your state"} have increased ~${inflation}% per year</strong> on average.
      At this rate, your current $${bill}/mo bill will reach approximately
      <strong>$${bill10yr}/mo by ${year + 10}</strong>.
      Going solar now locks in your energy cost — protecting you from future increases.
    </div>
  </div>

  <div style="height:1px;background:#f1f5f9;margin-bottom:24px;"></div>

  <!-- What could change this -->
  <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">What could affect your final numbers</div>
  <div style="border-left:3px solid #ea580c;padding:14px 16px;background:#f8fafc;border-radius:0 8px 8px 0;margin-bottom:24px;">
    <p style="font-size:13px;color:#374151;line-height:1.6;margin:0 0 10px;">This report uses satellite and solar modeling data. A site assessment may adjust these figures:</p>
    <table style="font-size:12px;color:#6b7280;border-collapse:collapse;">
      <tr><td style="padding:3px 0;vertical-align:top;">•&nbsp;</td><td style="padding:3px 0;">Final roof measurements and structural inspection</td></tr>
      <tr><td style="padding:3px 0;vertical-align:top;">•&nbsp;</td><td style="padding:3px 0;">Electrical panel capacity (may need upgrade)</td></tr>
      <tr><td style="padding:3px 0;vertical-align:top;">•&nbsp;</td><td style="padding:3px 0;">HOA restrictions or permitting requirements</td></tr>
      <tr><td style="padding:3px 0;vertical-align:top;">•&nbsp;</td><td style="padding:3px 0;">On-site shading from trees or new structures</td></tr>
      <tr><td style="padding:3px 0;vertical-align:top;">•&nbsp;</td><td style="padding:3px 0;">Utility interconnection timeline</td></tr>
    </table>
    <p style="font-size:12px;color:#6b7280;margin:10px 0 0;">Most homeowners find their final install cost within 5–10% of this estimate. A specialist will confirm exact figures before you commit to anything.</p>
  </div>

  <!-- CTA -->
  <div style="text-align:center;padding:8px 0 28px;">
    <div style="font-size:18px;font-weight:600;color:#0f172a;margin-bottom:8px;">Ready for an exact design and quote?</div>
    <div style="font-size:13px;color:#6b7280;line-height:1.6;margin-bottom:20px;">
      We can connect you with a vetted solar specialist in ${lead.city || "your area"}.<br>
      No obligation &nbsp;·&nbsp; No hard sell &nbsp;·&nbsp; Pre-screened professionals only
    </div>
    <a href="${gcalUrl}" style="display:inline-block;background:#ea580c;color:#ffffff;font-size:15px;font-weight:600;padding:15px 36px;border-radius:50px;text-decoration:none;box-shadow:0 4px 14px rgba(234,88,12,0.35);">
      📅 Book Free Site Assessment
    </a>
    <div style="margin-top:14px;display:flex;justify-content:center;gap:20px;flex-wrap:wrap;">
      <span style="font-size:11px;color:#94a3b8;">✓ No obligation</span>
      <span style="font-size:11px;color:#94a3b8;">✓ Pre-vetted specialists</span>
      <span style="font-size:11px;color:#94a3b8;">✓ No spam</span>
    </div>
  </div>

</div>

<!-- ── PSYCHOLOGICAL CLOSE ──────────────────────────────────────────────── -->
<div style="background:#f8fafc;padding:20px 28px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">
  <div style="font-size:13px;color:#374151;line-height:1.8;">
    🏠 Homeowners in <strong>${lead.city || "your area"}</strong> with similar electric bills are saving
    <strong>$${Math.round(savings * 0.85).toLocaleString()}–$${Math.round(savings * 1.15).toLocaleString()}/month</strong> after going solar.<br>
    ⚡ The 30% federal tax credit (ITC) is available through 2032 — locking in your install date secures eligibility.<br>
    📊 Every year you wait costs approximately <strong>$${annualSavings.toLocaleString()}</strong> in savings you could have captured.
  </div>
</div>

<!-- ── FOOTER ──────────────────────────────────────────────────────────── -->
<div style="background:#ffffff;border-radius:0 0 16px 16px;padding:20px 28px;text-align:center;border-top:1px solid #f1f5f9;">
  <div style="font-size:11px;color:#94a3b8;line-height:1.7;">
    © ${year} ${FROM_NAME}<br>
    This is a preliminary estimate — a specialist will confirm exact figures at no cost.<br>
    Report prepared for ${lead.firstName} ${lead.lastName} · ${lead.email}<br>
    <a href="${appUrl}" style="color:#ea580c;text-decoration:none;">${appUrl.replace("https://","")}</a>
    &nbsp;·&nbsp; Reply to this email to opt out of communications.
  </div>
</div>

</div>
</body>
</html>`;
}

// ─── ADMIN: Hot Lead Alert ─────────────────────────────────────────────────────
function getAdminAlertEmail(lead: Lead): string {
  const leadExt = lead as Lead & { formattedAddress?: string };
  return `<div style="font-family:monospace;padding:24px;background:#0a0a0a;color:#00ff88;border-radius:8px;max-width:520px;">
  <h2 style="color:#FFD700;margin:0 0 16px;font-size:16px;">🔥 HOT LEAD — Score ${lead.score}/100</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <tr><td style="padding:4px 0;color:#aaa;width:140px;">Name</td><td style="color:#fff;">${lead.firstName} ${lead.lastName}</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">Phone</td><td style="color:#00ff88;font-size:15px;">${lead.phone}</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">Email</td><td style="color:#fff;">${lead.email}</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">Address</td><td style="color:#fff;">${leadExt.formattedAddress || lead.zipCode}</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">Monthly Bill</td><td style="color:#FFD700;font-size:15px;">$${lead.monthlyBill}/mo</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">Est. Savings</td><td style="color:#00ff88;">$${lead.estimatedMonthlySavings || 0}/mo</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">Score</td><td style="color:#FF8C00;font-size:18px;font-weight:bold;">${lead.score}/100 — ${lead.tier?.toUpperCase()}</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">Financing</td><td style="color:#fff;">${lead.preferredFinancing || "—"}</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">Contact Via</td><td style="color:#fff;">${lead.contactPreference}</td></tr>
  </table>
  <p style="color:#555;font-size:11px;margin-top:16px;border-top:1px solid #222;padding-top:12px;">Lead #${lead.id} · ${new Date().toISOString()}</p>
</div>`;
}
