/**
 * SolarAdvisor — Solar Layout Engine v3
 *
 * Key insight: Google Solar API returns many small segments (5-15m² each).
 * Splitting usable area per segment yields 0 rows per segment on small roofs.
 *
 * Solution: treat the roof as ONE grid per azimuth group.
 * Group segments by facing direction → combine their areas → one grid per group.
 * Place all panels for that group at the best segment's centre.
 */

export const PANEL_W_M   = 1.016;
export const PANEL_H_M   = 1.700;
export const PANEL_GAP   = 0.025;
export const PANEL_WATTS = 400;

// ─── Scoring ──────────────────────────────────────────────────────────────────
export function scoreFace(az: number, pitch: number, shading = 1.0, sunHours = 1600): number {
  const norm = ((az % 360) + 360) % 360;
  // Azimuth factor: south=1.0, west/east=0.80, north=0.45
  let af: number;
  if      (norm >= 157.5 && norm <= 202.5) af = 1.00;  // S
  else if (norm >= 112.5 && norm <= 247.5) af = 0.90;  // SE/SW broad
  else if (norm >= 67.5  && norm <= 292.5) af = 0.78;  // E/W
  else                                      af = 0.45;  // N
  // Tilt factor
  const tf = pitch < 5 ? 0.87 : pitch > 50 ? 0.82 : 0.90 + 0.10 * Math.cos(((pitch - 30) / 30) * Math.PI);
  return Math.min(1.0, af * tf * Math.min(1.0, shading) * Math.min(1.0, sunHours / 1825));
}

// ─── Whole-roof usable area (setbacks applied once) ───────────────────────────
function wholeRoofUsable(totalM2: number): number {
  if (totalM2 <= 0) return 0;
  const side = Math.sqrt(totalM2);
  // Standard US setbacks: 18" edges × 4, 18" ridge, 36" pathway
  const setbacks = (0.457 * side * 4) + (0.457 * side) + (0.914 * side);
  const after = (totalM2 - setbacks) * 0.85; // 15% obstructions
  // Floor: always at least 35% of raw area to handle tiny roofs
  return Math.max(totalM2 * 0.35, after);
}

// ─── Grid ─────────────────────────────────────────────────────────────────────
interface GridSpec {
  orientation: "portrait" | "landscape";
  cols: number;
  rows: number;
  maxPanels: number;
  panelW: number;
  panelH: number;
}

