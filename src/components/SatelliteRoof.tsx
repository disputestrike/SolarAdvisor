"use client";

import { useState, useEffect, useCallback } from "react";

interface SatelliteRoofProps {
  zipCode: string;
  panels?: number;
  systemKw?: number;
  /** When set with lng, API uses roof-centered coordinates from Places */
  lat?: number | null;
  lng?: number | null;
  onRoofData?: (data: RoofData) => void;
}

interface RoofData {
  lat: number | null;
  lng: number | null;
  city: string | null;
  state: string | null;
  roof: {
    areaM2: number;
    maxPanels: number;
    annualSunshineHours: number;
    panelsSuggested: number;
  };
  satellite: { imageUrl: string | null };
}

export default function SatelliteRoof({ zipCode, panels = 20, systemKw, lat, lng, onRoofData }: SatelliteRoofProps) {
  const [data, setData] = useState<RoofData | null>(null);
  const [loading, setLoading] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);

  const notifyRoof = useCallback(
    (d: RoofData) => {
      onRoofData?.(d);
    },
    [onRoofData]
  );

  useEffect(() => {
    if (!zipCode || zipCode.length !== 5) return;
    setLoading(true);

    const q = new URLSearchParams({ zip: zipCode, panels: String(panels) });
    if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      q.set("lat", String(lat));
      q.set("lng", String(lng));
    }

    fetch(`/api/satellite?${q.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setData(d);
          notifyRoof(d);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [zipCode, panels, lat, lng, notifyRoof]);

  const hasGoogleKey = data?.satellite?.imageUrl;

  return (
    <div style={{ position: "relative", width: "100%", borderRadius: 16, overflow: "hidden", background: "#0D1B2A", minHeight: 260 }}>
      {/* Loading state */}
      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0D1B2A", zIndex: 10 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, animation: "spin 1.2s linear infinite", display: "block", marginBottom: 12 }}>🛰️</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", fontFamily: "var(--font-body)" }}>Analyzing your roof...</div>
          </div>
        </div>
      )}

      {/* Satellite image OR illustrated fallback */}
      {hasGoogleKey ? (
        // Real Google Maps satellite image
        <div style={{ position: "relative", width: "100%", paddingBottom: "62.5%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.satellite.imageUrl!}
            alt={`Satellite view of ${zipCode}`}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Panel SVG overlay */}
          {overlayVisible && data && (
            <div
              style={{ position: "absolute", inset: 0 }}
              dangerouslySetInnerHTML={{ __html: data ? "" : "" }}
            />
          )}
        </div>
      ) : (
        // Illustrated roof when no Google key
        <IllustratedRoof panels={panels} systemKw={systemKw} zipCode={zipCode} />
      )}

      {/* Controls bar */}
      {data && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
          padding: "20px 16px 12px",
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        }}>
          <div>
            {data.city && (
              <div style={{ color: "white", fontWeight: 700, fontSize: "0.9rem", marginBottom: 2, fontFamily: "var(--font-body)" }}>
                {data.city}, {data.state}
              </div>
            )}
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem", fontFamily: "var(--font-body)" }}>
              {data.roof.areaM2 > 0 ? `~${data.roof.areaM2}m² roof · ` : ""}
              {data.roof.annualSunshineHours}h sunshine/yr
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {hasGoogleKey && (
              <button
                onClick={() => setOverlayVisible(!overlayVisible)}
                style={{
                  background: overlayVisible ? "rgba(79,195,247,0.2)" : "rgba(255,255,255,0.1)",
                  border: `1px solid ${overlayVisible ? "#4FC3F7" : "rgba(255,255,255,0.2)"}`,
                  borderRadius: 6, padding: "4px 10px",
                  color: overlayVisible ? "#4FC3F7" : "rgba(255,255,255,0.5)",
                  fontSize: "0.72rem", fontWeight: 600, cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                {overlayVisible ? "Hide Panels" : "Show Panels"}
              </button>
            )}
            <div style={{
              background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)",
              borderRadius: 6, padding: "4px 10px",
              color: "#4FC3F7", fontSize: "0.72rem", fontWeight: 700,
              fontFamily: "var(--font-body)",
            }}>
              {panels} panels visualized
            </div>
          </div>
        </div>
      )}

      {/* "Powered by Google" badge when using real imagery */}
      {hasGoogleKey && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          background: "rgba(0,0,0,0.6)", borderRadius: 4,
          padding: "3px 8px", fontSize: "0.65rem", color: "rgba(255,255,255,0.8)",
          fontFamily: "var(--font-body)",
        }}>
          🌍 Google Maps
        </div>
      )}
    </div>
  );
}

// ─── Illustrated Roof (when no Google Maps API key) ───────────────────────────
function IllustratedRoof({ panels, systemKw, zipCode }: { panels: number; systemKw?: number; zipCode: string }) {
  const cols = Math.min(Math.ceil(Math.sqrt(panels * 1.5)), 7);

  return (
    <div style={{ position: "relative", width: "100%", paddingBottom: "62.5%", overflow: "hidden" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #533483 100%)",
      }}>
        {/* Stars */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${(i * 37 + 11) % 95}%`,
            top: `${(i * 23 + 7) % 45}%`,
            width: 2, height: 2, borderRadius: "50%",
            background: "white", opacity: 0.4 + (i % 3) * 0.2,
          }} />
        ))}

        {/* Aerial house outline */}
        <div style={{
          position: "absolute", top: "15%", left: "50%",
          transform: "translateX(-50%)",
          width: "70%", maxWidth: 360,
        }}>
          {/* Roof surface */}
          <div style={{
            background: "linear-gradient(135deg, #4a3728 0%, #5d4037 50%, #4a3728 100%)",
            borderRadius: "8px 8px 0 0", padding: "16px 12px 12px",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}>
            {/* Panel grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 3,
              marginBottom: 8,
            }}>
              {Array.from({ length: panels }).map((_, i) => (
                <div key={i} style={{
                  aspectRatio: "1.7/1",
                  background: "linear-gradient(135deg, #1a237e 0%, #283593 50%, #1565c0 100%)",
                  border: "0.5px solid rgba(79,195,247,0.5)",
                  borderRadius: 2,
                  position: "relative",
                  boxShadow: "inset 0 0 4px rgba(79,195,247,0.2)",
                }}>
                  {/* Panel cell lines */}
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: "33%", width: "0.5px", background: "rgba(79,195,247,0.3)" }} />
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: "66%", width: "0.5px", background: "rgba(79,195,247,0.3)" }} />
                  <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: "0.5px", background: "rgba(79,195,247,0.3)" }} />
                  {/* Shine effect */}
                  <div style={{
                    position: "absolute", top: 0, left: "-100%", width: "60%", height: "100%",
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
                    animation: `shine ${2 + (i % 3)}s ease-in-out infinite`,
                    animationDelay: `${(i * 0.1) % 2}s`,
                  }} />
                </div>
              ))}
            </div>
            {/* Roof ridge cap */}
            <div style={{
              height: 6, background: "linear-gradient(90deg, #3e2723, #5d4037, #3e2723)",
              borderRadius: 3, marginTop: 4,
            }} />
          </div>

          {/* House sides */}
          <div style={{ display: "flex", height: 40 }}>
            <div style={{ flex: 1, background: "#3e2723", borderRight: "1px solid rgba(255,255,255,0.1)" }} />
            <div style={{ flex: 1, background: "#4e342e" }} />
          </div>
        </div>

        {/* Ground/yard */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "25%",
          background: "linear-gradient(180deg, #1b5e20, #2e7d32)",
        }}>
          {/* Driveway */}
          <div style={{
            position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
            width: "12%", height: "100%",
            background: "linear-gradient(180deg, #546e7a, #455a64)",
          }} />
        </div>

        {/* Info overlay */}
        <div style={{
          position: "absolute", top: 12, left: 12,
          background: "rgba(0,0,0,0.7)", borderRadius: 8, padding: "8px 12px",
          backdropFilter: "blur(4px)",
        }}>
          <div style={{ color: "#4FC3F7", fontSize: "0.7rem", fontWeight: 700, fontFamily: "var(--font-body)", marginBottom: 2 }}>
            📍 ZIP {zipCode}
          </div>
          {systemKw && (
            <div style={{ color: "white", fontSize: "0.75rem", fontFamily: "var(--font-body)" }}>
              {systemKw} kW · {panels} panels
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shine {
          0%, 100% { left: -100%; }
          50% { left: 200%; }
        }
      `}</style>
    </div>
  );
}
