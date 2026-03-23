/**
 * SolarAdvisor — Constraint-driven Solar Layout Engine
 *
 * Pipeline:
 * 1. Score each roof face (azimuth × tilt × shading × sun hours)
 * 2. Compute usable area after setbacks (edge, ridge, pathway)
 * 3. Generate panel grid (portrait vs landscape — pick best)
 * 4. Energy-first fill (best faces filled first)
 * 5. Target system size control (stop at needed panels)
 * 6. Clean block enforcement (no isolated/jagged panels)
 * 7. Project panels onto satellite image via Web Mercator
 */

// ─── Panel & setback constants ────────────────────────────────────────────────
export const PANEL_W_M   = 1.016;  // 40 inches — panel short side
export const PANEL_H_M   = 1.700;  // 67 inches — panel long side
export const PANEL_GAP   = 0.025;  // ~1 inch between panels
export const PANEL_WATTS = 400;

const SETBACK_EDGE_M    = 0.457;   // 18 inches from roof edge
const SETBACK_RIDGE_M   = 0.457;   // 18 inches from ridge
const SETBACK_PATHWAY_M = 0.914;   // 36 inches fire access pathway

// ─── Orientation scoring ──────────────────────────────────────────────────────
const AZIMUTH_FACTOR: Array<{ max: number; factor: number }> = [
  { max: 22.5,  factor: 0.45 }, // N
  { max: 45,    factor: 0.50 }, // NNE
  { max: 67.5,  factor: 0.58 }, // NE
  { max: 90,    factor: 0.68 }, // ENE
  { max: 112.5, factor: 0.75 }, // E
  { max: 135,   factor: 0.85 }, // ESE
  { max: 157.5, factor: 0.93 }, // SE
  { max: 180,   factor: 0.98 }, // SSE
  { max: 202.5, factor: 1.00 }, // S  ← peak
  { max: 225,   factor: 0.98 }, // SSW
  { max: 247.5, factor: 0.93 }, // SW
  { max: 270,   factor: 0.85 }, // WSW
  { max: 292.5, factor: 0.75 }, // W
  { max: 315,   factor: 0.65 }, // WNW
  { max: 337.5, factor: 0.52 }, // NW
  { max: 360,   factor: 0.45 }, // NNW
];

function azimuthFactor(az: number): number {
  const norm = ((az % 360) + 360) % 360;
  for (const { max, factor } of AZIMUTH_FACTOR) {
    if (norm <= max) return factor;
  }
  return 0.45;
}

function tiltFactor(pitch: number): number {
  if (pitch < 5)  return 0.87;   // flat roof
  if (pitch > 50) return 0.82;   // very steep
  // Peak at 30° — smooth curve
  return 0.90 + 0.10 * Math.cos(((pitch - 30) / 30) * Math.PI);
}

export function scoreFace(
  azimuth: number,
  pitch: number,
  shadingFactor = 1.0,
  annualSunHours = 1600
): number {
  const sunFactor = Math.min(1.0, annualSunHours / 1825); // normalised to 5h/day
  return Math.min(1.0,
    azimuthFactor(azimuth) *
    tiltFactor(pitch) *
    Math.min(1.0, shadingFactor) *
    sunFactor
  );
}

// ─── Usable area after setbacks ───────────────────────────────────────────────
function usableAreaM2(raw: number, pitch: number): number {
  if (raw <= 0) return 0;
  const side = Math.sqrt(raw);
  // Setback strip area: 4 edges + ridge + 1 pathway
  const edgeStrip    = SETBACK_EDGE_M    * side * 4;
  const ridgeStrip   = SETBACK_RIDGE_M   * side;
  const pathwayStrip = pitch > 3 ? SETBACK_PATHWAY_M * side : 0;
  // Additional 15% for obstructions (vents, chimneys, skylights)
  const usable = (raw - edgeStrip - ridgeStrip - pathwayStrip) * 0.85;
  return Math.max(0, usable);
}

// ─── Grid computation ─────────────────────────────────────────────────────────
interface GridSpec {
  orientation: "portrait" | "landscape";
  cols: number;
  rows: number;
  maxPanels: number;
  panelW: number;  // metres — width of panel in this orientation
  panelH: number;  // metres — height of panel in this orientation
}

