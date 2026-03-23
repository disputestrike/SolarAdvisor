/**
 * SolarAdvisor — Solar Layout Engine
 *
 * Key fix: setbacks are applied to the WHOLE roof, not to each segment individually.
 * Applying per-segment setbacks destroys small segments (15-30m²) and yields 0 panels.
 *
 * Pipeline:
 * 1. Score each face (azimuth × tilt × shading × sun hours)
 * 2. Compute usable area using the WHOLE roof area for setbacks
 * 3. Distribute usable area across segments proportionally
 * 4. Generate grid per segment (portrait vs landscape)
 * 5. Energy-first fill (best faces first)
 * 6. Target panel count control (stop when reached)
 * 7. Clean block rule (no isolated rows)
 */

export const PANEL_W_M   = 1.016;  // 40 inches
export const PANEL_H_M   = 1.700;  // 67 inches
export const PANEL_GAP   = 0.025;
export const PANEL_WATTS = 400;

// ─── Solar scoring ────────────────────────────────────────────────────────────
const AZIMUTH_SCORE: Array<[number, number]> = [
  [22.5, 0.45], [45, 0.50], [67.5, 0.58], [90, 0.68],
  [112.5, 0.75], [135, 0.85], [157.5, 0.93], [180, 1.00],
  [202.5, 0.98], [225, 0.93], [247.5, 0.88], [270, 0.80],
  [292.5, 0.70], [315, 0.60], [337.5, 0.50], [360, 0.45],
];

function azimuthFactor(az: number): number {
  const norm = ((az % 360) + 360) % 360;
  for (const [max, f] of AZIMUTH_SCORE) if (norm <= max) return f;
  return 0.45;
}

function tiltFactor(pitch: number): number {
  if (pitch < 5) return 0.87;
  if (pitch > 50) return 0.82;
  return 0.90 + 0.10 * Math.cos(((pitch - 30) / 30) * Math.PI);
}

export function scoreFace(az: number, pitch: number, shading = 1.0, sunHours = 1600): number {
  return Math.min(1.0, azimuthFactor(az) * tiltFactor(pitch) * Math.min(1.0, shading) * Math.min(1.0, sunHours / 1825));
}

// ─── Usable area — applied to whole roof, not per segment ────────────────────
// Setbacks are a property of the whole roof perimeter, not each face.
function wholeRoofUsable(totalAreaM2: number): number {
  if (totalAreaM2 <= 0) return 0;
  const side = Math.sqrt(totalAreaM2);
  // Edge setback (18") × 4 sides
  const edgeSetback   = 0.457 * side * 4;
  // Ridge setback (18") × one ridge
  const ridgeSetback  = 0.457 * side;
  // Fire pathway (36") × one pathway
  const pathway       = 0.914 * side;
  // 15% obstruction buffer (vents, chimneys, skylights)
  const usable = (totalAreaM2 - edgeSetback - ridgeSetback - pathway) * 0.85;
  return Math.max(totalAreaM2 * 0.40, usable); // never below 40% of raw area
}

// ─── Grid computation ─────────────────────────────────────────────────────────
interface GridSpec {
  orientation: "portrait" | "landscape";
  cols: number;
  rows: number;
  maxPanels: number;
  panelW: number;
  panelH: number;
}

