import { computeLayout, scoreFace, layoutToSVG, PANEL_WATTS, type RoofSegment } from "@/lib/solar-layout";

// ─── Mock segments ────────────────────────────────────────────────────────────
const southFace: RoofSegment = {
  id: 0, centerLat: 25.77, centerLng: -80.19,
  areaM2: 60, pitchDegrees: 25, azimuthDegrees: 180, shadingFactor: 1.0,
};
const westFace: RoofSegment = {
  id: 1, centerLat: 25.7701, centerLng: -80.19,
  areaM2: 30, pitchDegrees: 25, azimuthDegrees: 270, shadingFactor: 0.9,
};
const northFace: RoofSegment = {
  id: 2, centerLat: 25.7699, centerLng: -80.19,
  areaM2: 25, pitchDegrees: 25, azimuthDegrees: 0, shadingFactor: 1.0,
};

// ─── scoreFace ────────────────────────────────────────────────────────────────
describe("scoreFace()", () => {
  test("south face scores highest (~1.0)", () => {
    const s = scoreFace(180, 25, 1.0, 1700);
    expect(s).toBeGreaterThan(0.90);
    expect(s).toBeLessThanOrEqual(1.0);
  });

  test("north face scores lowest", () => {
    const south = scoreFace(180, 25, 1.0, 1700);
    const north = scoreFace(0, 25, 1.0, 1700);
    expect(south).toBeGreaterThan(north);
    expect(north).toBeLessThan(0.55);
  });

  test("west face scores between south and north", () => {
    const south = scoreFace(180, 25, 1.0, 1700);
    const west  = scoreFace(270, 25, 1.0, 1700);
    const north = scoreFace(0,   25, 1.0, 1700);
    expect(west).toBeLessThan(south);
    expect(west).toBeGreaterThan(north);
  });

  test("flat roof scores lower than 30° tilt", () => {
    const flat    = scoreFace(180, 2,  1.0, 1700);
    const optimal = scoreFace(180, 30, 1.0, 1700);
    expect(optimal).toBeGreaterThan(flat);
  });

  test("shading factor reduces score proportionally", () => {
    const full   = scoreFace(180, 25, 1.0, 1700);
    const shaded = scoreFace(180, 25, 0.7, 1700);
    expect(shaded).toBeLessThan(full);
    expect(shaded / full).toBeCloseTo(0.7, 1);
  });

  test("more sun hours = higher score", () => {
    const low  = scoreFace(180, 25, 1.0, 1200);
    const high = scoreFace(180, 25, 1.0, 2000);
    expect(high).toBeGreaterThan(low);
  });
});

// ─── computeLayout ────────────────────────────────────────────────────────────
describe("computeLayout()", () => {
  test("returns empty layout for zero panels", () => {
    const result = computeLayout([southFace], 0);
    expect(result.panelCount).toBe(0);
    expect(result.systemKw).toBe(0);
  });

  test("returns empty layout for empty segments", () => {
    const result = computeLayout([], 10);
    expect(result.panelCount).toBe(0);
  });

  test("places panels up to target count", () => {
    const result = computeLayout([southFace], 10, 1700);
    expect(result.panelCount).toBeGreaterThan(0);
    expect(result.panelCount).toBeLessThanOrEqual(10);
  });

  test("never exceeds target panel count", () => {
    const targets = [5, 10, 15, 20];
    for (const target of targets) {
      const result = computeLayout([southFace, westFace], target, 1700);
      expect(result.panelCount).toBeLessThanOrEqual(target);
    }
  });

  test("energy-first: south face filled before west face", () => {
    const result = computeLayout([westFace, southFace], 20, 1700);
    const southPanels = result.breakdown.find(b => b.segmentId === 0)?.panels ?? 0;
    const westPanels  = result.breakdown.find(b => b.segmentId === 1)?.panels ?? 0;
    // South (score ~0.95) should be filled before west (score ~0.75)
    expect(southPanels).toBeGreaterThanOrEqual(westPanels);
  });

  test("systemKw matches panel count × 400W", () => {
    const result = computeLayout([southFace], 15, 1700);
    const expected = Math.round((result.panelCount * PANEL_WATTS / 1000) * 10) / 10;
    expect(result.systemKw).toBe(expected);
  });

  test("annualKwh is positive when panels placed", () => {
    const result = computeLayout([southFace], 10, 1700);
    expect(result.annualKwh).toBeGreaterThan(0);
  });

  test("efficiencyScore is 0–100", () => {
    const result = computeLayout([southFace, westFace, northFace], 15, 1700);
    expect(result.efficiencyScore).toBeGreaterThanOrEqual(0);
    expect(result.efficiencyScore).toBeLessThanOrEqual(100);
  });

  test("south-only layout has higher efficiency than north-only", () => {
    const south = computeLayout([southFace], 10, 1700);
    const north = computeLayout([northFace], 10, 1700);
    expect(south.efficiencyScore).toBeGreaterThan(north.efficiencyScore);
  });

  test("all panels have valid segmentId and solarScore", () => {
    const result = computeLayout([southFace, westFace], 15, 1700);
    for (const panel of result.panels) {
      expect([0, 1]).toContain(panel.segmentId);
      expect(panel.solarScore).toBeGreaterThan(0);
      expect(panel.solarScore).toBeLessThanOrEqual(1);
    }
  });

  test("breakdown totals match panelCount", () => {
    const result = computeLayout([southFace, westFace], 15, 1700);
    const total = result.breakdown.reduce((s, b) => s + b.panels, 0);
    expect(total).toBe(result.panelCount);
  });
});

// ─── layoutToSVG ──────────────────────────────────────────────────────────────
describe("layoutToSVG()", () => {
  test("returns empty string for empty layout", () => {
    const empty = { panels: [], panelCount: 0, systemKw: 0, annualKwh: 0, efficiencyScore: 0, breakdown: [] };
    const svg = layoutToSVG(empty, [southFace], 25.77, -80.19, 20, 640, 480);
    expect(svg).toBe("");
  });

  test("returns valid SVG string when panels placed", () => {
    const layout = computeLayout([southFace], 8, 1700);
    const svg = layoutToSVG(layout, [southFace], 25.77, -80.19, 20, 640, 480);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("<rect");
  });

  test("SVG has correct viewBox dimensions", () => {
    const layout = computeLayout([southFace], 8, 1700);
    const svg = layoutToSVG(layout, [southFace], 25.77, -80.19, 20, 640, 480);
    expect(svg).toContain('viewBox="0 0 640 480"');
  });

  test("SVG contains panel-glow filter", () => {
    const layout = computeLayout([southFace], 5, 1700);
    const svg = layoutToSVG(layout, [southFace], 25.77, -80.19, 20, 640, 480);
    expect(svg).toMatch(/filter.*id=["']pg["']|id=["']panel-glow["']/);
  });
});
