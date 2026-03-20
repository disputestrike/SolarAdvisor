import { NextRequest, NextResponse } from "next/server";
import { q1 } from "@/db";

function getStateFromZip(zip: string): string | null {
  const p = parseInt(zip.substring(0, 3));
  if (p >= 100 && p <= 149) return "NY";
  if (p >= 150 && p <= 196) return "PA";
  if (p >= 197 && p <= 199) return "DE";
  if (p >= 200 && p <= 205) return "DC";
  if (p >= 206 && p <= 219) return "MD";
  if (p >= 220 && p <= 246) return "VA";
  if (p >= 247 && p <= 268) return "WV";
  if (p >= 270 && p <= 289) return "NC";
  if (p >= 290 && p <= 299) return "SC";
  if (p >= 300 && p <= 319) return "GA";
  if (p >= 320 && p <= 349) return "FL";
  if (p >= 350 && p <= 369) return "AL";
  if (p >= 370 && p <= 385) return "TN";
  if (p >= 386 && p <= 397) return "MS";
  if (p >= 400 && p <= 427) return "KY";
  if (p >= 430 && p <= 458) return "OH";
  if (p >= 460 && p <= 479) return "IN";
  if (p >= 480 && p <= 499) return "MI";
  if (p >= 500 && p <= 528) return "IA";
  if (p >= 530 && p <= 549) return "WI";
  if (p >= 550 && p <= 567) return "MN";
  if (p >= 570 && p <= 577) return "SD";
  if (p >= 580 && p <= 588) return "ND";
  if (p >= 590 && p <= 599) return "MT";
  if (p >= 600 && p <= 629) return "IL";
  if (p >= 630 && p <= 658) return "MO";
  if (p >= 660 && p <= 679) return "KS";
  if (p >= 680 && p <= 693) return "NE";
  if (p >= 700 && p <= 714) return "LA";
  if (p >= 716 && p <= 729) return "AR";
  if (p >= 730 && p <= 749) return "OK";
  if (p >= 750 && p <= 799) return "TX";
  if (p >= 800 && p <= 816) return "CO";
  if (p >= 820 && p <= 831) return "WY";
  if (p >= 832 && p <= 838) return "ID";
  if (p >= 840 && p <= 847) return "UT";
  if (p >= 850 && p <= 865) return "AZ";
  if (p >= 870 && p <= 884) return "NM";
  if (p >= 889 && p <= 898) return "NV";
  if (p >= 900 && p <= 961) return "CA";
  if (p >= 970 && p <= 979) return "OR";
  if (p >= 980 && p <= 994) return "WA";
  if (p >= 995 && p <= 999) return "AK";
  return null;
}

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get("zip");
  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: "Invalid ZIP" }, { status: 400 });
  }

  try {
    const cached = await q1<{ city: string; state: string; lat: string; lng: string }>(
      "SELECT city, state, lat, lng FROM zip_cache WHERE zip_code = ? LIMIT 1",
      [zip]
    );

    if (cached?.state) {
      const incentives = await q1<{
        net_metering_available: number;
        state_rebate: number;
        srec_available: number;
        avg_sun_hours: string;
        avg_electricity_cost: string;
      }>(
        "SELECT net_metering_available, state_rebate, srec_available, avg_sun_hours, avg_electricity_cost FROM state_incentives WHERE state = ? LIMIT 1",
        [cached.state]
      );

      return NextResponse.json({
        zip,
        city: cached.city,
        state: cached.state,
        lat: cached.lat ? parseFloat(cached.lat) : null,
        lng: cached.lng ? parseFloat(cached.lng) : null,
        incentives: incentives ? {
          netMetering: Boolean(incentives.net_metering_available),
          stateRebate: incentives.state_rebate,
          srec: Boolean(incentives.srec_available),
          avgSunHours: parseFloat(incentives.avg_sun_hours),
          avgKwhCost: parseFloat(incentives.avg_electricity_cost),
        } : null,
      });
    }
  } catch { /* fallback below */ }

  const state = getStateFromZip(zip);
  let incentives = null;

  if (state) {
    try {
      const inc = await q1<{
        net_metering_available: number;
        state_rebate: number;
        srec_available: number;
        avg_sun_hours: string;
        avg_electricity_cost: string;
      }>(
        "SELECT net_metering_available, state_rebate, srec_available, avg_sun_hours, avg_electricity_cost FROM state_incentives WHERE state = ? LIMIT 1",
        [state]
      );
      if (inc) {
        incentives = {
          netMetering: Boolean(inc.net_metering_available),
          stateRebate: inc.state_rebate,
          srec: Boolean(inc.srec_available),
          avgSunHours: parseFloat(inc.avg_sun_hours),
          avgKwhCost: parseFloat(inc.avg_electricity_cost),
        };
      }
    } catch { /* best effort */ }
  }

  return NextResponse.json({ zip, city: null, state, lat: null, lng: null, incentives });
}
