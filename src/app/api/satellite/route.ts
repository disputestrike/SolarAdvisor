import { NextRequest, NextResponse } from "next/server";
import { q1, qExec } from "@/db";

async function geocode(query: string, key: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${key}`,
      { signal: AbortSignal.timeout(6000) }
    );
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.[0]) return null;
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  } catch { return null; }
}

async function getSolarData(lat: number, lng: number, key: string) {
  try {
    const res = await fetch(
      `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${key}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Project lat/lng offset from center → pixel coords on the satellite image
function latLngToPixel(
  lat: number, lng: number,
  centerLat: number, centerLng: number,
  zoom: number, imgW: number, imgH: number
): { x: number; y: number } {
  const metersPerPx = 156543.03392 * Math.cos(centerLat * Math.PI / 180) / Math.pow(2, zoom);
  const dLat = lat - centerLat;
  const dLng = lng - centerLng;
  const x = imgW / 2 + (dLng * 111320 * Math.cos(centerLat * Math.PI / 180)) / metersPerPx;
  const y = imgH / 2 - (dLat * 111320) / metersPerPx;
  return { x, y };
}

// Distance in metres between two lat/lng points
function distMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dx = (lng2 - lng1) * 111320 * Math.cos(lat1 * Math.PI / 180);
  const dy = (lat2 - lat1) * 111320;
  return Math.sqrt(dx * dx + dy * dy);
}

