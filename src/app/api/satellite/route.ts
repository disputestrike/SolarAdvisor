import { NextRequest, NextResponse } from "next/server";
import { q1 } from "@/db";

interface GeocodedAddress {
  lat: number;
  lng: number;
  formattedAddress: string;
}

// ─── Geocode ZIP → lat/lng via Google Geocoding API ──────────────────────────
async function geocodeZip(zip: string): Promise<GeocodedAddress | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${zip}&key=${key}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.[0]) return null;

    const loc = data.results[0].geometry.location;
    return {
      lat: loc.lat,
      lng: loc.lng,
      formattedAddress: data.results[0].formatted_address,
    };
  } catch {
    return null;
  }
}

// ─── Google Solar API — rooftop analysis ─────────────────────────────────────
async function getSolarData(lat: number, lng: number) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${key}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

// ─── Google Maps Static API — satellite imagery ───────────────────────────────
function getSatelliteImageUrl(lat: number, lng: number, zoom = 20): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) return "";
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=640x480&maptype=satellite&key=${key}`;
}

// ─── SVG solar panel overlay generator ───────────────────────────────────────
function generatePanelOverlaySVG(
  panelCount: number,
  _roofAreaM2: number
): string {
  // Estimate roof footprint in SVG coordinates (640x480 image, ~20m wide at zoom=20)
  const cols = Math.min(Math.ceil(Math.sqrt(panelCount * 1.6)), 8);
  const rows = Math.ceil(panelCount / cols);
  const panelW = 48;
  const panelH = 28;
  const gap = 3;
  const startX = (640 - cols * (panelW + gap)) / 2;
  const startY = (480 - rows * (panelH + gap)) / 2 - 40;

  let panels = "";
  let count = 0;
  for (let r = 0; r < rows && count < panelCount; r++) {
    for (let c = 0; c < cols && count < panelCount; c++) {
      const x = startX + c * (panelW + gap);
      const y = startY + r * (panelH + gap);
      panels += `
        <g>
          <rect x="${x}" y="${y}" width="${panelW}" height="${panelH}"
            fill="#1a237e" stroke="#4fc3f7" stroke-width="0.8" rx="1" opacity="0.85"/>
          <line x1="${x + panelW / 3}" y1="${y}" x2="${x + panelW / 3}" y2="${y + panelH}"
            stroke="#4fc3f7" stroke-width="0.4" opacity="0.6"/>
          <line x1="${x + (panelW * 2) / 3}" y1="${y}" x2="${x + (panelW * 2) / 3}" y2="${y + panelH}"
            stroke="#4fc3f7" stroke-width="0.4" opacity="0.6"/>
          <line x1="${x}" y1="${y + panelH / 2}" x2="${x + panelW}" y2="${y + panelH / 2}"
            stroke="#4fc3f7" stroke-width="0.4" opacity="0.6"/>
        </g>`;
      count++;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480">
    ${panels}
    <!-- Glow effect on panels -->
    <rect x="${startX - 4}" y="${startY - 4}"
      width="${cols * (panelW + gap) + 4}" height="${rows * (panelH + gap) + 4}"
      fill="none" stroke="rgba(79,195,247,0.4)" stroke-width="2" rx="3"
      filter="url(#glow)"/>
    <defs>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  </svg>`;
}

// ─── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get("zip");
  const latParam = req.nextUrl.searchParams.get("lat");
  const lngParam = req.nextUrl.searchParams.get("lng");
  const requestedPanels = parseInt(req.nextUrl.searchParams.get("panels") || "20");

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  let lat: number | null = null;
  let lng: number | null = null;
  let city: string | null = null;
  let state: string | null = null;

  const latN = latParam != null ? parseFloat(latParam) : NaN;
  const lngN = lngParam != null ? parseFloat(lngParam) : NaN;
  if (!Number.isNaN(latN) && !Number.isNaN(lngN)) {
    lat = latN;
    lng = lngN;
  } else if (zip && /^\d{5}$/.test(zip)) {
    try {
      const cached = await q1<{ lat: string; lng: string; city: string; state: string }>(
        "SELECT lat, lng, city, state FROM zip_cache WHERE zip_code = ? LIMIT 1",
        [zip]
      );
      if (cached?.lat) {
        lat = parseFloat(cached.lat);
        lng = parseFloat(cached.lng);
        city = cached.city;
        state = cached.state;
      }
    } catch { /* non-blocking */ }

    if (!lat && key) {
      const geo = await geocodeZip(zip);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;

        try {
          await import("@/db").then(({ qExec }) =>
            qExec(
              "INSERT IGNORE INTO zip_cache (zip_code, lat, lng) VALUES (?, ?, ?)",
              [zip, lat!, lng!]
            )
          );
        } catch { /* best effort */ }
      }
    }
  } else {
    return NextResponse.json({ error: "Provide a valid 5-digit ZIP or lat & lng" }, { status: 400 });
  }

  // Get Solar API data if we have coords + key
  let solarData = null;
  let roofAreaM2 = 120; // default assumption
  let maxPanels = 40;
  let annualSunshine = 1600;

  if (lat && lng && key) {
    solarData = await getSolarData(lat, lng);
    if (solarData?.solarPotential) {
      roofAreaM2 = solarData.solarPotential.wholeRoofStats?.areaMeters2 || 120;
      maxPanels = solarData.solarPotential.maxArrayPanelsCount || 40;
      annualSunshine =
        solarData.solarPotential.maxSunshineHoursPerYear || 1600;
    }
  }

  // Satellite image URL (served directly to client)
  const satelliteUrl = lat && lng && key ? getSatelliteImageUrl(lat, lng) : null;

  // Build a location-based suggestion so ZIP/address changes produce distinct panel counts.
  const roofCapacityPanels = Math.max(6, Math.round(roofAreaM2 / 2.2));
  const sunshineFactor = Math.max(0.8, Math.min(1.2, annualSunshine / 1600));
  const suggestedPanels = Math.max(
    6,
    Math.min(maxPanels, Math.round(roofCapacityPanels * sunshineFactor))
  );
  const panelCount = Math.max(
    6,
    Math.min(maxPanels, Number.isFinite(requestedPanels) ? requestedPanels : suggestedPanels, suggestedPanels)
  );
  const overlaySvg = generatePanelOverlaySVG(panelCount, roofAreaM2);

  return NextResponse.json({
    success: true,
    zip: zip || "",
    city,
    state,
    lat,
    lng,
    hasGoogleKey: !!key,
    satellite: {
      imageUrl: satelliteUrl,
      zoom: 20,
    },
    roof: {
      areaM2: Math.round(roofAreaM2),
      maxPanels,
      annualSunshineHours: Math.round(annualSunshine),
      panelsSuggested: suggestedPanels,
    },
    overlay: {
      svg: overlaySvg,
      panelCount,
    },
    solarApiData: solarData
      ? {
          buildingName: solarData.name,
          imageryDate: solarData.imageryDate,
          postalCode: solarData.postalCode,
        }
      : null,
  });
}
