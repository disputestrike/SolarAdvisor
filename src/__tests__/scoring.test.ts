import { scoreLead, estimateSolar } from "@/lib/scoring";

describe("scoreLead()", () => {
  // ─── Homeowner gate ──────────────────────────────────────────────────────
  test("non-homeowner returns score=0 and tier=cold immediately", () => {
    const result = scoreLead({ isHomeowner: false, monthlyBill: 500 });
    expect(result.score).toBe(0);
    expect(result.tier).toBe("cold");
    expect(result.estimatedValue).toBe(0);
  });

  // ─── Bill scoring ────────────────────────────────────────────────────────
  test("bill ≥ $300 scores +30", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 350 });
    expect(r.breakdown.monthly_bill).toBe(30);
  });

  test("bill $200–299 scores +25", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 250 });
    expect(r.breakdown.monthly_bill).toBe(25);
  });

  test("bill $150–199 scores +20", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 175 });
    expect(r.breakdown.monthly_bill).toBe(20);
  });

  test("bill $100–149 scores +12", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 120 });
    expect(r.breakdown.monthly_bill).toBe(12);
  });

  test("bill < $100 scores +5", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 60 });
    expect(r.breakdown.monthly_bill).toBe(5);
  });

  // ─── Roof slope ──────────────────────────────────────────────────────────
  test("medium roof slope scores +20", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 200, roofSlope: "medium" });
    expect(r.breakdown.roof).toBe(20);
  });

  test("low roof slope scores +20", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 200, roofSlope: "low" });
    expect(r.breakdown.roof).toBe(20);
  });

  test("steep roof slope scores +12", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 200, roofSlope: "steep" });
    expect(r.breakdown.roof).toBe(12);
  });

  test("flat roof scores +8", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 200, roofSlope: "flat" });
    expect(r.breakdown.roof).toBe(8);
  });

  // ─── Shading ─────────────────────────────────────────────────────────────
  test("no shading scores +10", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 200, shadingLevel: "none" });
    expect(r.breakdown.shading).toBe(10);
  });

  test("heavy shading scores 0", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 200, shadingLevel: "heavy" });
    expect(r.breakdown.shading).toBeUndefined();
  });

  // ─── Decision maker ──────────────────────────────────────────────────────
  test("decision maker scores +15", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 200, isDecisionMaker: true });
    expect(r.breakdown.decision_maker).toBe(15);
  });

  test("non-decision-maker scores 0", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 200, isDecisionMaker: false });
    expect(r.breakdown.decision_maker).toBe(0);
  });

  // ─── State incentives ────────────────────────────────────────────────────
  test("premium state (CA) adds +10", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 200, state: "CA" });
    expect(r.breakdown.state_incentives).toBe(10);
  });

  test("good solar state (TX) adds +5", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 200, state: "TX" });
    expect(r.breakdown.state_incentives).toBe(5);
  });

  test("unknown state adds 0", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 200, state: "XX" });
    expect(r.breakdown.state_incentives).toBeUndefined();
  });

  // ─── Tier thresholds ─────────────────────────────────────────────────────
  test("score ≥ 75 = hot tier", () => {
    const r = scoreLead({
      isHomeowner: true,
      monthlyBill: 300,    // +30
      roofSlope: "medium", // +20
      shadingLevel: "none",// +10
      isDecisionMaker: true,// +15
      state: "CA",         // +10
    });
    // 30 + 30 + 20 + 10 + 15 + 10 = 115 → clamped to 100
    expect(r.score).toBe(100);
    expect(r.tier).toBe("hot");
  });

  test("score 45–74 = medium tier", () => {
    const hotEdge = scoreLead({
      isHomeowner: true,
      monthlyBill: 150,     // +20
      roofSlope: "steep",   // +12
      isDecisionMaker: true,// +15
    });
    expect(hotEdge.tier).toBe("hot"); // 30 + 20 + 12 + 15 = 77
    const r2 = scoreLead({
      isHomeowner: true,
      monthlyBill: 100,     // +12
      roofSlope: "flat",    // +8
      isDecisionMaker: false,// 0
    });
    // 30 + 12 + 8 = 50 → medium
    expect(r2.tier).toBe("medium");
  });

  test("score < 45 = cold tier", () => {
    const r = scoreLead({
      isHomeowner: true,
      monthlyBill: 60,      // +5
      isDecisionMaker: false,// 0
      shadingLevel: "heavy",
    });
    // 30 + 5 = 35 → cold
    expect(r.tier).toBe("cold");
  });

  // ─── Score clamped at 100 ────────────────────────────────────────────────
  test("score never exceeds 100", () => {
    const r = scoreLead({
      isHomeowner: true,
      monthlyBill: 500,
      roofSlope: "medium",
      shadingLevel: "none",
      isDecisionMaker: true,
      state: "CA",
    });
    expect(r.score).toBeLessThanOrEqual(100);
  });

  // ─── Lead value ──────────────────────────────────────────────────────────
  test("hot lead in premium state has highest estimated value", () => {
    const hot = scoreLead({ isHomeowner: true, monthlyBill: 400, roofSlope: "medium", shadingLevel: "none", isDecisionMaker: true, state: "CA" });
    const cold = scoreLead({ isHomeowner: true, monthlyBill: 60 });
    expect(hot.estimatedValue).toBeGreaterThan(cold.estimatedValue);
  });

  test("hot lead value ≥ $100 (10000 cents)", () => {
    const r = scoreLead({ isHomeowner: true, monthlyBill: 400, roofSlope: "medium", shadingLevel: "none", isDecisionMaker: true });
    expect(r.estimatedValue).toBeGreaterThanOrEqual(10000);
  });
});