function computeGrid(usableM2: number): GridSpec {
  if (usableM2 <= 0) return { orientation: "portrait", cols: 0, rows: 0, maxPanels: 0, panelW: PANEL_W_M, panelH: PANEL_H_M };

  // Approximate rectangle from area (roofs are wider than tall)
  const side = Math.sqrt(usableM2);
  const w = side * 1.45;
  const h = side * 0.69;

  // Portrait: narrow side horizontal
  const colsP = Math.max(0, Math.floor(w / (PANEL_W_M + PANEL_GAP)));
  const rowsP = Math.max(0, Math.floor(h / (PANEL_H_M + PANEL_GAP)));

  // Landscape: wide side horizontal
  const colsL = Math.max(0, Math.floor(w / (PANEL_H_M + PANEL_GAP)));
  const rowsL = Math.max(0, Math.floor(h / (PANEL_W_M + PANEL_GAP)));

  const countP = colsP * rowsP;
  const countL = colsL * rowsL;

  if (countL > countP) {
    return { orientation: "landscape", cols: colsL, rows: rowsL, maxPanels: countL, panelW: PANEL_H_M, panelH: PANEL_W_M };
  }
  return { orientation: "portrait", cols: colsP, rows: rowsP, maxPanels: countP, panelW: PANEL_W_M, panelH: PANEL_H_M };
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RoofSegment {
  id: number;
  centerLat: number;
  centerLng: number;
  areaM2: number;
  pitchDegrees: number;
  azimuthDegrees: number;
  shadingFactor?: number;
}

export interface PlacedPanel {
  segmentId: number;
  localX: number;   // metres from segment centre
  localY: number;
  orientation: "portrait" | "landscape";
  rotationDeg: number;
  solarScore: number;
}

export interface LayoutResult {
  panels: PlacedPanel[];
  panelCount: number;
  systemKw: number;
  annualKwh: number;
  efficiencyScore: number;  // 0–100
  breakdown: Array<{ segmentId: number; panels: number; score: number; orientation: string }>;
}

// ─── Main layout engine ───────────────────────────────────────────────────────
export function computeLayout(
  segments: RoofSegment[],
  targetPanels: number,
  annualSunHours = 1600
): LayoutResult {
  if (!segments.length || targetPanels <= 0) {
    return { panels: [], panelCount: 0, systemKw: 0, annualKwh: 0, efficiencyScore: 0, breakdown: [] };
  }

  // Step 1: Score, compute usable area, compute grid for every segment
  const candidates = segments
    .map(seg => {
      const score   = scoreFace(seg.azimuthDegrees, seg.pitchDegrees, seg.shadingFactor ?? 1.0, annualSunHours);
      const usable  = usableAreaM2(seg.areaM2, seg.pitchDegrees);
      const grid    = computeGrid(usable);
      return { seg, score, usable, grid };
    })
    .filter(c => c.grid.maxPanels > 0)
    // ENERGY-FIRST: best solar score fills first
    .sort((a, b) => b.score - a.score);

  const placed: PlacedPanel[] = [];
  const breakdown: LayoutResult["breakdown"] = [];
  let remaining = targetPanels;

  // Step 2: Fill segments in score order until target reached
  for (const { seg, score, grid } of candidates) {
    if (remaining <= 0) break;

    const toPlace     = Math.min(grid.maxPanels, remaining);
    const fullRows    = Math.floor(toPlace / grid.cols);
    const leftover    = toPlace - fullRows * grid.cols;
    // Clean block rule: accept partial last row only if ≥ 50% filled
    const extraRow    = (leftover > 0 && leftover >= grid.cols * 0.5) ? 1 : 0;
    const actualRows  = fullRows + extraRow;
    const actualCount = actualRows * grid.cols;

    if (actualCount === 0) continue;

    const gridW    = grid.cols * (grid.panelW + PANEL_GAP);
    const gridH    = actualRows * (grid.panelH + PANEL_GAP);
    const rotDeg   = seg.azimuthDegrees - 180;

    for (let r = 0; r < actualRows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const lx = -gridW / 2 + c * (grid.panelW + PANEL_GAP) + grid.panelW / 2;
        const ly = -gridH / 2 + r * (grid.panelH + PANEL_GAP) + grid.panelH / 2;
        placed.push({
          segmentId: seg.id,
          localX: lx,
          localY: ly,
          orientation: grid.orientation,
          rotationDeg: rotDeg,
          solarScore: score,
        });
      }
    }

    breakdown.push({ segmentId: seg.id, panels: actualCount, score, orientation: grid.orientation });
    remaining -= actualCount;
  }

  const panelCount     = placed.length;
  const systemKw       = Math.round((panelCount * PANEL_WATTS / 1000) * 10) / 10;
  const avgScore       = placed.reduce((s, p) => s + p.solarScore, 0) / Math.max(1, panelCount);
  const annualKwh      = Math.round(systemKw * annualSunHours * 0.80);
  const efficiencyScore = Math.round(avgScore * 100);

  return { panels: placed, panelCount, systemKw, annualKwh, efficiencyScore, breakdown };
}