function computeGrid(usableM2: number): GridSpec {
  if (usableM2 <= 0) return { orientation: "portrait", cols: 0, rows: 0, maxPanels: 0, panelW: PANEL_W_M, panelH: PANEL_H_M };
  // Treat segment as approximately rectangular (wider than tall for most roofs)
  const side = Math.sqrt(usableM2);
  const w = side * 1.45;
  const h = side * 0.69;

  const colsP = Math.max(0, Math.floor(w / (PANEL_W_M + PANEL_GAP)));
  const rowsP = Math.max(0, Math.floor(h / (PANEL_H_M + PANEL_GAP)));
  const colsL = Math.max(0, Math.floor(w / (PANEL_H_M + PANEL_GAP)));
  const rowsL = Math.max(0, Math.floor(h / (PANEL_W_M + PANEL_GAP)));

  if (colsL * rowsL > colsP * rowsP) {
    return { orientation: "landscape", cols: colsL, rows: rowsL, maxPanels: colsL * rowsL, panelW: PANEL_H_M, panelH: PANEL_W_M };
  }
  return { orientation: "portrait", cols: colsP, rows: rowsP, maxPanels: colsP * rowsP, panelW: PANEL_W_M, panelH: PANEL_H_M };
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
  localX: number;
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
  efficiencyScore: number;
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

  // Total roof area across all segments
  const totalAreaM2 = segments.reduce((s, seg) => s + seg.areaM2, 0);
  // Apply setbacks ONCE to the whole roof
  const totalUsable = wholeRoofUsable(totalAreaM2);

  // Score each segment and allocate usable area proportionally
  const scored = segments
    .map(seg => {
      const score = scoreFace(seg.azimuthDegrees, seg.pitchDegrees, seg.shadingFactor ?? 1.0, annualSunHours);
      // Each segment gets its proportional share of the usable area
      const segUsable = (seg.areaM2 / totalAreaM2) * totalUsable;
      const grid = computeGrid(segUsable);
      return { seg, score, segUsable, grid };
    })
    .filter(c => c.grid.maxPanels > 0)
    .sort((a, b) => b.score - a.score); // energy-first

  const placed: PlacedPanel[] = [];
  const breakdown: LayoutResult["breakdown"] = [];
  let remaining = targetPanels;

  for (const { seg, score, grid } of scored) {
    if (remaining <= 0) break;

    const toPlace     = Math.min(grid.maxPanels, remaining);
    const fullRows    = Math.floor(toPlace / grid.cols);
    const leftover    = toPlace - fullRows * grid.cols;
    const extraRow    = leftover >= Math.ceil(grid.cols * 0.5) ? 1 : 0;
    const actualRows  = fullRows + extraRow;
    const actualCount = Math.min(toPlace, actualRows * grid.cols);
    if (actualCount === 0) continue;

    const gridW  = grid.cols * (grid.panelW + PANEL_GAP);
    const gridH  = actualRows * (grid.panelH + PANEL_GAP);
    const rotDeg = seg.azimuthDegrees - 180;

    let loopCount = 0;
    for (let r = 0; r < actualRows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (loopCount >= actualCount) break;
        placed.push({
          segmentId: seg.id,
          localX: -gridW / 2 + c * (grid.panelW + PANEL_GAP) + grid.panelW / 2,
          localY: -gridH / 2 + r * (grid.panelH + PANEL_GAP) + grid.panelH / 2,
          orientation: grid.orientation,
          rotationDeg: rotDeg,
          solarScore: score,
        });
        loopCount++;
      }
      if (loopCount >= actualCount) break;
    }

    breakdown.push({ segmentId: seg.id, panels: actualCount, score, orientation: grid.orientation });
    remaining -= actualCount;
  }

  const panelCount      = placed.length;
  const systemKw        = Math.round((panelCount * PANEL_WATTS / 1000) * 10) / 10;
  const avgScore        = placed.reduce((s, p) => s + p.solarScore, 0) / Math.max(1, panelCount);
  const annualKwh       = Math.round(systemKw * (annualSunHours / 365) * 365 * 0.80);
  const efficiencyScore = Math.round(avgScore * 100);

  return { panels: placed, panelCount, systemKw, annualKwh, efficiencyScore, breakdown };
}

// ─── SVG overlay ──────────────────────────────────────────────────────────────
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

    const dxM = (seg.centerLng - centerLng) * 111320 * Math.cos(centerLat * Math.PI / 180);
    const dyM = (seg.centerLat - centerLat) * 111320;
    const segPxX = imgW / 2 + dxM / metersPerPx;
    const segPxY = imgH / 2 - dyM / metersPerPx;

    if (segPxX < -50 || segPxX > imgW + 50 || segPxY < -50 || segPxY > imgH + 50) continue;

    const pW = (panel.orientation === "portrait" ? PANEL_W_M : PANEL_H_M) / metersPerPx;
    const pH = (panel.orientation === "portrait" ? PANEL_H_M : PANEL_W_M) / metersPerPx;

    const finalX = segPxX + panel.localX / metersPerPx - pW / 2;
    const finalY = segPxY + panel.localY / metersPerPx - pH / 2;

    if (finalX < -pW || finalX > imgW || finalY < -pH || finalY > imgH) continue;

    const fill   = panel.solarScore > 0.85 ? "#1a237e" : "#1565c0";
    const stroke = panel.solarScore > 0.85 ? "#4fc3f7" : "#81d4fa";

    svgPanels.push(
      `<g transform="translate(${finalX.toFixed(1)},${finalY.toFixed(1)}) rotate(${panel.rotationDeg},${(pW/2).toFixed(1)},${(pH/2).toFixed(1)})">` +
      `<rect width="${pW.toFixed(1)}" height="${pH.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="0.6" rx="0.5" opacity="0.92"/>` +
      `<line x1="${(pW/3).toFixed(1)}" y1="0" x2="${(pW/3).toFixed(1)}" y2="${pH.toFixed(1)}" stroke="${stroke}" stroke-width="0.3" opacity="0.5"/>` +
      `<line x1="${(pW*2/3).toFixed(1)}" y1="0" x2="${(pW*2/3).toFixed(1)}" y2="${pH.toFixed(1)}" stroke="${stroke}" stroke-width="0.3" opacity="0.5"/>` +
      `<line x1="0" y1="${(pH/2).toFixed(1)}" x2="${pW.toFixed(1)}" y2="${(pH/2).toFixed(1)}" stroke="${stroke}" stroke-width="0.3" opacity="0.5"/>` +
      `</g>`
    );
  }

  if (!svgPanels.length) return "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${imgW} ${imgH}" width="${imgW}" height="${imgH}" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">
  <defs><filter id="pg"><feGaussianBlur stdDeviation="0.8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <g filter="url(#pg)">${svgPanels.join("")}</g>
</svg>`;
}
