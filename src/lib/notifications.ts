import twilio from "twilio";
import nodemailer from "nodemailer";
import type { Lead } from "@/db/schema";

// ─── Twilio SMS ───────────────────────────────────────────────────────────────
function getTwilioClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn("[SMS] Twilio credentials not configured");
    return null;
  }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  const client = getTwilioClient();
  if (!client) return false;

  try {
    await client.messages.create({
      body,
      to,
      from: process.env.TWILIO_PHONE_NUMBER!,
    });
    return true;
  } catch (err) {
    console.error("[SMS] Failed to send:", err);
    return false;
  }
}

// ─── Nodemailer Email ─────────────────────────────────────────────────────────
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  if (!process.env.SMTP_USER) {
    console.warn("[Email] SMTP not configured");
    return false;
  }
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || "SolarAdvisor <noreply@solaradvisor.com>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text || opts.html.replace(/<[^>]+>/g, ""),
    });
    return true;
  } catch (err) {
    console.error("[Email] Failed to send:", err);
    return false;
  }
}

// ─── Lead Notifications ───────────────────────────────────────────────────────
export async function notifyLeadReceived(lead: Lead) {
  const firstName = lead.firstName;
  const tier = lead.tier;

  // SMS to lead
  const smsBody = `Hi ${firstName}! Thanks for your interest in solar savings. A SolarAdvisor expert will contact you within 24 hours to share your personalized estimate. Reply STOP to opt out.`;
  if (lead.phone && (lead.contactPreference === "sms" || lead.contactPreference === "call")) {
    await sendSms(lead.phone, smsBody);
  }

  // Email to lead
  const leadEmailHtml = getLeadWelcomeEmail(lead);
  await sendEmail({
    to: lead.email,
    subject: "Your SolarAdvisor Estimate is Ready 🌞",
    html: leadEmailHtml,
  });

  // Admin notification for hot leads
  if (tier === "hot" && process.env.ADMIN_EMAIL) {
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `🔥 HOT LEAD: ${firstName} ${lead.lastName} - Score ${lead.score}`,
      html: getAdminNotificationEmail(lead),
    });
    if (process.env.ADMIN_PHONE) {
      await sendSms(
        process.env.ADMIN_PHONE,
        `🔥 HOT LEAD: ${firstName} ${lead.lastName} | ${lead.phone} | Bill: $${lead.monthlyBill}/mo | Score: ${lead.score}/100`
      );
    }
  }
}

// ─── Drip Sequences ───────────────────────────────────────────────────────────
export function getDripSchedule(tier: "hot" | "medium" | "cold") {
  if (tier === "hot") {
    return [
      { step: 1, delayHours: 1, channel: "sms" as const },
      { step: 2, delayHours: 24, channel: "email" as const },
      { step: 3, delayHours: 72, channel: "sms" as const },
    ];
  }
  if (tier === "medium") {
    return [
      { step: 1, delayHours: 2, channel: "email" as const },
      { step: 2, delayHours: 48, channel: "sms" as const },
      { step: 3, delayHours: 168, channel: "email" as const }, // 7 days
    ];
  }
  return [
    { step: 1, delayHours: 24, channel: "email" as const },
    { step: 2, delayHours: 336, channel: "email" as const }, // 14 days
  ];
}

