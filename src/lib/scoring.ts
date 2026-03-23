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
  _state: string = "TX",
  avgSunHours: number = 5.0,
  avgKwhCost: number = 0.17  // US average ~$0.17/kWh (was incorrectly $0.13)
): SolarEstimate {
  // Use at least $0.12/kWh to avoid oversizing on low-cost states
  const kwhCost = Math.max(avgKwhCost, 0.12);

  // Monthly kWh usage from bill
  const monthlyKwh = monthlyBill / kwhCost;

  // System size: 1 kW generates ~120 kWh/month (5 sun hours × 30 days × 80% efficiency)
  // Most residential systems offset 80-90% of usage, not 100%
  const offsetRatio = 0.85; // offset 85% of usage
  const systemKw = Math.round((monthlyKwh * offsetRatio) / (avgSunHours * 30 * 0.8) * 10) / 10;

  // Panels: 400W each — cap at realistic residential range (4–32 panels)
  const panels = Math.min(32, Math.max(4, Math.ceil((systemKw * 1000) / 400)));

  // Savings: 85% of bill (offsetting 85% of usage)
  const monthlySavings = Math.round(monthlyBill * offsetRatio);
  const annualSavings = monthlySavings * 12;

  // Cost: $3.00/watt installed (2024 US average)
  const installCost = Math.round(systemKw * 1000 * 3.0);

  // After 30% federal ITC
  const netCost = Math.round(installCost * 0.7);

  // ROI
  const roiYears = annualSavings > 0 ? Math.round((netCost / annualSavings) * 10) / 10 : 0;

  // Monthly loan (6.99% APR, 25 years)
  const monthlyRate = 0.0699 / 12;
  const n = 25 * 12;
  const monthlyLoanPayment = netCost > 0 ? Math.round(
    (netCost * monthlyRate * Math.pow(1 + monthlyRate, n)) /
    (Math.pow(1 + monthlyRate, n) - 1)
  ) : 0;

  // Monthly lease = ~85% of savings (customer keeps 15%)
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
