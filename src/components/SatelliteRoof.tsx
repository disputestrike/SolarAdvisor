"use client";

import { useState, useEffect, useCallback } from "react";

interface SatelliteRoofProps {
  zipCode: string;
  panels?: number;
  systemKw?: number;
  lat?: number | null;
  lng?: number | null;
  address?: string;
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
    bestFaceScore?: number;
  };
  satellite: { imageUrl: string | null };
  overlay?: { svg?: string; panelCount?: number };
  layout?: {
    systemKw: number;
    annualKwh: number;
    efficiencyScore: number;
  };
}

// Build an SVG panel overlay client-side when the API returns one
function PanelOverlay({ svg }: { svg: string }) {
  return (
    <div
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default function SatelliteRoof({
  zipCode,
  panels = 20,
  systemKw,
  lat,
  lng,
  address,
  onRoofData,
}: SatelliteRoofProps) {
  const [data, setData] = useState<RoofData | null>(null);
  const [loading, setLoading] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [imgError, setImgError] = useState(false);

  const notifyRoof = useCallback(
    (d: RoofData) => { onRoofData?.(d); },
    [onRoofData]
  );

  useEffect(() => {
    if (!zipCode || zipCode.length !== 5) return;
    setLoading(true);
    setImgError(false);

    const q = new URLSearchParams({ zip: zipCode, panels: String(panels) });
    if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      q.set("lat", String(lat));
      q.set("lng", String(lng));
    }
    // Pass full address for more accurate Solar API building lookup
    if (address && address.length > 5) {
      q.set("address", address);
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
  }, [zipCode, panels, lat, lng, address, notifyRoof]);

  const hasSatellite = !imgError && !!data?.satellite?.imageUrl;
  const panelCount = data?.overlay?.panelCount ?? data?.roof?.panelsSuggested ?? panels;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: 16,
        overflow: "hidden",
        background: "#0D1B2A",
        minHeight: 260,
      }}
    >
      {/* Loading */}
      {loading && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#0D1B2A",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10, display: "block" }}>🛰️</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>
              Analyzing your roof…
            </div>
          </div>
        </div>
      )}

      {/* Satellite image with real panel SVG overlay */}
      {hasSatellite ? (
        <div style={{ position: "relative", width: "100%", paddingBottom: "62.5%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data!.satellite.imageUrl!}
            alt={`Satellite view of ZIP ${zipCode}`}
            onError={() => setImgError(true)}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
            }}
          />
          {/* Real SVG panel overlay from API */}
          {overlayVisible && data?.overlay?.svg && (
            <PanelOverlay svg={data.overlay.svg} />
          )}
        </div>
      ) : (
        /* Illustrated fallback — always renders something great */
        !loading && <IllustratedRoof panels={panels} systemKw={systemKw} zipCode={zipCode} />
      )}

      {/* Info bar */}
      {data && !loading && (
        <div
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "linear-gradient(transparent, rgba(0,0,0,0.88))",
            padding: "28px 14px 12px",
            display: "flex", justifyContent: "space-between", alignItems: "flex-end",
          }}
        >
          <div>
            {data.city && (
              <div style={{ color: "white", fontWeight: 700, fontSize: "0.88rem", marginBottom: 2 }}>
                {data.city}, {data.state}
              </div>
            )}
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.72rem" }}>
              {data.roof.areaM2 > 0 ? `~${data.roof.areaM2} m² roof · ` : ""}
              {data.roof.annualSunshineHours} h sunshine/yr
              {data.layout?.annualKwh ? ` · ~${data.layout.annualKwh.toLocaleString()} kWh/yr` : ""}
            </div>
            {data.layout?.efficiencyScore && (
              <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{
                  height: 4, width: 60, background: "rgba(255,255,255,0.15)", borderRadius: 2, overflow: "hidden"
                }}>
                  <div style={{
                    height: "100%", borderRadius: 2,
                    width: `${data.layout.efficiencyScore}%`,
                    background: data.layout.efficiencyScore > 80 ? "#4fc3f7" : data.layout.efficiencyScore > 60 ? "#fbbf24" : "#f87171",
                  }} />
                </div>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem" }}>
                  {data.layout.efficiencyScore}% efficiency
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {hasSatellite && data?.overlay?.svg && (
              <button
                onClick={() => setOverlayVisible((v) => !v)}
                style={{
                  background: overlayVisible ? "rgba(79,195,247,0.18)" : "rgba(255,255,255,0.08)",
                  border: `1px solid ${overlayVisible ? "#4FC3F7" : "rgba(255,255,255,0.2)"}`,
                  borderRadius: 6, padding: "4px 10px",
                  color: overlayVisible ? "#4FC3F7" : "rgba(255,255,255,0.45)",
                  fontSize: "0.7rem", fontWeight: 600, cursor: "pointer",
                }}
              >
                {overlayVisible ? "Hide panels" : "Show panels"}
              </button>
            )}
            <div
              style={{
                background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.35)",
                borderRadius: 6, padding: "4px 10px",
                color: "#4FC3F7", fontSize: "0.7rem", fontWeight: 700,
              }}
            >
              {panelCount} panels
            </div>
          </div>
        </div>
      )}

      {/* Google attribution */}
      {hasSatellite && (
        <div
          style={{
            position: "absolute", top: 8, right: 8,
            background: "rgba(0,0,0,0.55)", borderRadius: 4,
            padding: "2px 7px", fontSize: "0.62rem", color: "rgba(255,255,255,0.75)",
          }}
        >
          🌍 Google Maps
        </div>
      )}
    </div>
  );
}

