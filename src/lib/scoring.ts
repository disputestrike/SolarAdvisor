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
  estimatedValue: number; // cents
}

// States with premium incentives = higher lead value
const PREMIUM_INCENTIVE_STATES = new Set([
  "CA", "NY", "MA", "CT", "NJ", "MD", "IL", "NM", "NV",
  "PA", "RI", "DE", "VT", "HI"
]);

const GOOD_SOLAR_STATES = new Set([
  "AZ", "TX", "FL", "CO", "TX", "GA", "NC", "SC", "UT",
  "OR", "WA", "MN", "WI", "OH", "IN", "MI"
]);

export function scoreLead(input: LeadScoreInput): LeadScoreResult {
  const breakdown: Record<string, number> = {};
  let score = 0;

  // Homeowner check (dealbreaker if not)
  if (input.isHomeowner) {
    breakdown["homeowner"] = 30;
    score += 30;
  } else {
    return {
      score: 0,
      tier: "cold",
      breakdown: { homeowner: 0 },
      estimatedValue: 0,
    };
  }

  // Monthly electricity bill
  if (input.monthlyBill >= 300) {
    breakdown["monthly_bill"] = 30;
    score += 30;
  } else if (input.monthlyBill >= 200) {
    breakdown["monthly_bill"] = 25;
    score += 25;
  } else if (input.monthlyBill >= 150) {
    breakdown["monthly_bill"] = 20;
    score += 20;
  } else if (input.monthlyBill >= 100) {
    breakdown["monthly_bill"] = 12;
    score += 12;
  } else {
    breakdown["monthly_bill"] = 5;
    score += 5;
  }

  // Roof suitability
  if (input.roofSlope === "medium" || input.roofSlope === "low") {
    breakdown["roof"] = 20;
    score += 20;
  } else if (input.roofSlope === "steep") {
    breakdown["roof"] = 12;
    score += 12;
  } else if (input.roofSlope === "flat") {
    breakdown["roof"] = 8;
    score += 8;
  }

  // Shading impact
  if (!input.shadingLevel || input.shadingLevel === "none") {
    breakdown["shading"] = 10;
    score += 10;
  } else if (input.shadingLevel === "light") {
    breakdown["shading"] = 7;
    score += 7;
  } else if (input.shadingLevel === "moderate") {
    breakdown["shading"] = 3;
    score += 3;
  }
  // heavy shading = 0 points

  // Decision maker
  if (input.isDecisionMaker !== false) {
    breakdown["decision_maker"] = 15;
    score += 15;
  } else {
    breakdown["decision_maker"] = 0;
  }

  // State incentives
  if (input.state && PREMIUM_INCENTIVE_STATES.has(input.state)) {
    breakdown["state_incentives"] = 10;
    score += 10;
  } else if (input.state && GOOD_SOLAR_STATES.has(input.state)) {
    breakdown["state_incentives"] = 5;
    score += 5;
  }

  // Clamp to 100
  score = Math.min(100, score);

  // Determine tier
  let tier: "hot" | "medium" | "cold";
  if (score >= 75) {
    tier = "hot";
  } else if (score >= 45) {
    tier = "medium";
  } else {
    tier = "cold";
  }

  // Estimated lead value
  const baseValues = { hot: 15000, medium: 7500, cold: 2500 }; // cents
  const stateMultiplier = input.state && PREMIUM_INCENTIVE_STATES.has(input.state) ? 1.25 : 1.0;
  const estimatedValue = Math.round(baseValues[tier] * stateMultiplier);

  return { score, tier, breakdown, estimatedValue };
}

// Solar system estimator
export interface SolarEstimate {
  systemKw: number;
  panels: number;
  monthlySavings: number;
  annualSavings: number;
  roiYears: number;
  installCost: number;
  netCost: number; // after 30% ITC
  monthlyLoanPayment: number;
  monthlyLeasePayment: number;
}

export function estimateSolar(
  monthlyBill: number,
  state: string = "TX",
  avgSunHours: number = 5.0,
  avgKwhCost: number = 0.13
): SolarEstimate {
  // Estimate monthly usage
  const monthlyKwh = monthlyBill / avgKwhCost;

  // System size needed (accounting for 80% efficiency)
  const systemKw = Math.ceil((monthlyKwh / (avgSunHours * 30) / 0.8) * 10) / 10;

  // Panels (400W each)
  const panels = Math.ceil((systemKw * 1000) / 400);

  // Savings (offset 90% of bill)
  const monthlySavings = Math.round(monthlyBill * 0.9);
  const annualSavings = monthlySavings * 12;

  // Cost estimate ($2.80/watt installed average)
  const installCost = Math.round(systemKw * 1000 * 2.8);

  // After 30% federal ITC
  const netCost = Math.round(installCost * 0.7);

  // ROI
  const roiYears = Math.round((netCost / annualSavings) * 10) / 10;

  // Monthly loan payment (7% APR, 25 years)
  const monthlyRate = 0.07 / 12;
  const n = 25 * 12;
  const monthlyLoanPayment = Math.round(
    (netCost * monthlyRate * Math.pow(1 + monthlyRate, n)) /
    (Math.pow(1 + monthlyRate, n) - 1)
  );

  // Monthly lease (typically 10-15% less than savings)
  const monthlyLeasePayment = Math.round(monthlySavings * 0.85);

  return {
    systemKw,
    panels,
    monthlySavings,
    annualSavings,
    roiYears,
    installCost,
    netCost,
    monthlyLoanPayment,
    monthlyLeasePayment,
  };
}
