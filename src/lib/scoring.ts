// ─── Lead scoring ─────────────────────────────────────────────────────────────

export interface LeadScoreInput {
  isHomeowner: boolean;
  monthlyBill: number;
  roofSlope?: string;
  shadingLevel?: string;
  isDecisionMaker?: boolean;
  state?: string;
}

export interface LeadScoreResult {
  score: number;
  tier: "hot" | "medium" | "cold";
  breakdown: Record<string, number>;
  estimatedValue: number;
}

const PREMIUM_INCENTIVE_STATES = new Set([
  "CA","NY","MA","CT","NJ","MD","IL","NM","NV","PA","RI","DE","VT","HI"
]);
const GOOD_SOLAR_STATES = new Set([
  "AZ","TX","FL","CO","GA","NC","SC","UT","OR","WA","MN","WI","OH","IN","MI"
]);

export function scoreLead(input: LeadScoreInput): LeadScoreResult {
  const breakdown: Record<string, number> = {};
  let score = 0;

  if (!input.isHomeowner) {
    return { score: 0, tier: "cold", breakdown: { homeowner: 0 }, estimatedValue: 0 };
  }
  breakdown["homeowner"] = 30; score += 30;

  if      (input.monthlyBill >= 300) { breakdown["monthly_bill"] = 30; score += 30; }
  else if (input.monthlyBill >= 200) { breakdown["monthly_bill"] = 25; score += 25; }
  else if (input.monthlyBill >= 150) { breakdown["monthly_bill"] = 20; score += 20; }
  else if (input.monthlyBill >= 100) { breakdown["monthly_bill"] = 12; score += 12; }
  else                               { breakdown["monthly_bill"] = 5;  score += 5;  }

  if      (input.roofSlope === "medium" || input.roofSlope === "low") { breakdown["roof"] = 20; score += 20; }
  else if (input.roofSlope === "steep")  { breakdown["roof"] = 12; score += 12; }
  else if (input.roofSlope === "flat")   { breakdown["roof"] = 8;  score += 8;  }

  if      (!input.shadingLevel || input.shadingLevel === "none")     { breakdown["shading"] = 10; score += 10; }
  else if (input.shadingLevel === "light")    { breakdown["shading"] = 7; score += 7; }
  else if (input.shadingLevel === "moderate") { breakdown["shading"] = 3; score += 3; }

  if (input.isDecisionMaker !== false) { breakdown["decision_maker"] = 15; score += 15; }

  if      (input.state && PREMIUM_INCENTIVE_STATES.has(input.state)) { breakdown["state_incentives"] = 10; score += 10; }
  else if (input.state && GOOD_SOLAR_STATES.has(input.state))        { breakdown["state_incentives"] = 5;  score += 5;  }

  score = Math.min(100, score);
  const tier: "hot" | "medium" | "cold" = score >= 75 ? "hot" : score >= 45 ? "medium" : "cold";
  const baseValues = { hot: 15000, medium: 7500, cold: 2500 };
  const stateMultiplier = input.state && PREMIUM_INCENTIVE_STATES.has(input.state) ? 1.25 : 1.0;
  return { score, tier, breakdown, estimatedValue: Math.round(baseValues[tier] * stateMultiplier) };
}

// ─── Solar estimation ─────────────────────────────────────────────────────────

export interface SolarEstimate {
  systemKw: number;
  panels: number;
  monthlySavings: number;
  annualSavings: number;
  roiYears: number;
  installCost: number;
  netCost: number;
  monthlyLoanPayment: number;
  monthlyLeasePayment: number;
  // Closed-loop fields
  offsetPercent: number;   // % of annual usage this system covers (0–100)
  annualKwh: number;       // actual annual production
  isRoofLimited: boolean;  // true when roof capacity < required system size
}

/**
 * Closed-loop estimator.
 *
 * Call with just (monthlyBill) for a quick pre-satellite estimate.
 * Call with (monthlyBill, state, sunHours, kwhCost, actualPanels) after
 * satellite/layout engine runs — ALL numbers then derive from actualPanels.
 *
 * RULE: layout engine is the source of truth.
 * Financial model NEVER shows a system that can't physically fit on the roof.
 */
export function estimateSolar(
  monthlyBill: number,
  _state: string = "TX",
  avgSunHours: number = 5.0,
  avgKwhCost: number = 0.17,
  actualPanels?: number  // from layout engine — overrides everything when set
): SolarEstimate {
  const kwhCost    = Math.max(avgKwhCost, 0.12);
  const monthlyKwh = monthlyBill / kwhCost;
  const annualKwhUsage = monthlyKwh * 12;

  // ── Step 1: Required system from bill (initial estimate) ──────────────────
  const offsetRatio  = 0.85;
  const requiredKw   = Math.round((monthlyKwh * offsetRatio) / (avgSunHours * 30 * 0.80) * 10) / 10;
  const requiredPanels = Math.ceil((requiredKw * 1000) / 400);

  // ── Step 2: Close the loop — use actual panels if layout engine ran ────────
  // If actualPanels provided, ALL numbers derive from it (roof is source of truth)
  const isRoofLimited = actualPanels !== undefined && actualPanels < requiredPanels;
  const finalPanels   = actualPanels !== undefined
    ? Math.min(32, Math.max(1, actualPanels))
    : Math.min(32, Math.max(4, requiredPanels));

  // ── Step 3: Everything from finalPanels ───────────────────────────────────
  const systemKw  = Math.round((finalPanels * 400) / 1000 * 10) / 10;

  // Annual production: system_kw × sun_hours × 365 × efficiency (0.80)
  const annualKwh = Math.round(systemKw * avgSunHours * 365 * 0.80);

  // Offset: what % of the homeowner's usage this system covers
  const offsetPercent = Math.min(100, Math.round((annualKwh / annualKwhUsage) * 100));

  // Savings: min(production, usage) × rate
  const monthlyProduction = annualKwh / 12;
  const kwhOffset         = Math.min(monthlyKwh, monthlyProduction);
  const monthlySavings    = Math.round(kwhOffset * kwhCost);
  const annualSavings     = monthlySavings * 12;

  // Cost from actual system size
  const installCost = Math.round(systemKw * 1000 * 3.00);
  const netCost     = Math.round(installCost * 0.70);  // after 30% ITC
  const roiYears    = annualSavings > 0 ? Math.round((netCost / annualSavings) * 10) / 10 : 0;

  // Loan: 6.99% APR, 25 years
  const r = 0.0699 / 12;
  const n = 300;
  const monthlyLoanPayment = netCost > 0
    ? Math.round((netCost * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1))
    : 0;

  // Lease: customer pays ~75% of savings (keeps 25% day-one)
  const monthlyLeasePayment = Math.round(monthlySavings * 0.75);

  return {
    systemKw,
    panels: finalPanels,
    monthlySavings,
    annualSavings,
    roiYears,
    installCost,
    netCost,
    monthlyLoanPayment,
    monthlyLeasePayment,
    offsetPercent,
    annualKwh,
    isRoofLimited,
  };
}
