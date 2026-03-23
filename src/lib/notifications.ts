import { Resend } from "resend";
import type { Lead } from "@/db/schema";

// ─── Resend email client ──────────────────────────────────────────────────────
function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const FROM_NAME  = process.env.RESEND_FROM_NAME  || "SolarAdvisor";
const FROM       = `${FROM_NAME} <${FROM_EMAIL}>`;

// ─── Twilio SMS (optional) ────────────────────────────────────────────────────
async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
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
    return true;
  } catch (e) { console.error("[Email]", e); return false; }
}

// ─── Lead notifications ───────────────────────────────────────────────────────
export async function notifyLeadReceived(lead: Lead) {
  await sendEmail({
    to: lead.email,
    subject: `Your Solar Report is Ready ☀ — ${lead.firstName}`,
    html: getLeadWelcomeEmail(lead),
  });
  if (lead.phone && lead.contactPreference !== "email") {
    await sendSms(lead.phone, `Hi ${lead.firstName}! Your solar report is ready. A specialist will reach out within 24 hours. Reply STOP to opt out.`);
  }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (lead.tier === "hot" && adminEmail) {
    await sendEmail({ to: adminEmail, subject: `🔥 HOT LEAD: ${lead.firstName} ${lead.lastName} — Score ${lead.score}/100`, html: getAdminNotificationEmail(lead) });
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

// ─── Full solar report email ──────────────────────────────────────────────────
function getLeadWelcomeEmail(lead: Lead): string {
  const savings       = lead.estimatedMonthlySavings || 0;
  const annualSavings = savings * 12;
  const systemKw      = lead.estimatedSystemKw ? parseFloat(String(lead.estimatedSystemKw)) : 0;
  const installCost   = Math.round(systemKw * 1000 * 2.8);
  const netCost       = Math.round(installCost * 0.7);
  const taxCredit     = Math.round(installCost * 0.3);
  const r = 0.07 / 12, n = 300;
  const loanPayment   = systemKw > 0 ? Math.round((netCost * r * Math.pow(1+r,n)) / (Math.pow(1+r,n)-1)) : 0;
  const leasePayment  = Math.round(savings * 0.85);
  const roi25yr       = annualSavings * 25 - netCost;
  const appUrl        = process.env.NEXT_PUBLIC_APP_URL || "https://solaradvisor.com";
  const gcalUrl       = process.env.GCAL_BOOKING_URL || process.env.NEXT_PUBLIC_GCAL_BOOKING_URL || `${appUrl}/contact`;
  const address       = (lead as Lead & { formattedAddress?: string }).formattedAddress || `ZIP ${lead.zipCode}`;
  const mapsKey       = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const satelliteUrl  = lead.latitude && lead.longitude && mapsKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lead.latitude},${lead.longitude}&zoom=19&size=560x280&maptype=satellite&key=${mapsKey}`
    : null;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.10);">
  <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:32px;text-align:center;">
    <div style="font-size:26px;font-weight:800;color:#fff;">☀ ${FROM_NAME}</div>
    <p style="color:rgba(255,255,255,.6);margin:6px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:.1em;">Your Personal Solar Report</p>
  </div>
  <div style="background:linear-gradient(135deg,#ea580c,#fbbf24);padding:28px;text-align:center;">
    <p style="color:rgba(255,255,255,.85);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 6px;">Estimated Monthly Savings</p>
    <div style="font-size:48px;font-weight:900;color:#fff;line-height:1;">$${savings}/mo</div>
    <p style="color:rgba(255,255,255,.85);font-size:13px;margin:6px 0 0;">$${annualSavings.toLocaleString()}/year · $${(annualSavings*25).toLocaleString()} over 25 years</p>
  </div>
  <div style="padding:28px;">
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 20px;">Hi <strong>${lead.firstName}</strong>, here is your solar analysis for <strong>${address}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="text-align:center;padding:14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px 0 0 10px;">
          <div style="font-size:20px;font-weight:800;color:#ea580c;">${systemKw > 0 ? systemKw+" kW" : "—"}</div>
          <div style="font-size:10px;font-weight:700;color:#9a3412;text-transform:uppercase;margin-top:3px;">System Size</div>
        </td>
        <td style="text-align:center;padding:14px;background:#fff7ed;border:1px solid #fed7aa;border-left:none;">
          <div style="font-size:20px;font-weight:800;color:#ea580c;">${lead.estimatedPanels || "—"}</div>
          <div style="font-size:10px;font-weight:700;color:#9a3412;text-transform:uppercase;margin-top:3px;">Panels</div>
        </td>
        <td style="text-align:center;padding:14px;background:#fff7ed;border:1px solid #fed7aa;border-left:none;border-radius:0 10px 10px 0;">
          <div style="font-size:20px;font-weight:800;color:#ea580c;">${lead.estimatedRoi || "—"} yrs</div>
          <div style="font-size:10px;font-weight:700;color:#9a3412;text-transform:uppercase;margin-top:3px;">Payback</div>
        </td>
      </tr>
    </table>
    ${satelliteUrl ? `<p style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin:0 0 6px;">Your Roof · Satellite</p><div style="border-radius:10px;overflow:hidden;margin-bottom:20px;border:1px solid #e2e8f0;"><img src="${satelliteUrl}" alt="Satellite" style="width:100%;display:block;"/></div>` : ""}
    <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;margin-bottom:4px;">🏛️ Federal Incentive</div>
      <div style="font-size:15px;font-weight:700;color:#15803d;">30% Tax Credit — Save $${taxCredit.toLocaleString()}</div>
      <div style="font-size:12px;color:#166534;margin-top:3px;">Net cost after credit: $${netCost.toLocaleString()}</div>
    </div>
    <p style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px;">Financing Options</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="vertical-align:top;padding:12px;background:#fff7ed;border:2px solid #ea580c;border-radius:10px 0 0 10px;width:33%;">
          <div style="font-size:10px;font-weight:700;color:#ea580c;text-transform:uppercase;margin-bottom:4px;">$0-Down Lease</div>
          <div style="font-size:18px;font-weight:800;color:#0f172a;">$${leasePayment}/mo</div>
          <div style="font-size:11px;color:#64748b;margin-top:3px;">No upfront cost</div>
        </td>
        <td style="vertical-align:top;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-left:none;width:33%;">
          <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:4px;">Solar Loan</div>
          <div style="font-size:18px;font-weight:800;color:#0f172a;">~$${loanPayment}/mo</div>
          <div style="font-size:11px;color:#64748b;margin-top:3px;">Own it · keep ITC</div>
        </td>
        <td style="vertical-align:top;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-left:none;border-radius:0 10px 10px 0;width:33%;">
          <div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:4px;">Cash</div>
          <div style="font-size:18px;font-weight:800;color:#0f172a;">$${netCost.toLocaleString()}</div>
          <div style="font-size:11px;color:#64748b;margin-top:3px;">Best ROI · $${roi25yr>0?roi25yr.toLocaleString():"varies"} over 25yr</div>
        </td>
      </tr>
    </table>
    <div style="text-align:center;margin-bottom:20px;">
      <a href="${gcalUrl}" style="display:inline-block;background:linear-gradient(135deg,#ea580c,#fbbf24);color:#fff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:50px;text-decoration:none;">📅 Book Free Consultation</a>
    </div>
    <div style="background:#f8fafc;border-radius:10px;padding:16px;font-size:12px;color:#374151;">
      <p style="font-weight:700;color:#64748b;text-transform:uppercase;font-size:10px;letter-spacing:.08em;margin:0 0 8px;">What Happens Next</p>
      <p style="margin:0 0 5px;">📱 <strong>Within 24h</strong> — Specialist calls to confirm your estimate</p>
      <p style="margin:0 0 5px;">📋 <strong>Same day</strong> — Full proposal with exact financing emailed</p>
      <p style="margin:0 0 5px;">📅 <strong>Your pace</strong> — Optional on-site assessment, no obligation</p>
      <p style="margin:0;">⚡ <strong>4–8 weeks</strong> — Permit, install, power on</p>
    </div>
  </div>
  <div style="background:#f1f5f9;padding:18px 28px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6;">© ${year} ${FROM_NAME}. Preliminary estimate — specialist provides exact figures.<br>Reply to opt out of communications.</p>
  </div>
</div></body></html>`;
}

function getAdminNotificationEmail(lead: Lead): string {
  return `<div style="font-family:monospace;padding:20px;background:#0a0a0a;color:#00ff88;border-radius:8px;max-width:500px;">
  <h2 style="color:#FFD700;margin:0 0 16px;">🔥 HOT LEAD</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <tr><td style="padding:3px 0;color:#aaa;width:130px;">Name</td><td style="color:#fff;">${lead.firstName} ${lead.lastName}</td></tr>
    <tr><td style="padding:3px 0;color:#aaa;">Phone</td><td style="color:#00ff88;">${lead.phone}</td></tr>
    <tr><td style="padding:3px 0;color:#aaa;">Email</td><td style="color:#fff;">${lead.email}</td></tr>
    <tr><td style="padding:3px 0;color:#aaa;">Address</td><td style="color:#fff;">${(lead as Lead & { formattedAddress?: string }).formattedAddress || lead.zipCode}</td></tr>
    <tr><td style="padding:3px 0;color:#aaa;">Monthly Bill</td><td style="color:#FFD700;">$${lead.monthlyBill}/mo</td></tr>
    <tr><td style="padding:3px 0;color:#aaa;">Est. Savings</td><td style="color:#00ff88;">$${lead.estimatedMonthlySavings || 0}/mo</td></tr>
    <tr><td style="padding:3px 0;color:#aaa;">Score</td><td style="color:#FF8C00;font-weight:bold;font-size:15px;">${lead.score}/100</td></tr>
    <tr><td style="padding:3px 0;color:#aaa;">Financing</td><td style="color:#fff;">${lead.preferredFinancing || "—"}</td></tr>
  </table>
  <p style="color:#555;font-size:11px;margin-top:12px;">Lead #${lead.id} · ${new Date().toISOString()}</p>
</div>`;
}
