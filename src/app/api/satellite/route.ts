import { NextRequest, NextResponse } from "next/server";
import { q1, qExec } from "@/db";
import { computeLayout, layoutToSVG, scoreFace, type RoofSegment } from "@/lib/solar-layout";

// ─── Geocode ──────────────────────────────────────────────────────────────────
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

// ─── Distance in metres between two lat/lng ───────────────────────────────────
function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dx = (lng2 - lng1) * 111320 * Math.cos(lat1 * Math.PI / 180);
  const dy = (lat2 - lat1) * 111320;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Parse Solar API → RoofSegment[] ─────────────────────────────────────────
interface RawSeg {
  pitchDegrees?: number;
  azimuthDegrees?: number;
  stats?: { areaMeters2?: number; sunshineQuantiles?: number[] };
  center?: { latitude?: number; longitude?: number };
}

function parseSolarSegments(
  solarData: Record<string, unknown>,
  buildingLat: number,
  buildingLng: number,
  radiusM = 30
): RoofSegment[] {
  const potential = solarData?.solarPotential as Record<string, unknown> | undefined;
  const raw: RawSeg[] = (potential?.roofSegmentStats as RawSeg[] | undefined) || [];

  return raw
    .filter(s => {
      if (!s.center?.latitude || !s.center?.longitude) return false;
      // Only include segments belonging to THIS building (within radius)
      return distM(buildingLat, buildingLng, s.center.latitude, s.center.longitude) <= radiusM;
    })
    .map((s, i) => ({
      id: i,
      centerLat: s.center!.latitude!,
      centerLng: s.center!.longitude!,
      areaM2: s.stats?.areaMeters2 || 15,
      pitchDegrees: s.pitchDegrees || 20,
      azimuthDegrees: s.azimuthDegrees || 180,
      // Use bottom sunshine quantile as shading proxy (lower = more shading)
      shadingFactor: s.stats?.sunshineQuantiles
        ? Math.min(1.0, (s.stats.sunshineQuantiles[4] || 1600) / 1800)
        : 1.0,
    }));
}

// ─── Synthetic segments when Solar API unavailable ────────────────────────────
function syntheticSegments(lat: number, lng: number, roofAreaM2: number, zip: string): RoofSegment[] {
  const seed = parseInt(zip || "33101", 10);
  // Create 2 synthetic faces: main south-facing + secondary west-facing
  const azimuth1 = 160 + (seed % 40); // south-ish
  const azimuth2 = azimuth1 + 90;
  return [
    { id: 0, centerLat: lat, centerLng: lng, areaM2: roofAreaM2 * 0.65, pitchDegrees: 20 + (seed % 15), azimuthDegrees: azimuth1, shadingFactor: 0.9 },
    { id: 1, centerLat: lat + 0.00005, centerLng: lng + 0.00005, areaM2: roofAreaM2 * 0.35, pitchDegrees: 20 + (seed % 15), azimuthDegrees: azimuth2, shadingFactor: 0.85 },
  ];
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const zip      = req.nextUrl.searchParams.get("zip") || "";
  const address  = req.nextUrl.searchParams.get("address") || "";
  const latParam = req.nextUrl.searchParams.get("lat");
  const lngParam = req.nextUrl.searchParams.get("lng");
  const reqPanels = parseInt(req.nextUrl.searchParams.get("panels") || "0");
  const zoom = 20, imgW = 640, imgH = 480;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  let lat: number | null = null;
  let lng: number | null = null;
  let city: string | null = null;
  let state: string | null = null;

  // Priority 1: exact coords from Google Places
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
        try { await qExec("INSERT IGNORE INTO zip_cache (zip_code, lat, lng) VALUES (?,?,?)", [zip, lat, lng]); } catch { /**/ }
      }
    }
  }

  if (!lat || !lng) {
    return NextResponse.json({ error: "Could not resolve location." }, { status: 400 });
  }

  // ── Solar API ──────────────────────────────────────────────────────────────
  let solarData: Record<string, unknown> | null = null;
  let roofAreaM2 = 120;
  let maxPanels = 30;
  let annualSunHours = 1600;

  if (key) {
    solarData = await getSolarData(lat, lng, key);
    if (solarData?.solarPotential) {
      const sp = solarData.solarPotential as Record<string, unknown>;
      roofAreaM2    = (sp.wholeRoofStats as Record<string, number> | undefined)?.areaMeters2 || 120;
      maxPanels     = Math.min(32, (sp.maxArrayPanelsCount as number | undefined) || 30);
      annualSunHours = (sp.maxSunshineHoursPerYear as number | undefined) || 1600;
    }
  }

  // Fallback per ZIP
  if (!solarData && zip) {
    const seed = parseInt(zip, 10);
    roofAreaM2     = 80 + (seed % 90);
    annualSunHours = 1300 + (seed % 600);
    maxPanels      = Math.min(30, Math.round(roofAreaM2 / 4));
  }

  // ── Parse segments ─────────────────────────────────────────────────────────
  const segments: RoofSegment[] = solarData
    ? parseSolarSegments(solarData, lat, lng, 30)
    : syntheticSegments(lat, lng, roofAreaM2, zip);

  // ── Determine target panel count ───────────────────────────────────────────
  // If caller passed panels (from scoring estimate), use that capped to max
  // Otherwise derive from roof capacity
  const roofCapacity = Math.max(4, Math.min(maxPanels, Math.round(roofAreaM2 / 7)));
  const sunFactor    = Math.min(1.15, annualSunHours / 1600);
  const suggested    = Math.max(4, Math.min(maxPanels, Math.round(roofCapacity * sunFactor)));
  const targetPanels = reqPanels > 0 ? Math.min(maxPanels, reqPanels) : suggested;

  // ── Run layout engine ──────────────────────────────────────────────────────
  const layout = computeLayout(segments, targetPanels, annualSunHours);

  // ── Build SVG overlay ──────────────────────────────────────────────────────
  const overlaySvg = layoutToSVG(layout, segments, lat, lng, zoom, imgW, imgH);

  // ── Satellite image URL ────────────────────────────────────────────────────
  const satelliteUrl = key
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${imgW}x${imgH}&maptype=satellite&key=${key}`
    : null;

  // ── Best face score for display ────────────────────────────────────────────
  const bestScore = segments.length > 0
    ? Math.max(...segments.map(s => scoreFace(s.azimuthDegrees, s.pitchDegrees, s.shadingFactor ?? 1.0, annualSunHours)))
    : 0.75;

  return NextResponse.json({
    success: true, zip, city, state, lat, lng, hasGoogleKey: !!key,
    satellite: { imageUrl: satelliteUrl, zoom },
    roof: {
      areaM2: Math.round(roofAreaM2),
      maxPanels,
      annualSunshineHours: Math.round(annualSunHours),
      panelsSuggested: suggested,
      segments: segments.length,
      bestFaceScore: Math.round(bestScore * 100),
    },
    overlay: {
      svg: overlaySvg,
      panelCount: layout.panelCount,
    },
    layout: {
      systemKw: layout.systemKw,
      annualKwh: layout.annualKwh,
      efficiencyScore: layout.efficiencyScore,
      breakdown: layout.breakdown,
    },
    solarApiData: solarData ? {
      imageryDate: (solarData as Record<string, unknown>).imageryDate,
      roofSegments: segments.length,
    } : null,
  });
}
