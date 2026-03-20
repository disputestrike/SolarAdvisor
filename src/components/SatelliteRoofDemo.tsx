"use client";

import { useState } from "react";
import SatelliteRoof from "./SatelliteRoof";

export default function SatelliteRoofDemo() {
  const [zip, setZip] = useState("90210");
  const [activeZip, setActiveZip] = useState("90210");
  const [panels, setPanels] = useState(20);

  return (
    <div>
      {/* Satellite view */}
      <SatelliteRoof zipCode={activeZip} panels={panels} systemKw={panels * 0.4} />

      {/* Interactive controls */}
      <div style={{
        marginTop: 16, background: "var(--surface)",
        border: "1px solid var(--border)", borderRadius: 14, padding: 16,
      }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
              Your ZIP Code
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                onKeyDown={(e) => e.key === "Enter" && zip.length === 5 && setActiveZip(zip)}
                placeholder="Enter ZIP"
                style={{
                  flex: 1, padding: "10px 14px", fontSize: "0.95rem",
                  background: "var(--white)", border: "2px solid var(--border)",
                  borderRadius: 10, outline: "none", fontFamily: "var(--font-body)",
                  color: "var(--earth-dark)",
                }}
                onFocus={(e) => e.target.style.borderColor = "var(--sun-flare)"}
                onBlur={(e) => e.target.style.borderColor = "var(--border)"}
              />
              <button
                onClick={() => zip.length === 5 && setActiveZip(zip)}
                disabled={zip.length !== 5}
                style={{
                  padding: "10px 16px", borderRadius: 10, border: "none",
                  background: zip.length === 5 ? "linear-gradient(135deg, var(--sun-core), var(--sun-glow))" : "var(--border)",
                  color: "white", fontWeight: 700, fontSize: "0.85rem",
                  cursor: zip.length === 5 ? "pointer" : "not-allowed",
                  fontFamily: "var(--font-body)",
                }}
              >
                Analyze
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
              Panels
            </label>
            <select
              value={panels}
              onChange={(e) => setPanels(parseInt(e.target.value))}
              style={{
                padding: "10px 12px", borderRadius: 10,
                border: "2px solid var(--border)", background: "var(--white)",
                fontSize: "0.9rem", outline: "none", cursor: "pointer",
                fontFamily: "var(--font-body)", color: "var(--earth-dark)",
              }}
            >
              {[8, 12, 16, 20, 24, 28, 32].map(n => (
                <option key={n} value={n}>{n} panels</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
          🛰️ Satellite imagery + panel overlay for any US address
        </div>
      </div>
    </div>
  );
}