// ─── Email Templates ──────────────────────────────────────────────────────────
function getLeadWelcomeEmail(lead: Lead): string {
  const savings = lead.estimatedMonthlySavings || 0;
  const annualSavings = savings * 12;
  const systemKw = lead.estimatedSystemKw ? parseFloat(String(lead.estimatedSystemKw)) : 0;
  const installCost = Math.round(systemKw * 1000 * 2.8);
  const netCost = Math.round(installCost * 0.7);
  const taxCredit = Math.round(installCost * 0.3);
  const loanPayment = systemKw > 0
    ? Math.round((netCost * (0.07 / 12) * Math.pow(1.07 / 12 + 1, 300)) / (Math.pow(0.07 / 12 + 1, 300) - 1))
    : 0;
  const leasePayment = Math.round(savings * 0.85);
  const roi25yr = annualSavings * 25 - netCost;
  const address = (lead as Lead & { formattedAddress?: string }).formattedAddress || `ZIP ${lead.zipCode}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://solaradvisor.com";
  // Google Calendar Appointment Scheduling — set GCAL_BOOKING_URL env var
  const gcalUrl = process.env.GCAL_BOOKING_URL || process.env.NEXT_PUBLIC_GCAL_BOOKING_URL || `${appUrl}/contact`;
  const satelliteUrl = lead.latitude && lead.longitude
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lead.latitude},${lead.longitude}&zoom=19&size=560x280&maptype=satellite&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`
    : null;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Solar Report — SolarAdvisor</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.10);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:36px 32px;text-align:center;">
    <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">☀ SolarAdvisor</div>
    <p style="color:rgba(255,255,255,0.65);margin:6px 0 0;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;">Your Personal Solar Report</p>
  </div>

  <!-- Savings hero -->
  <div style="background:linear-gradient(135deg,#ea580c,#fbbf24);padding:32px;text-align:center;">
    <p style="color:rgba(255,255,255,0.85);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 8px;">Estimated Monthly Savings</p>
    <div style="font-size:52px;font-weight:900;color:#fff;line-height:1;margin:0 0 8px;">$${savings}/mo</div>
    <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:0;">$${annualSavings.toLocaleString()}/year · $${(annualSavings * 25).toLocaleString()} over 25 years</p>
  </div>

  <div style="padding:32px;">
    <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 6px;">Hi <strong>${lead.firstName}</strong>,</p>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 28px;">
      Here is your personalized solar analysis for <strong>${address}</strong>. A SolarAdvisor specialist will reach out within 24 hours — or you can schedule directly below.
    </p>

    <!-- System specs -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
      <tr>
        <td style="text-align:center;padding:16px;background:#fff7ed;border-radius:10px 0 0 10px;border:1px solid #fed7aa;">
          <div style="font-size:22px;font-weight:800;color:#ea580c;">${systemKw > 0 ? systemKw + " kW" : "Custom"}</div>
          <div style="font-size:11px;font-weight:600;color:#9a3412;text-transform:uppercase;margin-top:4px;">System Size</div>
        </td>
        <td style="text-align:center;padding:16px;background:#fff7ed;border:1px solid #fed7aa;border-left:none;">
          <div style="font-size:22px;font-weight:800;color:#ea580c;">${lead.estimatedPanels || "—"}</div>
          <div style="font-size:11px;font-weight:600;color:#9a3412;text-transform:uppercase;margin-top:4px;">Panels</div>
        </td>
        <td style="text-align:center;padding:16px;background:#fff7ed;border-radius:0 10px 10px 0;border:1px solid #fed7aa;border-left:none;">
          <div style="font-size:22px;font-weight:800;color:#ea580c;">${lead.estimatedRoi || "—"} yrs</div>
          <div style="font-size:11px;font-weight:600;color:#9a3412;text-transform:uppercase;margin-top:4px;">Simple Payback</div>
        </td>
      </tr>
    </table>

    ${satelliteUrl ? `
    <!-- Satellite image -->
    <p style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">Your Roof · Satellite View</p>
    <div style="border-radius:10px;overflow:hidden;margin-bottom:28px;border:1px solid #e2e8f0;">
      <img src="${satelliteUrl}" alt="Satellite view of your property" style="width:100%;display:block;" />
    </div>` : ""}

    <!-- Federal incentive -->
    <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:18px 20px;margin-bottom:28px;">
      <div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">🏛️ Federal Incentive</div>
      <div style="font-size:16px;font-weight:700;color:#15803d;">30% Investment Tax Credit — Save $${taxCredit.toLocaleString()}</div>
      <div style="font-size:13px;color:#166534;margin-top:4px;">Applied to the $${installCost.toLocaleString()} system cost → net cost $${netCost.toLocaleString()}</div>
    </div>

    <!-- 3 financing options -->
    <p style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">Your Financing Options</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
      <tr>
        <td style="vertical-align:top;padding:16px;background:#fff7ed;border:2px solid #ea580c;border-radius:10px 0 0 10px;width:33%;">
          <div style="font-size:11px;font-weight:700;color:#ea580c;text-transform:uppercase;margin-bottom:8px;">$0-Down Lease</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;">$${leasePayment}/mo</div>
          <div style="font-size:11px;color:#64748b;margin-top:6px;line-height:1.5;">No upfront cost · saves day one · maintenance included</div>
        </td>
        <td style="vertical-align:top;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-left:none;width:33%;">
          <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:8px;">Solar Loan</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;">~$${loanPayment}/mo</div>
          <div style="font-size:11px;color:#64748b;margin-top:6px;line-height:1.5;">Own it · keep 30% tax credit · build equity</div>
        </td>
        <td style="vertical-align:top;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-left:none;border-radius:0 10px 10px 0;width:33%;">
          <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:8px;">Cash Purchase</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;">$${netCost.toLocaleString()}</div>
          <div style="font-size:11px;color:#64748b;margin-top:6px;line-height:1.5;">Best ROI · 25-yr return ~$${roi25yr > 0 ? roi25yr.toLocaleString() : "varies"}</div>
        </td>
      </tr>
    </table>

    <!-- CTA buttons -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${gcalUrl}" style="display:inline-block;background:linear-gradient(135deg,#ea580c,#fbbf24);color:#fff;font-size:16px;font-weight:700;padding:16px 36px;border-radius:50px;text-decoration:none;box-shadow:0 4px 16px rgba(234,88,12,0.4);margin-bottom:12px;">
        📅 Book Free Consultation — Google Calendar
      </a>
      <br>
      <a href="${appUrl}/funnel" style="display:inline-block;color:#ea580c;font-size:14px;font-weight:600;text-decoration:underline;">
        Or start a new estimate →
      </a>
    </div>

    <!-- What happens next -->
    <div style="background:#f8fafc;border-radius:10px;padding:20px;margin-bottom:8px;">
      <p style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">What Happens Next</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;vertical-align:top;width:80px;color:#ea580c;font-size:12px;font-weight:700;">Within 24h</td><td style="padding:6px 0;font-size:13px;color:#374151;">A solar specialist calls to confirm your estimate and answer questions</td></tr>
        <tr><td style="padding:6px 0;vertical-align:top;color:#ea580c;font-size:12px;font-weight:700;">Same day</td><td style="padding:6px 0;font-size:13px;color:#374151;">Full proposal with exact financing options emailed to you</td></tr>
        <tr><td style="padding:6px 0;vertical-align:top;color:#ea580c;font-size:12px;font-weight:700;">At your pace</td><td style="padding:6px 0;font-size:13px;color:#374151;">Optional on-site assessment for exact measurements — no obligation</td></tr>
        <tr><td style="padding:6px 0;vertical-align:top;color:#ea580c;font-size:12px;font-weight:700;">4–8 weeks</td><td style="padding:6px 0;font-size:13px;color:#374151;">If you proceed: permit, install, inspection, permission to operate</td></tr>
      </table>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#f1f5f9;padding:24px 32px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.6;">
      © ${year} SolarAdvisor. This estimate is preliminary — your specialist will provide an exact quote.<br>
      <a href="${appUrl}" style="color:#ea580c;text-decoration:none;">solaradvisor.com</a> ·
      Reply to this email or text STOP to opt out.
    </p>
  </div>
</div>
</body>
</html>`;
}

function getAdminNotificationEmail(lead: Lead): string {
  return `
<div style="font-family:monospace;padding:20px;background:#0a0a0a;color:#00ff88;border-radius:8px;">
  <h2 style="color:#FFD700;">🔥 HOT LEAD ALERT</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:4px 0;color:#aaa;">Name:</td><td style="color:#fff;">${lead.firstName} ${lead.lastName}</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">Phone:</td><td style="color:#00ff88;">${lead.phone}</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">Email:</td><td style="color:#fff;">${lead.email}</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">ZIP:</td><td style="color:#fff;">${lead.zipCode} (${lead.city || ""}, ${lead.state || ""})</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">Monthly Bill:</td><td style="color:#FFD700;">$${lead.monthlyBill}/mo</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">Score:</td><td style="color:#FF8C00;font-size:18px;font-weight:bold;">${lead.score}/100</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">Preferred Contact:</td><td style="color:#fff;">${lead.contactPreference}</td></tr>
    <tr><td style="padding:4px 0;color:#aaa;">Financing Interest:</td><td style="color:#fff;">${lead.preferredFinancing}</td></tr>
  </table>
  <p style="color:#aaa;margin-top:16px;">Lead ID: #${lead.id} | Created: ${new Date().toISOString()}</p>
</div>
  `;
}
