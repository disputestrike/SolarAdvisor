import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are Alex, a friendly and knowledgeable solar advisor for SolarAdvisor. Your job is to help homeowners understand solar savings, answer questions, and guide them toward getting a free personalized estimate.

PERSONALITY: Warm, expert, conversational. Never pushy. Always helpful.

CORE KNOWLEDGE:
- Federal Solar Tax Credit: 30% ITC (Investment Tax Credit) through 2032
- Average installation: $2.50–$3.50/watt before incentives
- Average payback period: 6–10 years
- Solar panels last 25–30 years, warranted for 25 years
- Net metering: sell excess power back to grid in most states
- $0-down options: lease or PPA (Power Purchase Agreement)
- Typical savings: 70–90% reduction in electricity bills
- Home value increase: 4–6% with solar (NREL study)

INSTANT QUOTE LOGIC:
If someone gives you their monthly bill, calculate:
- Monthly savings = bill × 0.9 (90% reduction estimate)
- System size = roughly 1kW per $30/month of bill
- Panels needed = system kW × 2.5 (400W panels)
- Install cost = system kW × $3,000
- After 30% ITC = install cost × 0.70
- Monthly lease = monthly savings × 0.85 (saves immediately)

Always end responses by encouraging them to get their FREE full estimate at the funnel. Keep responses under 120 words unless they ask a detailed question. Never make up specific numbers for their exact address — always frame as estimates.`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ─── Anthropic Claude for chat ────────────────────────────────────────────────
async function streamChatResponse(
  messages: Message[],
  userMessage: string
): Promise<ReadableStream> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const allMessages = [
    ...messages,
    { role: "user" as const, content: userMessage },
  ];

  if (!apiKey) {
    // Fallback: rule-based instant responses when no API key
    return generateRuleBasedResponse(userMessage);
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: allMessages.slice(-10), // last 10 messages for context
      stream: true,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok || !res.body) {
    return generateRuleBasedResponse(userMessage);
  }

  // Stream SSE → text chunks
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                if (parsed.type === "content_block_delta") {
                  const text = parsed.delta?.text || "";
                  if (text) {
                    controller.enqueue(encoder.encode(text));
                  }
                }
              } catch { /* skip malformed */ }
            }
          }
        }
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });
}

// ─── Rule-based fallback (no API key needed) ──────────────────────────────────
function generateRuleBasedResponse(message: string): ReadableStream {
  const lower = message.toLowerCase();
  const encoder = new TextEncoder();

  let response = "";

  // Extract bill amount if mentioned
  const billMatch = message.match(/\$?(\d+)\s*(\/mo|a month|per month|monthly)?/i);
  const bill = billMatch ? parseInt(billMatch[1]) : null;

  if (bill && bill >= 50 && bill <= 2000) {
    const savings = Math.round(bill * 0.9);
    const systemKw = Math.round(bill / 30 * 10) / 10;
    const panels = Math.ceil(systemKw * 2.5);
    const lease = Math.round(savings * 0.85);
    response = `Great news! With a $${bill}/month bill, here's your quick estimate:\n\n☀ **${systemKw} kW system** (${panels} panels)\n💰 **Save ~$${savings}/month** (90% reduction)\n🚀 **$0-down lease: $${lease}/mo** — you save from day one\n🏛 **30% federal tax credit** applies if you finance\n\nWant your full personalized report? It takes 60 seconds and shows exact numbers for your address → [Get Free Estimate](/funnel)`;
  } else if (lower.includes("cost") || lower.includes("price") || lower.includes("how much")) {
    response = `Solar typically costs $2.50–$3.50/watt installed. A typical 8kW home system runs $20,000–$28,000 before the **30% federal tax credit** — bringing it to $14,000–$19,600.\n\nBut with $0-down lease options, you pay nothing upfront and start saving immediately. What's your monthly electric bill? I can give you a sharper estimate!`;
  } else if (lower.includes("tax") || lower.includes("credit") || lower.includes("incentive")) {
    response = `The **30% Federal Investment Tax Credit (ITC)** is available through 2032 — it's the biggest solar incentive available. If your system costs $25,000, you save $7,500 on your federal taxes.\n\nMany states also have additional rebates on top of that. What state are you in? I can check your local incentives!`;
  } else if (lower.includes("roof") || lower.includes("shading") || lower.includes("work")) {
    response = `Solar works on most roof types — asphalt shingle, tile, metal, even flat roofs. The ideal is a south-facing roof with minimal shading.\n\nEven with partial shading, modern microinverters and optimizers can maximize output panel by panel. Want me to check what your roof could produce? Start with your ZIP code → [Get Free Estimate](/funnel)`;
  } else if (lower.includes("lease") || lower.includes("loan") || lower.includes("finance") || lower.includes("pay")) {
    response = `Three ways to go solar:\n\n🚀 **$0-Down Lease** — No upfront cost, monthly payment less than your current bill, maintenance included\n💳 **Solar Loan** — Own it, keep the 30% tax credit, build equity\n💰 **Cash Purchase** — Best long-term ROI, full ownership from day one\n\nWhich fits your situation best? I can break down the numbers for each!`;
  } else if (lower.includes("save") || lower.includes("saving")) {
    response = `Most homeowners save **$1,500–$3,000 per year** with solar — that's $37,500–$75,000 over 25 years!\n\nThe exact amount depends on your bill size, location, and which option you choose. Tell me your monthly electric bill and I'll calculate your personal savings estimate right now!`;
  } else if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey") || lower.includes("help")) {
    response = `Hi! I'm Alex, your SolarAdvisor specialist ☀\n\nI can help you:\n• Get an instant savings estimate\n• Compare $0-down lease vs. loan vs. cash\n• Check your state's solar incentives\n• Answer any solar questions\n\nWhat's your monthly electric bill? I'll calculate your savings in seconds!`;
  } else {
    response = `Great question! Solar is one of the best investments a homeowner can make right now with the 30% federal tax credit still in effect.\n\nTo give you the most accurate answer for your situation, it helps to know your monthly electric bill and ZIP code. What are those? I'll run your numbers right now!`;
  }

  return new ReadableStream({
    start(controller) {
      // Simulate streaming by chunking words
      const words = response.split(" ");
      let i = 0;
      const interval = setInterval(() => {
        if (i < words.length) {
          controller.enqueue(encoder.encode((i > 0 ? " " : "") + words[i]));
          i++;
        } else {
          clearInterval(interval);
          controller.close();
        }
      }, 18);
    },
  });
}

// ─── Route handlers ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();

    if (!message || typeof message !== "string" || message.length > 1000) {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    const stream = await streamChatResponse(history, message);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[Chat API]", err);
    return NextResponse.json({ error: "Chat unavailable" }, { status: 500 });
  }
}
