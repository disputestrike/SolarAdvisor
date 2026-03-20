"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const SatelliteRoof = dynamic(() => import("@/components/SatelliteRoof"), { ssr: false });
const LiveChat = dynamic(() => import("@/components/LiveChat"), { ssr: false });

/* ─── Types ─────────────────────────────────────────────────────────── */
interface FormData {
  zipCode: string;
  isHomeowner: boolean | null;
  monthlyBill: number | null;
  roofSlope: string;
  shadingLevel: string;
  isDecisionMaker: boolean;
  preferredFinancing: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  contactPreference: string;
  consentGiven: boolean;
}

interface Estimate {
  systemKw: number;
  panels: number;
  monthlySavings: number;
  annualSavings: number;
  roiYears: number;
  installCost: number;
  netCost: number;
  monthlyLoanPayment: number;
  monthlyLeasePayment: number;
}

interface ZipInfo {
  city: string | null;
  state: string | null;
  incentives: { netMetering: boolean; stateRebate: number; srec: boolean; avgSunHours: number } | null;
}

const TOTAL_STEPS = 5;

const BILL_OPTIONS = [
  { label: "Under $75", value: 60 },
  { label: "$75 – $125", value: 100 },
  { label: "$125 – $200", value: 162 },
  { label: "$200 – $300", value: 250 },
  { label: "$300 – $450", value: 375 },
  { label: "Over $450", value: 500 },
];

const ROOF_OPTIONS = [
  { value: "low", label: "Low / Gentle", icon: "🏠", desc: "Best for solar" },
  { value: "medium", label: "Medium Pitch", icon: "⛺", desc: "Great for solar" },
  { value: "steep", label: "Steep Pitch", icon: "🗻", desc: "Good for solar" },
  { value: "flat", label: "Flat Roof", icon: "🏢", desc: "Works with racking" },
];

const SHADE_OPTIONS = [
  { value: "none", label: "No Shading", icon: "☀️" },
  { value: "light", label: "Light Shading", icon: "⛅" },
  { value: "moderate", label: "Some Trees", icon: "🌤️" },
  { value: "heavy", label: "Heavy Shade", icon: "☁️" },
];

const FINANCING_OPTIONS = [
  {
    value: "lease",
    label: "$0-Down Lease",
    icon: "🚀",
    tagline: "Start saving immediately",
    desc: "No upfront cost. Monthly payment less than your current bill. Maintenance included.",
  },
  {
    value: "loan",
    label: "Solar Loan",
    icon: "💳",
    tagline: "Own it, keep the tax credit",
    desc: "Low-interest financing. Keep the 30% federal tax credit. Build equity.",
  },
  {
    value: "cash",
    label: "Cash Purchase",
    icon: "💰",
    tagline: "Maximum savings & ROI",
    desc: "Best long-term value. Claim full 30% ITC. Maximize home value increase.",
  },
  {
    value: "undecided",
    label: "Not Sure Yet",
    icon: "🤔",
    tagline: "We'll help you decide",
    desc: "Our expert will walk you through every option and help you choose.",
  },
];

