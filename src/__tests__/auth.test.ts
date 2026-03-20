import { hashPassword, verifyPassword, createToken, verifyToken, formatPhone } from "@/lib/auth";

// Must set secret before import so jose picks it up
process.env.NEXTAUTH_SECRET = "test-secret-at-least-32-chars-long-enough";

describe("hashPassword / verifyPassword", () => {
  test("hash is not the plaintext password", async () => {
    const hash = await hashPassword("MySecurePass123!");
    expect(hash).not.toBe("MySecurePass123!");
  });

  test("hash starts with $2b$ (bcrypt)", async () => {
    const hash = await hashPassword("MySecurePass123!");
    expect(hash).toMatch(/^\$2b\$/);
  });

  test("correct password verifies true", async () => {
    const hash = await hashPassword("MySecurePass123!");
    expect(await verifyPassword("MySecurePass123!", hash)).toBe(true);
  });

  test("wrong password verifies false", async () => {
    const hash = await hashPassword("MySecurePass123!");
    expect(await verifyPassword("WrongPassword!", hash)).toBe(false);
  });

  test("empty password verifies false against real hash", async () => {
    const hash = await hashPassword("MySecurePass123!");
    expect(await verifyPassword("", hash)).toBe(false);
  });

  test("two hashes of the same password are different (salted)", async () => {
    const h1 = await hashPassword("SamePassword1!");
    const h2 = await hashPassword("SamePassword1!");
    expect(h1).not.toBe(h2);
  });

  test("each hash still verifies correctly", async () => {
    const h1 = await hashPassword("SamePassword1!");
    const h2 = await hashPassword("SamePassword1!");
    expect(await verifyPassword("SamePassword1!", h1)).toBe(true);
    expect(await verifyPassword("SamePassword1!", h2)).toBe(true);
  });
});

describe("createToken / verifyToken", () => {
  const PAYLOAD = { id: 42, email: "admin@test.com", role: "admin" };

  test("creates a JWT string", async () => {
    const token = await createToken(PAYLOAD);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // header.payload.sig
  });

  test("verifies valid token and returns payload", async () => {
    const token = await createToken(PAYLOAD);
    const decoded = await verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(42);
    expect(decoded?.email).toBe("admin@test.com");
    expect(decoded?.role).toBe("admin");
  });

  test("returns null for tampered token", async () => {
    const token = await createToken(PAYLOAD);
    const parts = token.split(".");
    parts[1] = Buffer.from(JSON.stringify({ id: 999, email: "evil@hack.com", role: "superadmin" })).toString("base64url");
    const tampered = parts.join(".");
    const result = await verifyToken(tampered);
    expect(result).toBeNull();
  });

  test("returns null for garbage string", async () => {
    const result = await verifyToken("not.a.token");
    expect(result).toBeNull();
  });

  test("returns null for empty string", async () => {
    const result = await verifyToken("");
    expect(result).toBeNull();
  });

  test("tokens from different payloads are different", async () => {
    const t1 = await createToken({ id: 1, email: "a@a.com", role: "admin" });
    const t2 = await createToken({ id: 2, email: "b@b.com", role: "viewer" });
    expect(t1).not.toBe(t2);
  });
});

describe("formatPhone()", () => {
  test("10-digit number gets +1 prefix", () => {
    expect(formatPhone("5125551234")).toBe("+15125551234");
  });

  test("11-digit number starting with 1 gets + prefix", () => {
    expect(formatPhone("15125551234")).toBe("+15125551234");
  });

  test("strips non-digit characters first", () => {
    expect(formatPhone("(512) 555-1234")).toBe("+15125551234");
  });

  test("handles dots as separators", () => {
    expect(formatPhone("512.555.1234")).toBe("+15125551234");
  });

  test("handles dashes", () => {
    expect(formatPhone("512-555-1234")).toBe("+15125551234");
  });

  test("already-formatted +1 number passes through", () => {
    expect(formatPhone("+15125551234")).toBe("+15125551234");
  });
});
