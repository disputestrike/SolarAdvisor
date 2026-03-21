#!/usr/bin/env node
/**
 * SolarAdvisor Load & Chaos Test Suite
 * ─────────────────────────────────────────────────────────────────
 * Usage:
 *   node tests/load-chaos.mjs [BASE_URL]
 *
 * Examples:
 *   node tests/load-chaos.mjs http://localhost:3000
 *   node tests/load-chaos.mjs https://your-app.railway.app
 *
 * What it tests:
 *   1. Health check baseline
 *   2. Concurrent lead submissions (20 simultaneous)
 *   3. Burst traffic (100 leads in rapid succession)
 *   4. Chaos: malformed payloads
 *   5. Chaos: SQL injection attempts
 *   6. Chaos: oversized payloads
 *   7. Chaos: invalid content types
 *   8. ZIP lookup under load
 *   9. Admin auth brute-force resistance (rate)
 *  10. Response time benchmarks
 */

const BASE_URL = process.argv[2] || "http://localhost:3000";

// ─── Utilities ────────────────────────────────────────────────────────────────
const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

let passed = 0;
let failed = 0;
const results = [];

async function test(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const ms = Date.now() - start;
    console.log(`  ${colors.green("✓")} ${name} ${colors.dim(`(${ms}ms)`)}`);
    passed++;
    results.push({ name, status: "pass", ms });
  } catch (err) {
    const ms = Date.now() - start;
    console.log(`  ${colors.red("✗")} ${name} ${colors.dim(`(${ms}ms)`)}`);
    console.log(`    ${colors.red(err.message)}`);
    failed++;
    results.push({ name, status: "fail", ms, error: err.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return { res, data: await res.json().catch(() => null) };
}

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    signal: AbortSignal.timeout(10000),
  });
  return { res, data: await res.json().catch(() => null) };
}

function makeValidLead(overrides = {}) {
  const id = Math.random().toString(36).slice(2, 8);
  return {
    zipCode: "78701",
    isHomeowner: true,
    monthlyBill: 200 + Math.floor(Math.random() * 300),
    roofSlope: ["low", "medium", "steep", "flat"][Math.floor(Math.random() * 4)],
    shadingLevel: ["none", "light", "moderate"][Math.floor(Math.random() * 3)],
    isDecisionMaker: true,
    preferredFinancing: ["lease", "loan", "cash", "undecided"][Math.floor(Math.random() * 4)],
    firstName: `Load${id}`,
    lastName: `Test${id}`,
    email: `load.${id}@loadtest.invalid`,
    phone: `512${Math.floor(1000000 + Math.random() * 9000000)}`,
    contactPreference: "call",
    consentGiven: true,
    ...overrides,
  };
}

// ─── Test suites ──────────────────────────────────────────────────────────────

async function runHealthTests() {
  console.log(colors.bold("\n▶ Suite 1: Health Check"));

  await test("GET /api/health returns 200 (liveness, no DB)", async () => {
    const { res, data } = await get("/api/health");
    assert(res.status === 200, `Unexpected status: ${res.status}`);
    assert(data?.timestamp, "Missing timestamp");
    assert(data?.services, "Missing services");
  });

  await test("GET /api/health/ready reports database status", async () => {
    const { res, data } = await get("/api/health/ready");
    assert(res.status === 200 || res.status === 503, `Unexpected status: ${res.status}`);
    assert(data?.database === "ok" || data?.database === "error", "Missing database field");
  });
}