function bestGrid(areaM2: number): GridSpec {
  if (areaM2 <= 0) return { orientation:"portrait", cols:0, rows:0, maxPanels:0, panelW:PANEL_W_M, panelH:PANEL_H_M };
  // Approximate bounding rectangle from area
  const side = Math.sqrt(areaM2);
  const w = side * 1.6;  // wider than tall
  const h = side * 0.62;

  const cP = Math.max(0, Math.floor(w / (PANEL_W_M + PANEL_GAP)));
  const rP = Math.max(0, Math.floor(h / (PANEL_H_M + PANEL_GAP)));
  const cL = Math.max(0, Math.floor(w / (PANEL_H_M + PANEL_GAP)));
  const rL = Math.max(0, Math.floor(h / (PANEL_W_M + PANEL_GAP)));

  if (cL * rL > cP * rP) return { orientation:"landscape", cols:cL, rows:rL, maxPanels:cL*rL, panelW:PANEL_H_M, panelH:PANEL_W_M };
  return { orientation:"portrait", cols:cP, rows:rP, maxPanels:cP*rP, panelW:PANEL_W_M, panelH:PANEL_H_M };
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

// ─── Group segments by facing direction ───────────────────────────────────────
function azimuthBucket(az: number): string {
  const norm = ((az % 360) + 360) % 360;
  if (norm >= 135 && norm < 225) return "S";
  if (norm >= 225 && norm < 315) return "W";
  if (norm >= 45  && norm < 135) return "E";
  return "N";
}

interface FaceGroup {
  bucket: string;
  totalAreaM2: number;
  avgAzimuth: number;
  avgPitch: number;
  avgShading: number;
  bestSegment: RoofSegment; // for positioning the SVG panels
  score: number;
}

function groupByFacing(segments: RoofSegment[], sunHours: number): FaceGroup[] {
  const buckets = new Map<string, RoofSegment[]>();
  for (const seg of segments) {
    const key = azimuthBucket(seg.azimuthDegrees);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(seg);
  }

  const groups: FaceGroup[] = [];
  for (const [bucket, segs] of Array.from(buckets.entries())) {
    const totalArea = segs.reduce((s, g) => s + g.areaM2, 0);
    const avgAz     = segs.reduce((s, g) => s + g.azimuthDegrees, 0) / segs.length;
    const avgPitch  = segs.reduce((s, g) => s + g.pitchDegrees, 0) / segs.length;
    const avgShading = segs.reduce((s, g) => s + (g.shadingFactor ?? 1.0), 0) / segs.length;
    // Best segment = largest area (most representative for positioning)
    const bestSeg   = segs.reduce((a, b) => b.areaM2 > a.areaM2 ? b : a);
    const score     = scoreFace(avgAz, avgPitch, avgShading, sunHours);
    groups.push({ bucket, totalAreaM2: totalArea, avgAzimuth: avgAz, avgPitch, avgShading, bestSegment: bestSeg, score });
  }

  return groups.sort((a, b) => b.score - a.score); // energy-first
}

// ─── Main layout engine ───────────────────────────────────────────────────────
export function computeLayout(
  segments: RoofSegment[],
  targetPanels: number,
  annualSunHours = 1600
): LayoutResult {
  if (!segments.length || targetPanels <= 0) {
    return { panels:[], panelCount:0, systemKw:0, annualKwh:0, efficiencyScore:0, breakdown:[] };
  }

  const totalAreaM2 = segments.reduce((s, seg) => s + seg.areaM2, 0);
  const totalUsable = wholeRoofUsable(totalAreaM2);

  // Group small segments into face groups — prevents per-segment area being too small
  const groups = groupByFacing(segments, annualSunHours);

  const placed: PlacedPanel[] = [];
  const breakdown: LayoutResult["breakdown"] = [];
  let remaining = targetPanels;

  for (const group of groups) {
    if (remaining <= 0) break;

    // This group's share of usable area (proportional to its raw area)
    const groupUsable = (group.totalAreaM2 / totalAreaM2) * totalUsable;
    const grid = bestGrid(groupUsable);
    if (grid.maxPanels === 0) continue;

    const toPlace     = Math.min(grid.maxPanels, remaining);
    const fullRows    = Math.floor(toPlace / Math.max(1, grid.cols));
    const leftover    = toPlace - fullRows * grid.cols;
    const extraRow    = leftover >= Math.ceil(grid.cols * 0.5) ? 1 : 0;
    const actualRows  = fullRows + extraRow;
    const actualCount = Math.min(toPlace, actualRows * grid.cols);
    if (actualCount === 0) continue;

    const gridW  = grid.cols * (grid.panelW + PANEL_GAP);
    const gridH  = actualRows * (grid.panelH + PANEL_GAP);
    const rotDeg = group.avgAzimuth - 180;
    const seg    = group.bestSegment;

    let n = 0;
    for (let r = 0; r < actualRows && n < actualCount; r++) {
      for (let c = 0; c < grid.cols && n < actualCount; c++) {
        placed.push({
          segmentId:   seg.id,
          localX:      -gridW/2 + c*(grid.panelW + PANEL_GAP) + grid.panelW/2,
          localY:      -gridH/2 + r*(grid.panelH + PANEL_GAP) + grid.panelH/2,
          orientation: grid.orientation,
          rotationDeg: rotDeg,
          solarScore:  group.score,
        });
        n++;
      }
    }

    breakdown.push({ segmentId: seg.id, panels: actualCount, score: group.score, orientation: grid.orientation });
    remaining -= actualCount;
  }

  const panelCount      = placed.length;
  const systemKw        = Math.round((panelCount * PANEL_WATTS / 1000) * 10) / 10;
  const avgScore        = placed.reduce((s, p) => s + p.solarScore, 0) / Math.max(1, panelCount);
  const annualKwh       = Math.round(systemKw * (annualSunHours / 365) * 365 * 0.80);
  const efficiencyScore = Math.round(avgScore * 100);

  return { panels:placed, panelCount, systemKw, annualKwh, efficiencyScore, breakdown };
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

    if (segPxX < -100 || segPxX > imgW+100 || segPxY < -100 || segPxY > imgH+100) continue;

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
