/**
 * API Route Integration Tests
 * Tests the route handler logic directly — DB is fully mocked.
 * No running server or live database required.
 */

import { NextRequest } from "next/server";

// ─── Mock DB before any imports ───────────────────────────────────────────────
const mockQ = jest.fn();
const mockQ1 = jest.fn();
const mockQExec = jest.fn();

jest.mock("@/db", () => ({
  db: { insert: () => ({ values: jest.fn().mockResolvedValue(undefined) }) },
  q: (...args: unknown[]) => mockQ(...args),
  q1: (...args: unknown[]) => mockQ1(...args),
  qExec: (...args: unknown[]) => mockQExec(...args),
  checkDbConnection: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/db/schema", () => ({
  leads: {},
  leadActivity: {},
  dripMessages: {},
  adminUsers: {},
}));

jest.mock("@/lib/notifications", () => ({
  notifyLeadReceived: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/webhook", () => ({
  sendLeadWebhook: jest.fn().mockResolvedValue({ success: false }),
}));

jest.mock("@/lib/auth", () => ({
  formatPhone: jest.fn((p: string) => `+1${p.replace(/\D/g, "")}`),
  getAdminFromCookie: jest.fn().mockResolvedValue({ id: 1, email: "admin@test.com", role: "admin" }),
  verifyPassword: jest.fn().mockResolvedValue(true),
  createToken: jest.fn().mockResolvedValue("mock-jwt-token"),
}));

// Mock Next.js cookies
jest.mock("next/headers", () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue({ value: "mock-jwt-token" }),
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(body: unknown, method = "POST", searchParams?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/leads");
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "1.2.3.4",
      "user-agent": "Jest Test Runner",
    },
    body: method !== "GET" ? JSON.stringify(body) : undefined,
  });
}

const VALID_LEAD_BODY = {
  zipCode: "78701",
  formattedAddress: "123 Main St, Austin, TX 78701, USA",
  streetAddress: "123 Main St",
  placeId: "ChIJTestPlaceIdSolarAdvisor01",
  latitude: 30.27,
  longitude: -97.74,
  city: "Austin",
  state: "TX",
  utilityProvider: "Austin Energy",
  buildingType: "residential",
  stories: "one",
  isHomeowner: true,
  monthlyBill: 250,
  roofSlope: "medium",
  shadingLevel: "none",
  isDecisionMaker: true,
  preferredFinancing: "lease",
  firstName: "John",
  lastName: "Smith",
  email: "john@example.com",
  phone: "5125551234",
  contactPreference: "call",
  consentGiven: true,
};

