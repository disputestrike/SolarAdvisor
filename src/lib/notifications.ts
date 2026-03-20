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
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f5f0;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#FF8C00,#FFD700);padding:40px 32px;text-align:center;">
      <div style="font-size:32px;font-weight:900;color:#fff;letter-spacing:-1px;">☀ SolarAdvisor</div>
      <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:16px;">Your Expert Guide to Home Solar Savings</p>
    </div>
    <!-- Body -->
    <div style="padding:40px 32px;">
      <h1 style="font-size:28px;color:#1a1a1a;margin:0 0 16px;">Hi ${lead.firstName}, you're one step closer to energy freedom! 🌞</h1>
      <p style="color:#555;font-size:16px;line-height:1.7;margin:0 0 24px;">Based on your information, here's what we estimate for your home:</p>

      <div style="background:#fff9f0;border:2px solid #FFD700;border-radius:12px;padding:24px;margin:0 0 32px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
          <span style="color:#888;font-size:14px;">Estimated Monthly Savings</span>
          <span style="color:#FF8C00;font-size:20px;font-weight:700;">~$${savings}/mo</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
          <span style="color:#888;font-size:14px;">Federal Tax Credit (30%)</span>
          <span style="color:#22c55e;font-size:18px;font-weight:700;">Included</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#888;font-size:14px;">$0-Down Options</span>
          <span style="color:#22c55e;font-size:18px;font-weight:700;">Available</span>
        </div>
      </div>

      <p style="color:#555;font-size:16px;line-height:1.7;">A SolarAdvisor specialist will contact you at <strong>${lead.phone}</strong> within 24 hours with your full personalized proposal — at no cost or obligation.</p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="display:inline-block;background:linear-gradient(135deg,#FF8C00,#FFD700);color:#fff;font-size:16px;font-weight:700;padding:16px 40px;border-radius:50px;text-decoration:none;box-shadow:0 4px 16px rgba(255,140,0,0.4);">View Your Solar Estimate →</a>
      </div>
    </div>
    <!-- Footer -->
    <div style="background:#f5f5f5;padding:24px 32px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:12px;margin:0;">© 2024 SolarAdvisor. All rights reserved.<br>Reply to this email or call us to opt out of communications.</p>
    </div>
  </div>
</body>
</html>
  `;
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