// ─── Project layout → SVG overlay on satellite image ─────────────────────────
export function layoutToSVG(
  layout: LayoutResult,
  segments: RoofSegment[],
  centerLat: number,
  centerLng: number,
  zoom: number,
  imgW: number,
  imgH: number
): string {
  if (!layout.panels.length) return "";

  const metersPerPx = 156543.03392 * Math.cos(centerLat * Math.PI / 180) / Math.pow(2, zoom);
  const segMap = new Map(segments.map(s => [s.id, s]));
  const svgPanels: string[] = [];

  for (const panel of layout.panels) {
    const seg = segMap.get(panel.segmentId);
    if (!seg) continue;

    // Segment centre in pixels relative to image centre
    const dxM = (seg.centerLng - centerLng) * 111320 * Math.cos(centerLat * Math.PI / 180);
    const dyM = (seg.centerLat - centerLat) * 111320;
    const segPxX = imgW / 2 + dxM / metersPerPx;
    const segPxY = imgH / 2 - dyM / metersPerPx;

    // Panel local offset in pixels
    const localPxX = panel.localX / metersPerPx;
    const localPxY = panel.localY / metersPerPx;

    // Panel dimensions in pixels
    const pW = (panel.orientation === "portrait" ? PANEL_W_M : PANEL_H_M) / metersPerPx;
    const pH = (panel.orientation === "portrait" ? PANEL_H_M : PANEL_W_M) / metersPerPx;

    // Rotate local offset around segment centre
    const rad = (panel.rotationDeg * Math.PI) / 180;
    const rotX = localPxX * Math.cos(rad) - localPxY * Math.sin(rad);
    const rotY = localPxX * Math.sin(rad) + localPxY * Math.cos(rad);

    const finalX = segPxX + rotX - pW / 2;
    const finalY = segPxY + rotY - pH / 2;

    // Skip panels outside image bounds
    if (finalX < -pW || finalX > imgW || finalY < -pH || finalY > imgH) continue;

    // Colour by solar score: high = blue, medium = teal, lower = grey-blue
    const score = panel.solarScore;
    const fill  = score > 0.85 ? "#1a237e" : score > 0.70 ? "#1565c0" : "#1976d2";
    const stroke = score > 0.85 ? "#4fc3f7" : "#81d4fa";

    svgPanels.push(
      `<g transform="translate(${finalX.toFixed(1)},${finalY.toFixed(1)}) rotate(${panel.rotationDeg},${(pW/2).toFixed(1)},${(pH/2).toFixed(1)})">` +
      `<rect width="${pW.toFixed(1)}" height="${pH.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="0.5" rx="0.4" opacity="0.92"/>` +
      `<line x1="${(pW/3).toFixed(1)}" y1="0" x2="${(pW/3).toFixed(1)}" y2="${pH.toFixed(1)}" stroke="${stroke}" stroke-width="0.25" opacity="0.5"/>` +
      `<line x1="${(pW*2/3).toFixed(1)}" y1="0" x2="${(pW*2/3).toFixed(1)}" y2="${pH.toFixed(1)}" stroke="${stroke}" stroke-width="0.25" opacity="0.5"/>` +
      `<line x1="0" y1="${(pH/2).toFixed(1)}" x2="${pW.toFixed(1)}" y2="${(pH/2).toFixed(1)}" stroke="${stroke}" stroke-width="0.25" opacity="0.5"/>` +
      `</g>`
    );
  }

  if (!svgPanels.length) return "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${imgW} ${imgH}" width="${imgW}" height="${imgH}" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">
  <defs>
    <filter id="panel-glow">
      <feGaussianBlur stdDeviation="0.8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g filter="url(#panel-glow)">${svgPanels.join("")}</g>
</svg>`;
}