// ─── estimateSolar() ─────────────────────────────────────────────────────────
describe("estimateSolar()", () => {
  test("returns reasonable system size for $200/mo bill", () => {
    const e = estimateSolar(200);
    expect(e.systemKw).toBeGreaterThan(3);
    expect(e.systemKw).toBeLessThan(20);
  });

  test("higher bill → larger system", () => {
    const low = estimateSolar(100);
    const high = estimateSolar(400);
    expect(high.systemKw).toBeGreaterThan(low.systemKw);
    expect(high.panels).toBeGreaterThan(low.panels);
  });

  test("savings are 85% of bill (85% usage offset)", () => {
    const bill = 250;
    const e = estimateSolar(bill);
    expect(e.monthlySavings).toBe(Math.round(bill * 0.85));
  });

  test("annual savings = monthly × 12", () => {
    const e = estimateSolar(200);
    expect(e.annualSavings).toBe(e.monthlySavings * 12);
  });

  test("net cost is 70% of install cost (after 30% ITC)", () => {
    const e = estimateSolar(200);
    expect(e.netCost).toBeCloseTo(e.installCost * 0.7, 0);
  });

  test("ROI is positive", () => {
    const e = estimateSolar(200);
    expect(e.roiYears).toBeGreaterThan(0);
    expect(e.roiYears).toBeLessThan(30);
  });

  test("monthly loan payment is positive", () => {
    const e = estimateSolar(200);
    expect(e.monthlyLoanPayment).toBeGreaterThan(0);
  });

  test("lease payment is 85% of monthly savings", () => {
    const e = estimateSolar(200);
    expect(e.monthlyLeasePayment).toBe(Math.round(e.monthlySavings * 0.85));
  });

  test("lease payment is less than current bill", () => {
    const bill = 200;
    const e = estimateSolar(bill);
    expect(e.monthlyLeasePayment).toBeLessThan(bill);
  });

  test("panels = ceil(systemKw * 1000 / 400)", () => {
    const e = estimateSolar(200);
    expect(e.panels).toBe(Math.ceil((e.systemKw * 1000) / 400));
  });

  test("larger sun hours → smaller system needed", () => {
    const highSun = estimateSolar(200, "AZ", 6.5, 0.13);
    const lowSun = estimateSolar(200, "WA", 3.5, 0.13);
    expect(highSun.systemKw).toBeLessThanOrEqual(lowSun.systemKw);
  });
});