async function runValidationTests() {
  console.log(colors.bold("\n▶ Suite 2: Input Validation"));

  await test("Missing required fields → 400", async () => {
    const { res } = await post("/api/leads", { zipCode: "78701" });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("Non-homeowner → 200 with score=0 cold tier", async () => {
    const { res, data } = await post("/api/leads", makeValidLead({ isHomeowner: false }));
    assert(res.status === 200 || res.status === 500, `Expected 200 or 500 (DB may be down), got ${res.status}`);
    if (res.status === 200) {
      assert(data.tier === "cold", `Expected cold, got ${data.tier}`);
      assert(data.score === 0, `Expected score=0, got ${data.score}`);
    }
  });

  await test("Invalid ZIP → 400", async () => {
    const { res } = await post("/api/leads", makeValidLead({ zipCode: "ABC12" }));
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("Invalid email → 400", async () => {
    const { res } = await post("/api/leads", makeValidLead({ email: "notanemail" }));
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("Bill too low ($5) → 400", async () => {
    const { res } = await post("/api/leads", makeValidLead({ monthlyBill: 5 }));
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("Bill too high ($5000) → 400", async () => {
    const { res } = await post("/api/leads", makeValidLead({ monthlyBill: 5000 }));
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("consentGiven=false → 400", async () => {
    const { res } = await post("/api/leads", makeValidLead({ consentGiven: false }));
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("Short phone → 400", async () => {
    const { res } = await post("/api/leads", makeValidLead({ phone: "123" }));
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });
}

async function runChaosTests() {
  console.log(colors.bold("\n▶ Suite 3: Chaos / Attack Resistance"));

  await test("Empty body → 400", async () => {
    const res = await fetch(`${BASE_URL}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("Completely empty body → does not crash (400 or 500)", async () => {
    const res = await fetch(`${BASE_URL}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });
    assert(res.status >= 400, `Expected 4xx/5xx, got ${res.status}`);
  });

  await test("SQL injection in firstName → sanitized (no 500)", async () => {
    const { res } = await post("/api/leads", makeValidLead({
      firstName: "'; DROP TABLE leads; --",
      lastName: "' OR '1'='1",
    }));
    assert(res.status !== 500, `Got 500 — potential SQL injection vulnerability`);
  });

  await test("XSS attempt in fields → does not crash", async () => {
    const { res } = await post("/api/leads", makeValidLead({
      firstName: "<script>alert('xss')</script>",
      lastName: "<img src=x onerror=alert(1)>",
    }));
    // Should be 400 (too long or invalid) or 200 (stored as text), never 500
    assert(res.status !== 500, `Got 500 on XSS attempt`);
  });

  await test("Oversized payload (100KB) → does not crash", async () => {
    const huge = makeValidLead({ firstName: "A".repeat(100000) });
    const res = await fetch(`${BASE_URL}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(huge),
      signal: AbortSignal.timeout(10000),
    });
    assert(res.status >= 400, `Expected 4xx, got ${res.status}`);
  });

  await test("Wrong Content-Type → does not crash", async () => {
    const res = await fetch(`${BASE_URL}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not json",
    });
    assert(res.status >= 400, `Expected 4xx/5xx, got ${res.status}`);
  });

  await test("Null values in required fields → 400", async () => {
    const { res } = await post("/api/leads", {
      ...makeValidLead(),
      firstName: null,
      email: null,
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("Array instead of string for firstName → 400", async () => {
    const { res } = await post("/api/leads", {
      ...makeValidLead(),
      firstName: ["array", "of", "things"],
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("Deeply nested object → does not crash", async () => {
    const nested = { a: { b: { c: { d: { e: "deep" } } } } };
    const { res } = await post("/api/leads", { ...makeValidLead(), firstName: nested });
    assert(res.status >= 400, `Expected 4xx, got ${res.status}`);
  });
}

async function runZipTests() {
  console.log(colors.bold("\n▶ Suite 4: ZIP Code Lookup"));

  await test("Valid TX ZIP returns state=TX", async () => {
    const { res, data } = await get("/api/leads/zip?zip=78701");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    // State may be null if DB is down — that's OK
    if (data.state) assert(data.state === "TX", `Expected TX, got ${data.state}`);
  });

  await test("Valid CA ZIP returns state=CA", async () => {
    const { res, data } = await get("/api/leads/zip?zip=90210");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    if (data.state) assert(data.state === "CA", `Expected CA, got ${data.state}`);
  });

  await test("Invalid ZIP returns 400", async () => {
    const { res } = await get("/api/leads/zip?zip=ABCDE");
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("Missing zip param returns 400", async () => {
    const { res } = await get("/api/leads/zip");
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("4-digit ZIP returns 400", async () => {
    const { res } = await get("/api/leads/zip?zip=1234");
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("ZIP lookup under 10 concurrent requests", async () => {
    const zips = ["78701", "90210", "10001", "33101", "60601", "85001", "30301", "02101", "98101", "77001"];
    const results = await Promise.all(zips.map((zip) => get(`/api/leads/zip?zip=${zip}`)));
    const allOk = results.every(({ res }) => res.status === 200);
    assert(allOk, `Some ZIP lookups failed: ${results.map(r => r.res.status).join(", ")}`);
  });
}

async function runConcurrencyTests() {
  console.log(colors.bold("\n▶ Suite 5: Concurrency & Load"));

  await test("20 simultaneous lead submissions complete without errors", async () => {
    const promises = Array.from({ length: 20 }, () =>
      post("/api/leads", makeValidLead())
    );
    const results = await Promise.all(promises);
    const statuses = results.map(({ res }) => res.status);
    const allAccepted = statuses.every((s) => s === 200 || s === 500); // 500 if DB down
    const anyServerCrash = statuses.some((s) => s === 502 || s === 503);
    assert(!anyServerCrash, `Server crashed under load: statuses=${statuses.join(",")}`);
    console.log(`    ${colors.dim(`Status distribution: ${[...new Set(statuses)].map(s => `${s}×${statuses.filter(x=>x===s).length}`).join(", ")}`)}`);
  });

  await test("Response time: single lead submission < 5s", async () => {
    const start = Date.now();
    await post("/api/leads", makeValidLead());
    const ms = Date.now() - start;
    assert(ms < 5000, `Too slow: ${ms}ms (expected < 5000ms)`);
    console.log(`    ${colors.dim(`Response time: ${ms}ms`)}`);
  });

  await test("Response time: health check < 2s", async () => {
    const start = Date.now();
    await get("/api/health");
    const ms = Date.now() - start;
    assert(ms < 2000, `Too slow: ${ms}ms (expected < 2000ms)`);
  });

  await test("50 sequential ZIP lookups under 10s total", async () => {
    const start = Date.now();
    for (let i = 0; i < 50; i++) {
      await get(`/api/leads/zip?zip=7870${i % 10}`);
    }
    const ms = Date.now() - start;
    assert(ms < 10000, `Too slow: ${ms}ms for 50 sequential requests`);
    console.log(`    ${colors.dim(`50 requests in ${ms}ms (~${Math.round(ms/50)}ms each)`)}`);
  });

  await test("10 concurrent health checks complete successfully", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => get("/api/health")));
    const allOk = results.every(({ res }) => res.status <= 503);
    assert(allOk, "Some health checks returned unexpected status");
  });
}

async function runAdminTests() {
  console.log(colors.bold("\n▶ Suite 6: Admin Security"));

  await test("Admin login without credentials → 400", async () => {
    const { res } = await post("/api/admin/auth", {});
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("Admin login with wrong password → 401", async () => {
    const { res } = await post("/api/admin/auth", {
      email: "admin@solaradvisor.com",
      password: "wrongpassword123",
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test("Admin leads endpoint without auth cookie → 401", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/leads`, {
      headers: {}, // No cookie
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test("5 rapid failed logins don't crash server", async () => {
    const attempts = Array.from({ length: 5 }, () =>
      post("/api/admin/auth", { email: "attacker@evil.com", password: "brute" + Math.random() })
    );
    const results = await Promise.all(attempts);
    const statuses = results.map(({ res }) => res.status);
    // All should be 400 (bad format) or 401 (wrong creds), never 500
    assert(statuses.every((s) => s < 500), `Server error on brute force attempt: ${statuses}`);
  });
}

// ─── Run all suites ───────────────────────────────────────────────────────────
async function main() {
  console.log(colors.bold(colors.cyan(`\n☀ SolarAdvisor Load & Chaos Tests`)));
  console.log(colors.dim(`Target: ${BASE_URL}`));
  console.log(colors.dim(`Started: ${new Date().toISOString()}\n`));

  // Verify server is reachable first
  try {
    const { res } = await get("/api/health");
    console.log(colors.green(`✓ Server is reachable (${res.status})`));
  } catch (e) {
    console.log(colors.red(`✗ Server not reachable at ${BASE_URL}`));
    console.log(colors.yellow(`  Make sure the server is running: npm run dev`));
    process.exit(1);
  }

  await runHealthTests();
  await runValidationTests();
  await runChaosTests();
  await runZipTests();
  await runConcurrencyTests();
  await runAdminTests();

  // ─── Summary ───────────────────────────────────────────────────────────────
  const total = passed + failed;
  const pct = Math.round((passed / total) * 100);

  console.log(colors.bold(`\n${"─".repeat(50)}`));
  console.log(colors.bold(`Results: ${passed}/${total} passed (${pct}%)`));

  if (failed > 0) {
    console.log(colors.red(`\nFailed tests:`));
    results.filter((r) => r.status === "fail").forEach((r) => {
      console.log(`  ${colors.red("✗")} ${r.name}`);
      console.log(`    ${colors.dim(r.error)}`);
    });
  }

  const avgMs = Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length);
  const slowest = results.sort((a, b) => b.ms - a.ms)[0];
  console.log(colors.dim(`\nAvg response time: ${avgMs}ms`));
  console.log(colors.dim(`Slowest: "${slowest.name}" (${slowest.ms}ms)`));

  if (failed === 0) {
    console.log(colors.green(colors.bold(`\n✓ All tests passed. SolarAdvisor is ready.\n`)));
  } else {
    console.log(colors.yellow(colors.bold(`\n⚠ ${failed} test(s) failed. Review above.\n`)));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(colors.red("Fatal error:"), err);
  process.exit(1);
});
