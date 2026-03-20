import { sendLeadWebhook } from "@/lib/webhook";
import type { Lead } from "@/db/schema";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const MOCK_LEAD: Partial<Lead> = {
  id: 42,
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  phone: "+15125551234",
  zipCode: "78701",
  city: "Austin",
  state: "TX",
  monthlyBill: 250,
  score: 88,
  tier: "hot",
  estimatedMonthlySavings: 187,
  preferredFinancing: "lease",
  roofType: "asphalt",
};

describe("sendLeadWebhook()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PARTNER_WEBHOOK_URL = "https://crm.example.com/webhook/leads";
    process.env.PARTNER_WEBHOOK_SECRET = "test-secret-12345";
  });

  afterEach(() => {
    delete process.env.PARTNER_WEBHOOK_URL;
    delete process.env.PARTNER_WEBHOOK_SECRET;
  });

  test("returns {success:false} when PARTNER_WEBHOOK_URL not set", async () => {
    delete process.env.PARTNER_WEBHOOK_URL;
    const result = await sendLeadWebhook(MOCK_LEAD as Lead);
    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("calls fetch with POST method", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("ok") });
    await sendLeadWebhook(MOCK_LEAD as Lead);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("POST");
  });

  test("sends correct Content-Type header", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("ok") });
    await sendLeadWebhook(MOCK_LEAD as Lead);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  test("includes X-SolarAdvisor-Signature header when secret set", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("ok") });
    await sendLeadWebhook(MOCK_LEAD as Lead);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["X-SolarAdvisor-Signature"]).toBeDefined();
    expect(options.headers["X-SolarAdvisor-Signature"]).not.toBe("");
  });

  test("includes X-SolarAdvisor-Event header", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("ok") });
    await sendLeadWebhook(MOCK_LEAD as Lead, "lead.created");
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["X-SolarAdvisor-Event"]).toBe("lead.created");
  });

  test("payload body contains lead fields", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("ok") });
    await sendLeadWebhook(MOCK_LEAD as Lead);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.lead.id).toBe(42);
    expect(body.lead.email).toBe("jane@example.com");
    expect(body.lead.score).toBe(88);
    expect(body.lead.tier).toBe("hot");
  });

  test("payload includes event and timestamp", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("ok") });
    await sendLeadWebhook(MOCK_LEAD as Lead, "lead.created");
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.event).toBe("lead.created");
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  test("returns {success:true} on 2xx response", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("accepted") });
    const result = await sendLeadWebhook(MOCK_LEAD as Lead);
    expect(result.success).toBe(true);
    expect(result.response).toBe("accepted");
  });

  test("returns {success:false} on 4xx response", async () => {
    mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve("unauthorized") });
    const result = await sendLeadWebhook(MOCK_LEAD as Lead);
    expect(result.success).toBe(false);
  });

  test("returns {success:false} on network error", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await sendLeadWebhook(MOCK_LEAD as Lead);
    expect(result.success).toBe(false);
  });

  test("HMAC signature is different for different payloads", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("ok") });
    
    await sendLeadWebhook(MOCK_LEAD as Lead, "lead.created");
    const sig1 = mockFetch.mock.calls[0][1].headers["X-SolarAdvisor-Signature"];

    mockFetch.mockClear();
    const differentLead = { ...MOCK_LEAD, id: 99, email: "other@test.com" } as Lead;
    await sendLeadWebhook(differentLead, "lead.created");
    const sig2 = mockFetch.mock.calls[0][1].headers["X-SolarAdvisor-Signature"];

    expect(sig1).not.toBe(sig2);
  });

  test("empty signature when no secret set", async () => {
    delete process.env.PARTNER_WEBHOOK_SECRET;
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("ok") });
    await sendLeadWebhook(MOCK_LEAD as Lead);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["X-SolarAdvisor-Signature"]).toBe("");
  });
});