// ─── /api/leads POST ──────────────────────────────────────────────────────────
describe("POST /api/leads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQ1.mockResolvedValue(null); // ZIP cache miss by default
    mockQExec.mockResolvedValue({ insertId: 1, affectedRows: 1 });
    mockQ.mockResolvedValue([]);
  });

  test("returns 200 with leadId and estimate on valid input", async () => {
    const { POST } = await import("@/app/api/leads/route");
    const req = makeRequest(VALID_LEAD_BODY) as Parameters<typeof POST>[0];
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.leadId).toBe(1);
    expect(data.tier).toMatch(/^(hot|medium|cold)$/);
    expect(data.estimate).toBeDefined();
    expect(data.estimate.monthlySavings).toBeGreaterThan(0);
  });

  test("returns 400 on missing required fields", async () => {
    const { POST } = await import("@/app/api/leads/route");
    const req = makeRequest({ zipCode: "78701" }) as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  test("returns 400 when consent is false", async () => {
    const { POST } = await import("@/app/api/leads/route");
    const req = makeRequest({ ...VALID_LEAD_BODY, consentGiven: false }) as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("returns 400 on invalid ZIP", async () => {
    const { POST } = await import("@/app/api/leads/route");
    const req = makeRequest({ ...VALID_LEAD_BODY, zipCode: "abc" }) as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("returns 400 on invalid email", async () => {
    const { POST } = await import("@/app/api/leads/route");
    const req = makeRequest({ ...VALID_LEAD_BODY, email: "bademail" }) as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("estimate includes all required fields", async () => {
    const { POST } = await import("@/app/api/leads/route");
    const req = makeRequest(VALID_LEAD_BODY) as Parameters<typeof POST>[0];
    const res = await POST(req);
    const data = await res.json();
    const e = data.estimate;
    expect(e.systemKw).toBeDefined();
    expect(e.panels).toBeDefined();
    expect(e.monthlySavings).toBeDefined();
    expect(e.annualSavings).toBeDefined();
    expect(e.roiYears).toBeDefined();
    expect(e.installCost).toBeDefined();
    expect(e.netCost).toBeDefined();
    expect(e.monthlyLoanPayment).toBeDefined();
    expect(e.monthlyLeasePayment).toBeDefined();
  });

  test("calls qExec to insert lead into DB", async () => {
    const { POST } = await import("@/app/api/leads/route");
    const req = makeRequest(VALID_LEAD_BODY) as Parameters<typeof POST>[0];
    await POST(req);
    expect(mockQExec).toHaveBeenCalledTimes(1);
    const [sql] = mockQExec.mock.calls[0];
    expect(sql).toContain("INSERT INTO leads");
  });

  test("hot lead gets correct tier in response", async () => {
    const { POST } = await import("@/app/api/leads/route");
    const hotLead = {
      ...VALID_LEAD_BODY,
      monthlyBill: 400,
      roofSlope: "medium",
      shadingLevel: "none",
      isDecisionMaker: true,
    };
    const req = makeRequest(hotLead) as Parameters<typeof POST>[0];
    const res = await POST(req);
    const data = await res.json();
    expect(["hot", "medium"]).toContain(data.tier);
  });

  test("non-homeowner rejected at validation", async () => {
    const { POST } = await import("@/app/api/leads/route");
    const req = makeRequest({ ...VALID_LEAD_BODY, isHomeowner: false }) as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("500 is returned if DB throws", async () => {
    mockQExec.mockRejectedValueOnce(new Error("DB connection lost"));
    const { POST } = await import("@/app/api/leads/route");
    const req = makeRequest(VALID_LEAD_BODY) as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ─── /api/leads GET (duplicate check) ────────────────────────────────────────
describe("GET /api/leads (duplicate check)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns exists=false when email not found", async () => {
    mockQ1.mockResolvedValue(null);
    const { GET } = await import("@/app/api/leads/route");
    const req = new NextRequest("http://localhost/api/leads?email=new@test.com");
    const res = await GET(req);
    const data = await res.json();
    expect(data.exists).toBe(false);
  });

  test("returns exists=true when email found", async () => {
    mockQ1.mockResolvedValue({ id: 5 });
    const { GET } = await import("@/app/api/leads/route");
    const req = new NextRequest("http://localhost/api/leads?email=existing@test.com");
    const res = await GET(req);
    const data = await res.json();
    expect(data.exists).toBe(true);
  });

  test("returns exists=false with no email param", async () => {
    const { GET } = await import("@/app/api/leads/route");
    const req = new NextRequest("http://localhost/api/leads");
    const res = await GET(req);
    const data = await res.json();
    expect(data.exists).toBe(false);
  });
});

// ─── GET /api/leads/zip ─────────────────────────────────────────────────────
describe("GET /api/leads/zip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 400 for invalid zip", async () => {
    const { GET } = await import("@/app/api/leads/zip/route");
    const req = new NextRequest("http://localhost/api/leads/zip?zip=12");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  test("returns state from ZIP prefix when cache misses (78701 → TX)", async () => {
    mockQ1.mockResolvedValue(null);
    const { GET } = await import("@/app/api/leads/zip/route");
    const req = new NextRequest("http://localhost/api/leads/zip?zip=78701");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.zip).toBe("78701");
    expect(data.state).toBe("TX");
    expect(data.city).toBeNull();
  });

  test("falls back when DB errors", async () => {
    mockQ1.mockRejectedValue(new Error("connection refused"));
    const { GET } = await import("@/app/api/leads/zip/route");
    const req = new NextRequest("http://localhost/api/leads/zip?zip=78701");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.state).toBe("TX");
  });
});

// ─── /api/health (liveness — no DB) ───────────────────────────────────────────
describe("GET /api/health", () => {
  test("returns 200 immediately without touching DB", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
  });
});

// ─── /api/health/ready (readiness — DB ping + table check) ───────────────────
describe("GET /api/health/ready", () => {
  test("returns 200 when DB is healthy and tables exist", async () => {
    const { checkDbConnection } = await import("@/db");
    (checkDbConnection as jest.Mock).mockResolvedValue(true);
    // Mock q() to return all required tables
    mockQ.mockResolvedValue([
      { TABLE_NAME: "leads" },
      { TABLE_NAME: "lead_activity" },
      { TABLE_NAME: "drip_messages" },
      { TABLE_NAME: "admin_users" },
      { TABLE_NAME: "state_incentives" },
      { TABLE_NAME: "zip_cache" },
    ]);
    const { GET } = await import("@/app/api/health/ready/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ready");
    expect(data.database).toBe("connected");
    expect(data.tables.ready).toBe(true);
  });

  test("returns 503 when DB is down", async () => {
    const { checkDbConnection } = await import("@/db");
    (checkDbConnection as jest.Mock).mockResolvedValue(false);
    const { GET } = await import("@/app/api/health/ready/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.status).toBe("db_unreachable");
    expect(data.database).toBe("error");
  });

  test("returns 503 when DB up but tables missing", async () => {
    const { checkDbConnection } = await import("@/db");
    (checkDbConnection as jest.Mock).mockResolvedValue(true);
    // Only some tables exist — migration incomplete
    mockQ.mockResolvedValue([{ TABLE_NAME: "leads" }]);
    const { GET } = await import("@/app/api/health/ready/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.status).toBe("db_connected_tables_missing");
    expect(data.tables.ready).toBe(false);
  });
});

// ─── /api/admin/leads GET ────────────────────────────────────────────────────
describe("GET /api/admin/leads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQ.mockResolvedValue([
      { id: 1, first_name: "John", last_name: "Doe", email: "john@test.com", tier: "hot", score: 85, status: "new", monthly_bill: 300, created_at: new Date().toISOString() },
    ]);
    mockQ1.mockResolvedValue({ total: 1 });
  });

  test("returns leads array and pagination", async () => {
    const { GET } = await import("@/app/api/admin/leads/route");
    const req = new NextRequest("http://localhost/api/admin/leads");
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.leads)).toBe(true);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.page).toBe(1);
  });
});

// ─── /api/admin/auth ─────────────────────────────────────────────────────────
describe("POST /api/admin/auth", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 200 with valid credentials", async () => {
    mockQ1.mockResolvedValue({
      id: 1, email: "admin@test.com",
      password_hash: "$2b$12$validhash", name: "Admin", role: "superadmin",
    });
    const { verifyPassword } = await import("@/lib/auth");
    (verifyPassword as jest.Mock).mockResolvedValue(true);

    const { POST } = await import("@/app/api/admin/auth/route");
    const req = makeRequest({ email: "admin@test.com", password: "Admin@Solar2024!" }) as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  test("returns 401 when user not found", async () => {
    mockQ1.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/auth/route");
    const req = makeRequest({ email: "ghost@test.com", password: "anything123" }) as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test("returns 401 with wrong password", async () => {
    mockQ1.mockResolvedValue({
      id: 1, email: "admin@test.com",
      password_hash: "$2b$12$validhash", name: "Admin", role: "superadmin",
    });
    const { verifyPassword } = await import("@/lib/auth");
    (verifyPassword as jest.Mock).mockResolvedValue(false);
    const { POST } = await import("@/app/api/admin/auth/route");
    const req = makeRequest({ email: "admin@test.com", password: "wrongpassword" }) as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test("returns 400 on invalid email format", async () => {
    const { POST } = await import("@/app/api/admin/auth/route");
    const req = makeRequest({ email: "notanemail", password: "password123" }) as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("DELETE logs out and clears cookie", async () => {
    const { DELETE } = await import("@/app/api/admin/auth/route");
    const res = await DELETE();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