function buildOverlaySVG(
  solarData: Record<string, unknown>,
  centerLat: number, centerLng: number,
  panelCount: number,
  zoom: number, imgW: number, imgH: number
): string {
  const potential = solarData?.solarPotential as Record<string, unknown> | undefined;

  interface Seg {
    pitchDegrees: number;
    azimuthDegrees: number;
    stats: { areaMeters2: number };
    center: { latitude: number; longitude: number };
  }

  const allSegments: Seg[] = (potential?.roofSegmentStats as Seg[] | undefined) || [];

  // CRITICAL FIX: only use segments within 15m of the building center
  // This prevents panels appearing on neighbor roofs
  const ownSegments = allSegments.filter(seg => {
    if (!seg.center) return false;
    const dist = distMeters(centerLat, centerLng, seg.center.latitude, seg.center.longitude);
    return dist < 25; // metres — tight radius around this specific building
  });

  const segments = ownSegments.length > 0 ? ownSegments : allSegments.slice(0, 2);

  // Sort by suitability: south-facing (azimuth ~180) and low pitch
  const sorted = [...segments].sort((a, b) => {
    const scoreA = Math.abs(180 - (a.azimuthDegrees || 180)) + (a.pitchDegrees || 20) * 0.3;
    const scoreB = Math.abs(180 - (b.azimuthDegrees || 180)) + (b.pitchDegrees || 20) * 0.3;
    return scoreA - scoreB;
  });

  const metersPerPx = 156543.03392 * Math.cos(centerLat * Math.PI / 180) / Math.pow(2, zoom);
  // Standard residential panel: 1.7m × 1.0m
  const panelH = 1.7 / metersPerPx;
  const panelW = 1.0 / metersPerPx;
  const gap    = 0.05 / metersPerPx;

  const panelsSVG: string[] = [];
  let placed = 0;

  for (const seg of sorted) {
    if (placed >= panelCount) break;
    if (!seg.center) continue;

    const { x: cx, y: cy } = latLngToPixel(
      seg.center.latitude, seg.center.longitude,
      centerLat, centerLng, zoom, imgW, imgH
    );

    // Skip if segment centre is outside image bounds (another building)
    if (cx < 0 || cx > imgW || cy < 0 || cy > imgH) continue;

    const areaM2 = seg.stats?.areaMeters2 || 15;
    const maxInSeg = Math.min(Math.floor(areaM2 / 1.9), panelCount - placed);
    if (maxInSeg <= 0) continue;

    const azimuth = seg.azimuthDegrees || 180;
    const rotDeg  = azimuth - 180;
    const rad     = rotDeg * Math.PI / 180;

    // Grid layout centred on segment
    const cols = Math.max(1, Math.min(6, Math.round(Math.sqrt(maxInSeg * (panelW / panelH)))));
    const rows = Math.ceil(maxInSeg / cols);
    const gridW = cols * (panelW + gap);
    const gridH = rows * (panelH + gap);

    for (let r = 0; r < rows && placed < panelCount; r++) {
      for (let c = 0; c < cols && placed < panelCount; c++) {
        // Local coords relative to segment centre
        const lx = -gridW / 2 + c * (panelW + gap);
        const ly = -gridH / 2 + r * (panelH + gap);
        // Rotate
        const rx = cx + lx * Math.cos(rad) - ly * Math.sin(rad);
        const ry = cy + lx * Math.sin(rad) + ly * Math.cos(rad);

        panelsSVG.push(
          `<g transform="translate(${rx.toFixed(1)},${ry.toFixed(1)}) rotate(${rotDeg})">` +
          `<rect width="${panelW.toFixed(1)}" height="${panelH.toFixed(1)}" fill="#1a237e" stroke="#4fc3f7" stroke-width="0.5" rx="0.5" opacity="0.9"/>` +
          `<line x1="${(panelW/3).toFixed(1)}" y1="0" x2="${(panelW/3).toFixed(1)}" y2="${panelH.toFixed(1)}" stroke="#4fc3f7" stroke-width="0.3" opacity="0.5"/>` +
          `<line x1="${(panelW*2/3).toFixed(1)}" y1="0" x2="${(panelW*2/3).toFixed(1)}" y2="${panelH.toFixed(1)}" stroke="#4fc3f7" stroke-width="0.3" opacity="0.5"/>` +
          `<line x1="0" y1="${(panelH/2).toFixed(1)}" x2="${panelW.toFixed(1)}" y2="${(panelH/2).toFixed(1)}" stroke="#4fc3f7" stroke-width="0.3" opacity="0.5"/>` +
          `</g>`
        );
        placed++;
      }
    }
  }

  // Fallback: if no segments or all out of bounds, centre on building
  if (panelsSVG.length === 0) {
    const cols = Math.min(6, Math.ceil(Math.sqrt(panelCount * 1.2)));
    const rows = Math.ceil(panelCount / cols);
    const startX = imgW / 2 - (cols * (panelW + gap)) / 2;
    const startY = imgH / 2 - (rows * (panelH + gap)) / 2 - 10;
    let n = 0;
    for (let r = 0; r < rows && n < panelCount; r++) {
      for (let c = 0; c < cols && n < panelCount; c++) {
        const px = startX + c * (panelW + gap);
        const py = startY + r * (panelH + gap);
        panelsSVG.push(
          `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${panelW.toFixed(1)}" height="${panelH.toFixed(1)}" fill="#1a237e" stroke="#4fc3f7" stroke-width="0.5" rx="0.5" opacity="0.9"/>`
        );
        n++;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${imgW} ${imgH}" width="${imgW}" height="${imgH}" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">
  <defs><filter id="pg"><feGaussianBlur stdDeviation="1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <g filter="url(#pg)">${panelsSVG.join("")}</g>
</svg>`;
}

export async function GET(req: NextRequest) {
  const zip      = req.nextUrl.searchParams.get("zip") || "";
  const address  = req.nextUrl.searchParams.get("address") || "";
  const latParam = req.nextUrl.searchParams.get("lat");
  const lngParam = req.nextUrl.searchParams.get("lng");
  const panels   = parseInt(req.nextUrl.searchParams.get("panels") || "12");
  const zoom     = 20;
  const imgW = 640, imgH = 480;
  const key  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  let lat: number | null = null;
  let lng: number | null = null;
  let city: string | null = null;
  let state: string | null = null;

  // Priority 1: exact coords from Google Places (most accurate)
  const latN = latParam ? parseFloat(latParam) : NaN;
  const lngN = lngParam ? parseFloat(lngParam) : NaN;
  if (!Number.isNaN(latN) && !Number.isNaN(lngN)) { lat = latN; lng = lngN; }

  // Priority 2: geocode full address
  if (!lat && address && key) {
    const geo = await geocode(address, key);
    if (geo) { lat = geo.lat; lng = geo.lng; }
  }

  // Priority 3: ZIP cache / geocode
  if (!lat && zip && /^\d{5}$/.test(zip)) {
    try {
      const cached = await q1<{ lat: string; lng: string; city: string; state: string }>(
        "SELECT lat, lng, city, state FROM zip_cache WHERE zip_code = ? LIMIT 1", [zip]
      );
      if (cached?.lat) { lat = parseFloat(cached.lat); lng = parseFloat(cached.lng); city = cached.city; state = cached.state; }
    } catch { /* non-blocking */ }

    if (!lat && key) {
      const geo = await geocode(zip, key);
      if (geo) {
        lat = geo.lat; lng = geo.lng;
        try { await qExec("INSERT IGNORE INTO zip_cache (zip_code, lat, lng) VALUES (?,?,?)", [zip, lat, lng]); } catch { /* best effort */ }
      }
    }
  }

  if (!lat || !lng) {
    return NextResponse.json({ error: "Could not resolve location." }, { status: 400 });
  }

  // Google Solar API
  let solarData = null;
  let roofAreaM2 = 100;
  let maxPanels = 24;
  let annualSunshine = 1600;

  if (key) {
    solarData = await getSolarData(lat, lng, key);
    if (solarData?.solarPotential) {
      roofAreaM2    = solarData.solarPotential.wholeRoofStats?.areaMeters2 || 100;
      maxPanels     = Math.min(32, solarData.solarPotential.maxArrayPanelsCount || 24);
      annualSunshine = solarData.solarPotential.maxSunshineHoursPerYear || 1600;
    }
  }

  // Deterministic fallback
  if (!solarData && zip) {
    const seed = parseInt(zip, 10);
    roofAreaM2     = 80 + (seed % 80);
    annualSunshine = 1300 + (seed % 500);
    maxPanels      = Math.min(24, Math.round(roofAreaM2 / 4));
  }

  const suggestedPanels = Math.max(4, Math.min(maxPanels, Math.round(roofAreaM2 / 7)));
  const panelCount = Math.max(4, Math.min(maxPanels, Number.isFinite(panels) ? panels : suggestedPanels));

  const satelliteUrl = key
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${imgW}x${imgH}&maptype=satellite&key=${key}`
    : null;

  const overlaySvg = buildOverlaySVG(solarData || {}, lat, lng, panelCount, zoom, imgW, imgH);

  return NextResponse.json({
    success: true, zip, city, state, lat, lng, hasGoogleKey: !!key,
    satellite: { imageUrl: satelliteUrl, zoom },
    roof: { areaM2: Math.round(roofAreaM2), maxPanels, annualSunshineHours: Math.round(annualSunshine), panelsSuggested: suggestedPanels },
    overlay: { svg: overlaySvg, panelCount },
    solarApiData: solarData ? { imageryDate: solarData.imageryDate, roofSegments: solarData.solarPotential?.roofSegmentStats?.length || 0 } : null,
  });
}