/* ─── Utility ───────────────────────────────────────────────────────── */
function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function quickEstimate(bill: number): Estimate {
  const avgKwhCost = 0.13;
  const avgSunHours = 5.0;
  const monthlyKwh = bill / avgKwhCost;
  const systemKw = Math.ceil((monthlyKwh / (avgSunHours * 30) / 0.8) * 10) / 10;
  const panels = Math.ceil((systemKw * 1000) / 400);
  const monthlySavings = Math.round(bill * 0.9);
  const annualSavings = monthlySavings * 12;
  const installCost = Math.round(systemKw * 1000 * 2.8);
  const netCost = Math.round(installCost * 0.7);
  const roiYears = Math.round((netCost / annualSavings) * 10) / 10;
  const r = 0.07 / 12;
  const n = 300;
  const monthlyLoanPayment = Math.round((netCost * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
  const monthlyLeasePayment = Math.round(monthlySavings * 0.85);
  return { systemKw, panels, monthlySavings, annualSavings, roiYears, installCost, netCost, monthlyLoanPayment, monthlyLeasePayment };
}

/* ─── Step Components ───────────────────────────────────────────────── */
function StepZip({ data, update, onNext }: { data: FormData; update: (k: keyof FormData, v: string | boolean | number | null) => void; onNext: () => void }) {
  const [zipInfo, setZipInfo] = useState<ZipInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lookupZip = useCallback(async (zip: string) => {
    if (zip.length !== 5) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/leads/zip?zip=${zip}`);
      const d = await res.json();
      if (d.state) setZipInfo(d);
    } catch { /* non-blocking */ }
    setLoading(false);
  }, []);

  const handleSubmit = () => {
    if (!/^\d{5}$/.test(data.zipCode)) {
      setError("Please enter a valid 5-digit ZIP code");
      return;
    }
    onNext();
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>📍</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.6rem,4vw,2.4rem)", fontWeight: 900, color: "var(--earth-dark)", marginBottom: 10, letterSpacing: "-0.02em" }}>
        Where Is Your Home?
      </h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 32, fontSize: "1rem" }}>
        We&apos;ll find local incentives, rebates, and installer availability in your area.
      </p>

      <div style={{ maxWidth: 340, margin: "0 auto" }}>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            value={data.zipCode}
            placeholder="Enter ZIP Code"
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 5);
              update("zipCode", v);
              setError("");
              if (v.length === 5) lookupZip(v);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={{
              width: "100%", padding: "18px 20px", fontSize: "1.4rem",
              textAlign: "center", letterSpacing: "0.15em", fontWeight: 700,
              background: "var(--white)", border: error ? "2px solid #ef4444" : "2px solid var(--border)",
              borderRadius: 16, outline: "none", fontFamily: "var(--font-body)",
              color: "var(--earth-dark)", transition: "border-color 0.2s",
            }}
            onFocus={(e) => { if (!error) e.target.style.borderColor = "var(--sun-flare)"; }}
            onBlur={(e) => { if (!error) e.target.style.borderColor = "var(--border)"; }}
          />
        </div>

        {loading && (
          <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 8 }}>
            🔍 Looking up your area...
          </div>
        )}

        {zipInfo?.city && (
          <div style={{
            background: "var(--leaf-light)", color: "var(--leaf-green)",
            borderRadius: 10, padding: "8px 16px", fontSize: "0.9rem",
            fontWeight: 600, marginBottom: 12,
          }}>
            ✓ {zipInfo.city}, {zipInfo.state}
            {zipInfo.incentives?.stateRebate ? ` · $${zipInfo.incentives.stateRebate.toLocaleString()} state rebate available` : ""}
          </div>
        )}

        {error && <p style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: 8 }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={data.zipCode.length !== 5}
          style={{
            width: "100%", padding: "16px",
            background: data.zipCode.length === 5 ? "linear-gradient(135deg, var(--sun-core), var(--sun-glow))" : "var(--border)",
            color: data.zipCode.length === 5 ? "white" : "var(--text-muted)",
            fontWeight: 700, fontSize: "1rem", borderRadius: "999px",
            border: "none", cursor: data.zipCode.length === 5 ? "pointer" : "not-allowed",
            transition: "all 0.2s ease",
            boxShadow: data.zipCode.length === 5 ? "0 4px 20px rgba(255,140,0,0.35)" : "none",
          }}
        >
          Check Availability →
        </button>
      </div>

      <p style={{ marginTop: 20, fontSize: "0.78rem", color: "var(--text-muted)" }}>
        🔒 Your info is never shared without permission
      </p>
    </div>
  );
}

function StepQualify({ data, update, onNext, onBack }: { data: FormData; update: (k: keyof FormData, v: string | boolean | number | null) => void; onNext: () => void; onBack: () => void }) {
  const [error, setError] = useState("");

  const handleNext = () => {
    if (data.isHomeowner === null) { setError("Please tell us if you own your home"); return; }
    if (data.monthlyBill === null) { setError("Please select your monthly electric bill"); return; }
    setError("");
    onNext();
  };

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem,4vw,2.2rem)", fontWeight: 900, color: "var(--earth-dark)", letterSpacing: "-0.02em", marginBottom: 8 }}>
          Tell Us About Your Home
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          2 quick questions to personalize your estimate
        </p>
      </div>

      {/* Homeowner */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
          Do you own your home?
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[{ label: "Yes, I own it 🏠", value: true }, { label: "No, I rent 🏘️", value: false }].map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => { update("isHomeowner", opt.value); setError(""); }}
              style={{
                padding: "18px 16px", borderRadius: 14, fontWeight: 600, fontSize: "0.95rem",
                border: data.isHomeowner === opt.value ? "2px solid var(--sun-core)" : "2px solid var(--border)",
                background: data.isHomeowner === opt.value ? "linear-gradient(135deg, #FFF3D0, #FFFBF2)" : "var(--white)",
                color: data.isHomeowner === opt.value ? "var(--sun-core)" : "var(--text-secondary)",
                cursor: "pointer", transition: "all 0.2s ease",
                boxShadow: data.isHomeowner === opt.value ? "0 0 0 4px rgba(255,140,0,0.1)" : "none",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {data.isHomeowner === false && (
          <div style={{ background: "#FFF3CD", border: "1px solid #FFD700", borderRadius: 10, padding: "12px 16px", marginTop: 12, fontSize: "0.875rem", color: "#856404" }}>
            💡 Some landlords split the savings with tenants. We can still show you options!
          </div>
        )}
      </div>

      {/* Monthly bill */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
          Monthly Electric Bill
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {BILL_OPTIONS.map(opt => (
            <button
              key={opt.label}
              onClick={() => { update("monthlyBill", opt.value); setError(""); }}
              style={{
                padding: "14px 8px", borderRadius: 12, fontWeight: 600, fontSize: "0.875rem",
                border: data.monthlyBill === opt.value ? "2px solid var(--sun-core)" : "2px solid var(--border)",
                background: data.monthlyBill === opt.value ? "linear-gradient(135deg, #FFF3D0, #FFFBF2)" : "var(--white)",
                color: data.monthlyBill === opt.value ? "var(--sun-core)" : "var(--text-secondary)",
                cursor: "pointer", transition: "all 0.2s ease",
                boxShadow: data.monthlyBill === opt.value ? "0 0 0 3px rgba(255,140,0,0.1)" : "none",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Roof */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
          Roof Pitch (optional but helps accuracy)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {ROOF_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => update("roofSlope", opt.value)}
              style={{
                padding: "14px 8px", borderRadius: 12, fontWeight: 600, fontSize: "0.8rem",
                border: data.roofSlope === opt.value ? "2px solid var(--sun-core)" : "2px solid var(--border)",
                background: data.roofSlope === opt.value ? "linear-gradient(135deg, #FFF3D0, #FFFBF2)" : "var(--white)",
                color: data.roofSlope === opt.value ? "var(--sun-core)" : "var(--text-secondary)",
                cursor: "pointer", transition: "all 0.2s ease", textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{opt.icon}</div>
              <div>{opt.label}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 400 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Shading */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
          Shading on Roof (optional)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {SHADE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => update("shadingLevel", opt.value)}
              style={{
                padding: "14px 8px", borderRadius: 12, fontWeight: 600, fontSize: "0.8rem",
                border: data.shadingLevel === opt.value ? "2px solid var(--sun-core)" : "2px solid var(--border)",
                background: data.shadingLevel === opt.value ? "linear-gradient(135deg, #FFF3D0, #FFFBF2)" : "var(--white)",
                color: data.shadingLevel === opt.value ? "var(--sun-core)" : "var(--text-secondary)",
                cursor: "pointer", transition: "all 0.2s ease", textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{opt.icon}</div>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: "#ef4444", fontSize: "0.85rem", textAlign: "center", marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onBack} style={{ flex: "0 0 auto", padding: "14px 24px", background: "var(--white)", border: "2px solid var(--border)", borderRadius: "999px", fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          ← Back
        </button>
        <button
          onClick={handleNext}
          style={{
            flex: 1, padding: "16px", background: "linear-gradient(135deg, var(--sun-core), var(--sun-glow))",
            color: "white", fontWeight: 700, fontSize: "1rem", borderRadius: "999px",
            border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(255,140,0,0.35)",
          }}
        >
          See My Estimate →
        </button>
      </div>
    </div>
  );
}

function StepEstimate({ data, estimate, update, onNext, onBack }: { data: FormData; estimate: Estimate; update: (k: keyof FormData, v: string | boolean | number | null) => void; onNext: () => void; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState(data.preferredFinancing || "lease");

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>📊</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem,4vw,2.2rem)", fontWeight: 900, color: "var(--earth-dark)", letterSpacing: "-0.02em", marginBottom: 6 }}>
          Your Solar Estimate
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Based on your ${data.monthlyBill}/mo bill · {data.zipCode}</p>
      </div>

      {/* Savings hero */}
      <div style={{
        background: "linear-gradient(135deg, var(--earth-dark), #2D1F0A)",
        borderRadius: 20, padding: "28px 24px", marginBottom: 20,
        border: "1px solid rgba(255,215,0,0.2)", textAlign: "center",
      }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Estimated Monthly Savings
        </div>
        <div style={{
          fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(2.8rem,8vw,4.5rem)",
          background: "linear-gradient(135deg, var(--sun-core), var(--sun-glow))",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          animation: "countUp 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards",
        }}>
          ${estimate.monthlySavings}/mo
        </div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", marginTop: 4 }}>
          ${estimate.annualSavings.toLocaleString()}/year · ${(estimate.annualSavings * 25).toLocaleString()} over 25 years
        </div>
      </div>

      {/* System specs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { icon: "⚡", val: `${estimate.systemKw} kW`, label: "System Size" },
          { icon: "🔲", val: `${estimate.panels}`, label: "Panels" },
          { icon: "📅", val: `${estimate.roiYears} yrs`, label: "Payback" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.2rem", color: "var(--sun-core)" }}>{s.val}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Satellite roof overlay ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <span>🛰️</span> Your Roof · {data.zipCode}
        </div>
        <SatelliteRoof
          zipCode={data.zipCode}
          panels={estimate.panels}
          systemKw={estimate.systemKw}
        />
      </div>

      {/* Federal credit callout */}
      <div style={{ background: "var(--leaf-light)", borderRadius: 14, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 28, flexShrink: 0 }}>🏛️</span>
        <div>
          <div style={{ fontWeight: 700, color: "var(--leaf-green)", fontSize: "0.9rem" }}>
            30% Federal Tax Credit Available
          </div>
          <div style={{ fontSize: "0.82rem", color: "#166534" }}>
            Saves you ${Math.round(estimate.installCost * 0.3).toLocaleString()} on a ${estimate.installCost.toLocaleString()} system
          </div>
        </div>
      </div>

      {/* Financing tabs */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
          Choose Your Option
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {FINANCING_OPTIONS.filter((o) => o.value === "lease" || o.value === "loan" || o.value === "cash").map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setActiveTab(opt.value); update("preferredFinancing", opt.value); }}
              style={{
                flex: 1, padding: "10px 6px", borderRadius: 12, fontWeight: 700, fontSize: "0.8rem",
                border: activeTab === opt.value ? "2px solid var(--sun-core)" : "2px solid var(--border)",
                background: activeTab === opt.value ? "linear-gradient(135deg, var(--sun-core), var(--sun-glow))" : "var(--white)",
                color: activeTab === opt.value ? "white" : "var(--text-secondary)",
                cursor: "pointer", transition: "all 0.2s ease", textTransform: "capitalize",
              }}
            >
              {opt.value === "lease" ? "$0-Down" : opt.value === "loan" ? "Loan" : "Cash"}
            </button>
          ))}
        </div>

        <div style={{ background: "var(--surface)", border: "2px solid var(--border)", borderRadius: 16, padding: "18px" }}>
          {activeTab === "lease" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Monthly Lease Payment</span>
                <span style={{ fontWeight: 800, color: "var(--sun-core)", fontSize: "1.2rem" }}>${estimate.monthlyLeasePayment}/mo</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>vs. Your Current Bill</span>
                <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>${data.monthlyBill}/mo</span>
              </div>
              <div style={{ height: 1, background: "var(--border)", margin: "10px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, color: "var(--leaf-green)" }}>Immediate Monthly Savings</span>
                <span style={{ fontWeight: 900, color: "var(--leaf-green)", fontSize: "1.1rem" }}>+${(data.monthlyBill || 0) - estimate.monthlyLeasePayment}/mo</span>
              </div>
            </div>
          )}
          {activeTab === "loan" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Monthly Loan Payment</span>
                <span style={{ fontWeight: 800, color: "var(--sun-core)", fontSize: "1.2rem" }}>${estimate.monthlyLoanPayment}/mo</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Federal Tax Credit (30%)</span>
                <span style={{ fontWeight: 700, color: "var(--leaf-green)" }}>-${Math.round(estimate.installCost * 0.3).toLocaleString()}</span>
              </div>
              <div style={{ height: 1, background: "var(--border)", margin: "10px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>Net System Cost</span>
                <span style={{ fontWeight: 900, color: "var(--earth-dark)", fontSize: "1.1rem" }}>${estimate.netCost.toLocaleString()}</span>
              </div>
            </div>
          )}
          {activeTab === "cash" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>System Cost</span>
                <span style={{ fontWeight: 700, color: "var(--text-secondary)", textDecoration: "line-through" }}>${estimate.installCost.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>After 30% Tax Credit</span>
                <span style={{ fontWeight: 800, color: "var(--sun-core)", fontSize: "1.2rem" }}>${estimate.netCost.toLocaleString()}</span>
              </div>
              <div style={{ height: 1, background: "var(--border)", margin: "10px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, color: "var(--leaf-green)" }}>25-Year Return</span>
                <span style={{ fontWeight: 900, color: "var(--leaf-green)", fontSize: "1.1rem" }}>${(estimate.annualSavings * 25 - estimate.netCost).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <p style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 20 }}>
        ✋ This is a rough estimate. Your specialist will provide an exact quote.
      </p>

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onBack} style={{ flex: "0 0 auto", padding: "14px 24px", background: "var(--white)", border: "2px solid var(--border)", borderRadius: "999px", fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          ← Back
        </button>
        <button
          onClick={onNext}
          style={{
            flex: 1, padding: "16px", background: "linear-gradient(135deg, var(--sun-core), var(--sun-glow))",
            color: "white", fontWeight: 700, fontSize: "1rem", borderRadius: "999px",
            border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(255,140,0,0.35)",
          }}
        >
          Claim My Estimate →
        </button>
      </div>
    </div>
  );
}

function StepContact({ data, update, onNext, onBack, submitting, error }: {
  data: FormData;
  update: (k: keyof FormData, v: string | boolean | number | null) => void;
  onNext: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string;
}) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!data.firstName.trim()) errs.firstName = "Required";
    if (!data.lastName.trim()) errs.lastName = "Required";
    if (!data.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errs.email = "Valid email required";
    const digits = data.phone.replace(/\D/g, "");
    if (digits.length < 10) errs.phone = "Valid phone number required";
    if (!data.consentGiven) errs.consent = "Please agree to be contacted";
    return errs;
  };

  const handleNext = () => {
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length === 0) onNext();
  };

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🎯</div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem,4vw,2.2rem)", fontWeight: 900, color: "var(--earth-dark)", letterSpacing: "-0.02em", marginBottom: 6 }}>
          Get Your Full Report
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          A solar expert will review your estimate and contact you with a full proposal.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {[
          { key: "firstName", label: "First Name", placeholder: "John", type: "text" },
          { key: "lastName", label: "Last Name", placeholder: "Smith", type: "text" },
        ].map(f => (
          <div key={f.key}>
            <label style={{ display: "block", fontWeight: 600, fontSize: "0.8rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{f.label}</label>
            <input
              type={f.type}
              placeholder={f.placeholder}
              value={data[f.key as keyof FormData] as string}
              onChange={(e) => { update(f.key as keyof FormData, e.target.value); setFieldErrors(p => ({ ...p, [f.key]: "" })); }}
              style={{
                width: "100%", padding: "13px 15px", fontSize: "0.95rem",
                background: "var(--white)", border: fieldErrors[f.key] ? "2px solid #ef4444" : "2px solid var(--border)",
                borderRadius: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--earth-dark)",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => { if (!fieldErrors[f.key]) e.target.style.borderColor = "var(--sun-flare)"; }}
              onBlur={(e) => { if (!fieldErrors[f.key]) e.target.style.borderColor = "var(--border)"; }}
            />
            {fieldErrors[f.key] && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: 3 }}>{fieldErrors[f.key]}</p>}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontWeight: 600, fontSize: "0.8rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Email Address</label>
        <input
          type="email"
          placeholder="john@example.com"
          value={data.email}
          onChange={(e) => { update("email", e.target.value); setFieldErrors(p => ({ ...p, email: "" })); }}
          style={{
            width: "100%", padding: "13px 15px", fontSize: "0.95rem",
            background: "var(--white)", border: fieldErrors.email ? "2px solid #ef4444" : "2px solid var(--border)",
            borderRadius: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--earth-dark)",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => { if (!fieldErrors.email) e.target.style.borderColor = "var(--sun-flare)"; }}
          onBlur={(e) => { if (!fieldErrors.email) e.target.style.borderColor = "var(--border)"; }}
        />
        {fieldErrors.email && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: 3 }}>{fieldErrors.email}</p>}
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontWeight: 600, fontSize: "0.8rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Phone Number</label>
        <input
          type="tel"
          placeholder="(555) 123-4567"
          value={data.phone}
          onChange={(e) => { update("phone", formatPhone(e.target.value)); setFieldErrors(p => ({ ...p, phone: "" })); }}
          style={{
            width: "100%", padding: "13px 15px", fontSize: "0.95rem",
            background: "var(--white)", border: fieldErrors.phone ? "2px solid #ef4444" : "2px solid var(--border)",
            borderRadius: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--earth-dark)",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => { if (!fieldErrors.phone) e.target.style.borderColor = "var(--sun-flare)"; }}
          onBlur={(e) => { if (!fieldErrors.phone) e.target.style.borderColor = "var(--border)"; }}
        />
        {fieldErrors.phone && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: 3 }}>{fieldErrors.phone}</p>}
      </div>

      {/* Contact preference */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontWeight: 600, fontSize: "0.8rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Preferred Contact Method</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[{ v: "call", l: "📞 Phone Call" }, { v: "sms", l: "💬 Text / SMS" }, { v: "email", l: "📧 Email" }].map(o => (
            <button
              key={o.v}
              onClick={() => update("contactPreference", o.v)}
              style={{
                padding: "12px 8px", borderRadius: 12, fontWeight: 600, fontSize: "0.82rem",
                border: data.contactPreference === o.v ? "2px solid var(--sun-core)" : "2px solid var(--border)",
                background: data.contactPreference === o.v ? "linear-gradient(135deg, #FFF3D0, #FFFBF2)" : "var(--white)",
                color: data.contactPreference === o.v ? "var(--sun-core)" : "var(--text-secondary)",
                cursor: "pointer", transition: "all 0.2s ease",
              }}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* Consent */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={data.consentGiven}
            onChange={(e) => { update("consentGiven", e.target.checked); setFieldErrors(p => ({ ...p, consent: "" })); }}
            style={{ width: 18, height: 18, marginTop: 2, accentColor: "var(--sun-core)", flexShrink: 0 }}
          />
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
            I agree to be contacted by SolarAdvisor and its partners via phone, SMS, or email about my solar estimate. Message and data rates may apply. Reply STOP to opt out at any time.
          </span>
        </label>
        {fieldErrors.consent && <p style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: 4 }}>{fieldErrors.consent}</p>}
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#DC2626", fontSize: "0.875rem" }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onBack} style={{ flex: "0 0 auto", padding: "14px 24px", background: "var(--white)", border: "2px solid var(--border)", borderRadius: "999px", fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          ← Back
        </button>
        <button
          onClick={handleNext}
          disabled={submitting}
          style={{
            flex: 1, padding: "16px", background: submitting ? "var(--border)" : "linear-gradient(135deg, var(--sun-core), var(--sun-glow))",
            color: "white", fontWeight: 700, fontSize: "1rem", borderRadius: "999px",
            border: "none", cursor: submitting ? "not-allowed" : "pointer",
            boxShadow: submitting ? "none" : "0 4px 20px rgba(255,140,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {submitting ? (
            <>
              <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              Processing...
            </>
          ) : "Send My Free Report →"}
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16 }}>
        {["🔒 Secure & Private", "✓ No Obligation", "✓ No Spam"].map(b => (
          <span key={b} style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>{b}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Funnel Component ─────────────────────────────────────────── */
export default function FunnelPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [estimate, setEstimate] = useState<Estimate | null>(null);

  const [formData, setFormData] = useState<FormData>({
    zipCode: "",
    isHomeowner: null,
    monthlyBill: null,
    roofSlope: "",
    shadingLevel: "",
    isDecisionMaker: true,
    preferredFinancing: "lease",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    contactPreference: "call",
    consentGiven: false,
  });

  const update = useCallback((key: keyof FormData, value: string | boolean | number | null) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  // Pre-calculate estimate when bill is set
  useEffect(() => {
    if (formData.monthlyBill) {
      setEstimate(quickEstimate(formData.monthlyBill));
    }
  }, [formData.monthlyBill]);

  const goNext = () => {
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStep(s => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          utmSource: new URLSearchParams(window.location.search).get("utm_source") || undefined,
          utmMedium: new URLSearchParams(window.location.search).get("utm_medium") || undefined,
          utmCampaign: new URLSearchParams(window.location.search).get("utm_campaign") || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "Something went wrong. Please try again.");
        return;
      }

      router.push(`/thank-you?tier=${data.tier}&savings=${estimate?.monthlySavings || 0}&name=${encodeURIComponent(formData.firstName)}`);
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const progress = (step / TOTAL_STEPS) * 100;

  const stepLabels = ["Location", "Qualify", "Estimate", "Contact", "Done"];

  return (
    <div style={{ minHeight: "100vh", background: "var(--sun-bg)", fontFamily: "var(--font-body)" }}>
      {/* Top bar */}
      <div style={{
        background: "var(--white)", borderBottom: "1px solid var(--border)",
        padding: "14px clamp(16px,4vw,40px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <span style={{ fontSize: 24 }}>☀</span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "1.1rem", color: "var(--earth-dark)" }}>SolarAdvisor</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>🔒 Secure · Free · No Obligation</span>
        </div>
      </div>

      {/* Progress */}
      <div style={{ background: "var(--white)", padding: "16px clamp(16px,4vw,40px)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            {stepLabels.map((label, i) => (
              <div key={label} style={{
                fontSize: "0.72rem", fontWeight: i + 1 <= step ? 700 : 500,
                color: i + 1 <= step ? "var(--sun-core)" : "var(--text-muted)",
              }}>
                {label}
              </div>
            ))}
          </div>
          <div style={{ height: 6, background: "var(--border)", borderRadius: "999px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, var(--sun-core), var(--sun-glow))",
              borderRadius: "999px",
              transition: "width 0.5s cubic-bezier(0.34,1.56,0.64,1)",
            }} />
          </div>
          <div style={{ textAlign: "right", marginTop: 4, fontSize: "0.72rem", color: "var(--text-muted)" }}>
            Step {step} of {TOTAL_STEPS}
          </div>
        </div>
      </div>

      {/* Form card */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "clamp(24px,4vw,48px) clamp(16px,4vw,24px)" }}>
        <div style={{
          background: "var(--white)", borderRadius: 24, padding: "clamp(24px,5vw,40px)",
          border: "1px solid var(--border)", boxShadow: "0 12px 48px rgba(255,140,0,0.1), 0 4px 16px rgba(0,0,0,0.06)",
          animation: "sunRise 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards",
        }}>
          {step === 1 && <StepZip data={formData} update={update} onNext={goNext} />}
          {step === 2 && <StepQualify data={formData} update={update} onNext={goNext} onBack={goBack} />}
          {step === 3 && estimate && <StepEstimate data={formData} estimate={estimate} update={update} onNext={goNext} onBack={goBack} />}
          {step === 4 && (
            <StepContact
              data={formData}
              update={update}
              onNext={handleSubmit}
              onBack={goBack}
              submitting={submitting}
              error={submitError}
            />
          )}
        </div>

        {/* Trust bar */}
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 16, marginTop: 24 }}>
          {["4.9★ Rated", "14,800+ Estimates", "No Cost · No Obligation"].map(t => (
            <span key={t} style={{
              background: "var(--white)", border: "1px solid var(--border)",
              borderRadius: "999px", padding: "5px 14px",
              fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)",
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Live chat — available throughout funnel */}
      <LiveChat />
    </div>
  );
}
