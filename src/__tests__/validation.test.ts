import { leadSchema, adminLoginSchema, leadUpdateSchema } from "@/lib/validation";

const VALID_LEAD = {
  zipCode: "78701",
  isHomeowner: true,
  monthlyBill: 200,
  roofSlope: "medium" as const,
  shadingLevel: "none" as const,
  isDecisionMaker: true,
  preferredFinancing: "lease" as const,
  firstName: "John",
  lastName: "Smith",
  email: "john@example.com",
  phone: "5125551234",
  contactPreference: "call" as const,
  consentGiven: true,
};

describe("leadSchema", () => {
  // ─── Valid ───────────────────────────────────────────────────────────────
  test("accepts a valid lead", () => {
    const result = leadSchema.safeParse(VALID_LEAD);
    expect(result.success).toBe(true);
  });

  test("optional fields can be omitted", () => {
    const { roofSlope, shadingLevel, roofType, ...minimal } = VALID_LEAD as typeof VALID_LEAD & { roofType?: string };
    const result = leadSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  // ─── ZIP ─────────────────────────────────────────────────────────────────
  test("rejects ZIP shorter than 5 digits", () => {
    const r = leadSchema.safeParse({ ...VALID_LEAD, zipCode: "1234" });
    expect(r.success).toBe(false);
  });

  test("rejects non-numeric ZIP", () => {
    const r = leadSchema.safeParse({ ...VALID_LEAD, zipCode: "ABCDE" });
    expect(r.success).toBe(false);
  });

  test("accepts ZIP+4 format", () => {
    const r = leadSchema.safeParse({ ...VALID_LEAD, zipCode: "78701-1234" });
    expect(r.success).toBe(true);
  });

  // ─── Monthly bill ────────────────────────────────────────────────────────
  test("rejects bill below $30", () => {
    const r = leadSchema.safeParse({ ...VALID_LEAD, monthlyBill: 20 });
    expect(r.success).toBe(false);
  });

  test("rejects bill above $2000", () => {
    const r = leadSchema.safeParse({ ...VALID_LEAD, monthlyBill: 3000 });
    expect(r.success).toBe(false);
  });

  test("accepts bill of exactly $30", () => {
    const r = leadSchema.safeParse({ ...VALID_LEAD, monthlyBill: 30 });
    expect(r.success).toBe(true);
  });

  // ─── Email ───────────────────────────────────────────────────────────────
  test("rejects invalid email", () => {
    const r = leadSchema.safeParse({ ...VALID_LEAD, email: "notanemail" });
    expect(r.success).toBe(false);
  });

  test("rejects email without domain", () => {
    const r = leadSchema.safeParse({ ...VALID_LEAD, email: "john@" });
    expect(r.success).toBe(false);
  });

  // ─── Phone ───────────────────────────────────────────────────────────────
  test("rejects short phone", () => {
    const r = leadSchema.safeParse({ ...VALID_LEAD, phone: "123" });
    expect(r.success).toBe(false);
  });

  test("accepts formatted phone (555) 123-4567", () => {
    const r = leadSchema.safeParse({ ...VALID_LEAD, phone: "(555) 123-4567" });
    expect(r.success).toBe(true);
  });

  // ─── Names ───────────────────────────────────────────────────────────────
  test("rejects empty first name", () => {
    const r = leadSchema.safeParse({ ...VALID_LEAD, firstName: "" });
    expect(r.success).toBe(false);
  });

  test("rejects empty last name", () => {
    const r = leadSchema.safeParse({ ...VALID_LEAD, lastName: "" });
    expect(r.success).toBe(false);
  });

  // ─── Consent ─────────────────────────────────────────────────────────────
  test("rejects consentGiven=false", () => {
    const r = leadSchema.safeParse({ ...VALID_LEAD, consentGiven: false });
    expect(r.success).toBe(false);
  });

  // ─── Financing ───────────────────────────────────────────────────────────
  test("rejects unknown financing option", () => {
    const r = leadSchema.safeParse({ ...VALID_LEAD, preferredFinancing: "magic" });
    expect(r.success).toBe(false);
  });

  test("accepts all valid financing options", () => {
    ["lease", "loan", "cash", "undecided"].forEach((f) => {
      const r = leadSchema.safeParse({ ...VALID_LEAD, preferredFinancing: f });
      expect(r.success).toBe(true);
    });
  });

  // ─── Default values ──────────────────────────────────────────────────────
  test("contactPreference defaults to call", () => {
    const { contactPreference, ...rest } = VALID_LEAD;
    const r = leadSchema.safeParse(rest);
    if (r.success) {
      expect(r.data.contactPreference).toBe("call");
    }
  });

  test("isDecisionMaker defaults to true", () => {
    const { isDecisionMaker, ...rest } = VALID_LEAD;
    const r = leadSchema.safeParse(rest);
    if (r.success) {
      expect(r.data.isDecisionMaker).toBe(true);
    }
  });
});

describe("adminLoginSchema", () => {
  test("accepts valid credentials", () => {
    const r = adminLoginSchema.safeParse({ email: "admin@test.com", password: "Password1!" });
    expect(r.success).toBe(true);
  });

  test("rejects invalid email", () => {
    const r = adminLoginSchema.safeParse({ email: "notvalid", password: "Password1!" });
    expect(r.success).toBe(false);
  });

  test("rejects short password", () => {
    const r = adminLoginSchema.safeParse({ email: "admin@test.com", password: "abc" });
    expect(r.success).toBe(false);
  });
});

describe("leadUpdateSchema", () => {
  test("accepts partial update with just status", () => {
    const r = leadUpdateSchema.safeParse({ status: "contacted" });
    expect(r.success).toBe(true);
  });

  test("accepts empty object (all fields optional)", () => {
    const r = leadUpdateSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  test("rejects invalid status", () => {
    const r = leadUpdateSchema.safeParse({ status: "flying" });
    expect(r.success).toBe(false);
  });

  test("accepts appointment update", () => {
    const r = leadUpdateSchema.safeParse({
      status: "appointment_set",
      assignedTo: "Jane Doe",
      appointmentAt: "2024-12-01T14:00:00Z",
    });
    expect(r.success).toBe(true);
  });
});
