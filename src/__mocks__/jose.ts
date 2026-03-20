/**
 * CJS-compatible jose shim for Jest.
 * Uses real HMAC-SHA256 signing so token verification tests are genuine.
 */
import crypto from "crypto";

// Simple JWT encode/decode without ESM dependency
function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function sign(data: string, secret: Uint8Array): string {
  return base64url(
    crypto.createHmac("sha256", Buffer.from(secret)).update(data).digest()
  );
}

export class SignJWT {
  private _payload: Record<string, unknown>;
  private _header: Record<string, unknown> = { alg: "HS256", typ: "JWT" };
  private _exp?: number;

  constructor(payload: Record<string, unknown>) {
    this._payload = { ...payload };
  }

  setProtectedHeader(header: Record<string, unknown>) {
    this._header = header;
    return this;
  }

  setIssuedAt() {
    this._payload.iat = Math.floor(Date.now() / 1000);
    return this;
  }

  setExpirationTime(exp: string) {
    const match = exp.match(/^(\d+)h$/);
    const hours = match ? parseInt(match[1]) : 8;
    this._payload.exp = Math.floor(Date.now() / 1000) + hours * 3600;
    return this;
  }

  async sign(secret: Uint8Array): Promise<string> {
    const header = base64url(JSON.stringify(this._header));
    const payload = base64url(JSON.stringify(this._payload));
    const sig = sign(`${header}.${payload}`, secret);
    return `${header}.${payload}.${sig}`;
  }
}

export async function jwtVerify(
  token: string,
  secret: Uint8Array
): Promise<{ payload: Record<string, unknown> }> {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid token");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token structure");
  }

  const [header, payload, providedSig] = parts;
  const expectedSig = sign(`${header}.${payload}`, secret);

  if (providedSig !== expectedSig) {
    throw new Error("Signature verification failed");
  }

  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return { payload: decoded };
}
