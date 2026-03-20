import type { Lead } from "@/db/schema";
import crypto from "crypto";

export interface WebhookPayload {
  event: "lead.created" | "lead.updated" | "lead.sold";
  timestamp: string;
  lead: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    zipCode: string;
    city?: string | null;
    state?: string | null;
    monthlyBill: number;
    score: number;
    tier: string;
    estimatedMonthlySavings?: number | null;
    preferredFinancing?: string | null;
    roofType?: string | null;
  };
}

export async function sendLeadWebhook(
  lead: Lead,
  event: WebhookPayload["event"] = "lead.created"
): Promise<{ success: boolean; response?: string }> {
  const url = process.env.PARTNER_WEBHOOK_URL;
  if (!url) return { success: false };

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    lead: {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      zipCode: lead.zipCode,
      city: lead.city,
      state: lead.state,
      monthlyBill: lead.monthlyBill,
      score: lead.score,
      tier: lead.tier,
      estimatedMonthlySavings: lead.estimatedMonthlySavings,
      preferredFinancing: lead.preferredFinancing,
      roofType: lead.roofType,
    },
  };

  const body = JSON.stringify(payload);

  // HMAC signature for verification
  const signature = process.env.PARTNER_WEBHOOK_SECRET
    ? crypto.createHmac("sha256", process.env.PARTNER_WEBHOOK_SECRET).update(body).digest("hex")
    : "";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SolarAdvisor-Signature": signature,
        "X-SolarAdvisor-Event": event,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    const responseText = await res.text().catch(() => "");
    return { success: res.ok, response: responseText };
  } catch (err) {
    console.error("[Webhook] Failed:", err);
    return { success: false };
  }
}