// ─── Illustrated aerial roof — rendered whenever no Google key / image fails ──
function IllustratedRoof({
  panels,
  systemKw,
  zipCode,
}: {
  panels: number;
  systemKw?: number;
  zipCode: string;
}) {
  const cols = Math.min(Math.ceil(Math.sqrt(panels * 1.6)), 7);
  const rows = Math.ceil(panels / cols);

  return (
    <div style={{ position: "relative", width: "100%", paddingBottom: "62.5%", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(155deg,#1a1a2e 0%,#16213e 40%,#0f3460 70%,#1a3a5c 100%)",
        }}
      >
        {/* Star field */}
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(i * 41 + 7) % 96}%`,
              top: `${(i * 19 + 5) % 42}%`,
              width: i % 4 === 0 ? 3 : 2,
              height: i % 4 === 0 ? 3 : 2,
              borderRadius: "50%",
              background: "white",
              opacity: 0.3 + (i % 4) * 0.15,
            }}
          />
        ))}

        {/* Aerial house */}
        <div
          style={{
            position: "absolute",
            top: "12%", left: "50%",
            transform: "translateX(-50%)",
            width: "72%", maxWidth: 380,
          }}
        >
          {/* Roof surface with panels */}
          <div
            style={{
              background: "linear-gradient(135deg,#4a3728,#5d4037,#4a3728)",
              borderRadius: "10px 10px 0 0",
              padding: "14px 12px 10px",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: 3,
                marginBottom: 8,
              }}
            >
              {Array.from({ length: panels }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: "1.75/1",
                    background: "linear-gradient(135deg,#1a237e,#283593,#1565c0)",
                    border: "0.5px solid rgba(79,195,247,0.5)",
                    borderRadius: 2,
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: "inset 0 0 5px rgba(79,195,247,0.15)",
                  }}
                >
                  <div style={{ position: "absolute", inset: 0, left: "33%", width: "0.5px", background: "rgba(79,195,247,0.3)" }} />
                  <div style={{ position: "absolute", inset: 0, left: "66%", width: "0.5px", background: "rgba(79,195,247,0.3)" }} />
                  <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "0.5px", background: "rgba(79,195,247,0.3)" }} />
                </div>
              ))}
            </div>
            <div
              style={{
                height: 5,
                background: "linear-gradient(90deg,#3e2723,#5d4037,#3e2723)",
                borderRadius: 3,
              }}
            />
          </div>

          {/* House walls */}
          <div style={{ display: "flex", height: 44 }}>
            <div style={{ flex: 1, background: "#3e2723", borderRight: "1px solid rgba(255,255,255,0.08)" }} />
            <div style={{ flex: 1, background: "#4e342e" }} />
          </div>
        </div>

        {/* Lawn */}
        <div
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "24%",
            background: "linear-gradient(180deg,#1b5e20,#2e7d32)",
          }}
        >
          <div
            style={{
              position: "absolute", bottom: 0, left: "50%",
              transform: "translateX(-50%)",
              width: "11%", height: "100%",
              background: "linear-gradient(180deg,#546e7a,#455a64)",
            }}
          />
        </div>

        {/* Info badge */}
        <div
          style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(0,0,0,0.65)", borderRadius: 8, padding: "7px 11px",
            backdropFilter: "blur(6px)",
          }}
        >
          <div style={{ color: "#4FC3F7", fontSize: "0.68rem", fontWeight: 700, marginBottom: 2 }}>
            📍 ZIP {zipCode}
          </div>
          {systemKw && (
            <div style={{ color: "white", fontSize: "0.72rem" }}>
              {systemKw} kW · {rows}×{cols} array
            </div>
          )}
        </div>

        {/* Panel count badge */}
        <div
          style={{
            position: "absolute", bottom: "27%", right: 10,
            background: "rgba(79,195,247,0.15)", border: "1px solid rgba(79,195,247,0.4)",
            borderRadius: 6, padding: "4px 10px",
            color: "#4FC3F7", fontSize: "0.7rem", fontWeight: 700,
          }}
        >
          {panels} panels visualized
        </div>
      </div>
    </div>
  );
}
