import { NextRequest, NextResponse } from "next/server";
import { q1, qExec } from "@/db";

// ─── Geocode full address or ZIP → lat/lng ────────────────────────────────────
async function geocode(query: string, key: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${key}`,
      { signal: AbortSignal.timeout(6000) }
    );
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.[0]) return null;
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng, formatted: data.results[0].formatted_address };
  } catch { return null; }
}

// ─── Google Solar API ─────────────────────────────────────────────────────────
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

// ─── Project lat/lng → pixel coords on the Static Maps image ─────────────────
// Google Static Maps at zoom=20, 640×480: each pixel ≈ 0.149m at equator
// We use Mercator projection relative to the center point.
function latLngToPixel(
  lat: number, lng: number,
  centerLat: number, centerLng: number,
  zoom: number, imgW: number, imgH: number
): { x: number; y: number } {
  // Use metres-per-pixel at this lat/zoom (Web Mercator)
  const metersPerPx = 156543.03392 * Math.cos(centerLat * Math.PI / 180) / Math.pow(2, zoom);
  const dLat = lat - centerLat;
  const dLng = lng - centerLng;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(centerLat * Math.PI / 180);
  const x = imgW / 2 + (dLng * metersPerDegLng) / metersPerPx;
  const y = imgH / 2 - (dLat * metersPerDegLat) / metersPerPx;
  return { x, y };
}

// ─── Build SVG overlay using Solar API roof segment data ─────────────────────
function buildSolarOverlaySVG(
  solarData: Record<string, unknown>,
  centerLat: number, centerLng: number,
  panelCount: number,
  zoom: number,
  imgW: number, imgH: number
): string {
  const potential = solarData?.solarPotential as Record<string, unknown> | undefined;

  // Use roofSegmentStats to find the best roof faces
  interface SegStats { pitchDegrees: number; azimuthDegrees: number; stats: { areaMeters2: number; sunshineQuantiles: number[] }; center: { latitude: number; longitude: number } }
  const segments: SegStats[] = (potential?.roofSegmentStats as SegStats[] | undefined) || [];

  // Sort segments by suitability: south-facing (azimuth ~180) and low pitch wins
  const sorted = [...segments].sort((a, b) => {
    const scoreA = Math.abs(180 - (a.azimuthDegrees || 180)) + (a.pitchDegrees || 20) * 0.5;
    const scoreB = Math.abs(180 - (b.azimuthDegrees || 180)) + (b.pitchDegrees || 20) * 0.5;
    return scoreA - scoreB;
  });

  // Panel dimensions in metres: standard 2m × 1m panel
  const panelHm = 2.0;
  const panelWm = 1.0;
  const metersPerPx = 156543.03392 * Math.cos(centerLat * Math.PI / 180) / Math.pow(2, zoom);
  const panelHpx = panelHm / metersPerPx;
  const panelWpx = panelWm / metersPerPx;
  const gapPx = 0.15 / metersPerPx;

  const panels: string[] = [];
  let placed = 0;

  for (const seg of sorted) {
    if (placed >= panelCount) break;
    if (!seg.center) continue;

    const { x: cx, y: cy } = latLngToPixel(
      seg.center.latitude, seg.center.longitude,
      centerLat, centerLng, zoom, imgW, imgH
    );

    const areaM2 = seg.stats?.areaMeters2 || 20;
    const maxInSeg = Math.min(Math.floor(areaM2 / (panelHm * panelWm * 1.2)), panelCount - placed);
    if (maxInSeg <= 0) continue;

    // Rotation angle from azimuth (0 = north, 90 = east, 180 = south)
    const azimuth = seg.azimuthDegrees || 180;
    const rotDeg = azimuth - 180; // panels face azimuth direction

    // Grid layout centred on segment centre
    const cols = Math.max(1, Math.round(Math.sqrt(maxInSeg * (panelWpx / panelHpx))));
    const rows = Math.ceil(maxInSeg / cols);
    const gridW = cols * (panelWpx + gapPx);
    const gridH = rows * (panelHpx + gapPx);

    for (let r = 0; r < rows && placed < panelCount; r++) {
      for (let c = 0; c < cols && placed < panelCount; c++) {
        const px = cx - gridW / 2 + c * (panelWpx + gapPx);
        const py = cy - gridH / 2 + r * (panelHpx + gapPx);
        // Rotate around segment centre
        const rad = (rotDeg * Math.PI) / 180;
        const rx = cx + (px - cx) * Math.cos(rad) - (py - cy) * Math.sin(rad);
        const ry = cy + (px - cx) * Math.sin(rad) + (py - cy) * Math.cos(rad);

        panels.push(`<g transform="translate(${rx.toFixed(1)},${ry.toFixed(1)}) rotate(${rotDeg})">
          <rect width="${panelWpx.toFixed(1)}" height="${panelHpx.toFixed(1)}" fill="#1a237e" stroke="#4fc3f7" stroke-width="0.6" rx="0.5" opacity="0.88"/>
          <line x1="${(panelWpx/3).toFixed(1)}" y1="0" x2="${(panelWpx/3).toFixed(1)}" y2="${panelHpx.toFixed(1)}" stroke="#4fc3f7" stroke-width="0.3" opacity="0.5"/>
          <line x1="${(panelWpx*2/3).toFixed(1)}" y1="0" x2="${(panelWpx*2/3).toFixed(1)}" y2="${panelHpx.toFixed(1)}" stroke="#4fc3f7" stroke-width="0.3" opacity="0.5"/>
          <line x1="0" y1="${(panelHpx/2).toFixed(1)}" x2="${panelWpx.toFixed(1)}" y2="${(panelHpx/2).toFixed(1)}" stroke="#4fc3f7" stroke-width="0.3" opacity="0.5"/>
        </g>`);
        placed++;
      }
    }
  }

  // Fallback: if Solar API had no segments, centre the grid on the building
  if (panels.length === 0) {
    const cols = Math.min(Math.ceil(Math.sqrt(panelCount * 1.6)), 8);
    const rows = Math.ceil(panelCount / cols);
    const startX = imgW / 2 - (cols * (panelWpx + gapPx)) / 2;
    const startY = imgH / 2 - (rows * (panelHpx + gapPx)) / 2 - 20;
    let count = 0;
    for (let r = 0; r < rows && count < panelCount; r++) {
      for (let c = 0; c < cols && count < panelCount; c++) {
        const px = startX + c * (panelWpx + gapPx);
        const py = startY + r * (panelHpx + gapPx);
        panels.push(`<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${panelWpx.toFixed(1)}" height="${panelHpx.toFixed(1)}" fill="#1a237e" stroke="#4fc3f7" stroke-width="0.6" rx="0.5" opacity="0.88"/>`);
        count++;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${imgW} ${imgH}" width="${imgW}" height="${imgH}" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none">
    <defs>
      <filter id="panel-glow">
        <feGaussianBlur stdDeviation="1.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g filter="url(#panel-glow)">${panels.join("")}</g>
  </svg>`;
}

// ─── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get("zip") || "";
  const address = req.nextUrl.searchParams.get("address") || "";
  const latParam = req.nextUrl.searchParams.get("lat");
  const lngParam = req.nextUrl.searchParams.get("lng");
  const requestedPanels = parseInt(req.nextUrl.searchParams.get("panels") || "20");
  const zoom = 20;
  const imgW = 640;
  const imgH = 480;

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  let lat: number | null = null;
  let lng: number | null = null;
  let city: string | null = null;
  let state: string | null = null;

  // Priority 1: explicit lat/lng from Places autocomplete (most accurate)
  const latN = latParam ? parseFloat(latParam) : NaN;
  const lngN = lngParam ? parseFloat(lngParam) : NaN;
  if (!Number.isNaN(latN) && !Number.isNaN(lngN)) {
    lat = latN; lng = lngN;
  }

  // Priority 2: full address geocode
  if (!lat && address && key) {
    const geo = await geocode(address, key);
    if (geo) { lat = geo.lat; lng = geo.lng; }
  }

  // Priority 3: ZIP geocode / cache
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
        try { await qExec("INSERT IGNORE INTO zip_cache (zip_code, lat, lng) VALUES (?,?,?)", [zip, lat, lng]); } catch { /**/ }
      }
    }
  }

  if (!lat || !lng) {
    return NextResponse.json({ error: "Could not resolve location. Provide lat/lng, address, or valid ZIP." }, { status: 400 });
  }

  // Google Solar API — real roof data
  let solarData = null;
  let roofAreaM2 = 120;
  let maxPanels = 40;
  let annualSunshine = 1600;

  if (key) {
    solarData = await getSolarData(lat, lng, key);
    if (solarData?.solarPotential) {
      roofAreaM2 = solarData.solarPotential.wholeRoofStats?.areaMeters2 || 120;
      maxPanels = solarData.solarPotential.maxArrayPanelsCount || 40;
      annualSunshine = solarData.solarPotential.maxSunshineHoursPerYear || 1600;
    }
  }

  // Deterministic fallback when Solar API unavailable
  if (!solarData && zip) {
    const seed = parseInt(zip, 10);
    roofAreaM2 = 85 + (seed % 120);
    annualSunshine = 1250 + (seed % 650);
    maxPanels = Math.max(10, Math.min(70, Math.round(roofAreaM2 / 2.3)));
  }

  const roofCapacity = Math.max(6, Math.round(roofAreaM2 / 2.2));
  const sunshineFactor = Math.max(0.8, Math.min(1.2, annualSunshine / 1600));
  const suggestedPanels = Math.max(6, Math.min(maxPanels, Math.round(roofCapacity * sunshineFactor)));
  const panelCount = Math.max(6, Math.min(maxPanels, Number.isFinite(requestedPanels) ? requestedPanels : suggestedPanels));

  // Satellite image — centred on the actual building coordinates
  const satelliteUrl = key
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${imgW}x${imgH}&maptype=satellite&key=${key}`
    : null;

  // Build accurate SVG overlay
  const overlaySvg = buildSolarOverlaySVG(solarData || {}, lat, lng, panelCount, zoom, imgW, imgH);

  return NextResponse.json({
    success: true,
    zip,
    city,
    state,
    lat,
    lng,
    hasGoogleKey: !!key,
    satellite: { imageUrl: satelliteUrl, zoom },
    roof: {
      areaM2: Math.round(roofAreaM2),
      maxPanels,
      annualSunshineHours: Math.round(annualSunshine),
      panelsSuggested: suggestedPanels,
    },
    overlay: { svg: overlaySvg, panelCount },
    solarApiData: solarData ? {
      buildingName: solarData.name,
      imageryDate: solarData.imageryDate,
      postalCode: solarData.postalCode,
      roofSegments: solarData.solarPotential?.roofSegmentStats?.length || 0,
    } : null,
  });
}
