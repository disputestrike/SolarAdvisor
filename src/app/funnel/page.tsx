"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import BrandLogo from "@/components/BrandLogo";
import PlacesAddressField, { type ResolvedPlace } from "@/components/PlacesAddressField";

const SatelliteRoof = dynamic(() => import("@/components/SatelliteRoof"), { ssr: false });
const LiveChat = dynamic(() => import("@/components/LiveChat"), { ssr: false });

const FUNNEL_MAP_BG =
  "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=2400&q=82";

/* ─── Types ─────────────────────────────────────────────────────────── */
interface FormData {
  addressInput: string;
  formattedAddress: string;
  streetAddress: string;
  placeId: string;
  lat: number | null;
  lng: number | null;
  city: string;
  state: string;
  zipCode: string;
  utilityProvider: string;
  buildingType:
    | "residential"
    | "commercial"
    | "government"
    | "education"
    | "agriculture"
    | "industrial"
    | "multifamily"
    | "mixed_use"
    | "other";
  stories: "one" | "two_plus" | "";
  isHomeowner: boolean | null;
  monthlyBill: number | null;
  roofSlope: string;
  shadingLevel: string;
  roofType: string;
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

const TOTAL_STEPS = 4;

const BILL_OPTIONS = [
  { label: "Under $75", value: 60 },
  { label: "$75 – $125", value: 100 },
  { label: "$125 – $200", value: 162 },
  { label: "$200 – $300", value: 250 },
  { label: "$300 – $450", value: 375 },
  { label: "Over $450", value: 500 },
];

const ROOF_OPTIONS = [
  { value: "low", label: "Low pitch", desc: "Gentle slope" },
  { value: "medium", label: "Medium", desc: "Typical residential" },
  { value: "steep", label: "Steep", desc: "Higher angle" },
  { value: "flat", label: "Flat", desc: "Commercial / low-slope" },
];

const SHADE_OPTIONS = [
  { value: "none", label: "Little / none", desc: "10am–3pm mostly clear" },
  { value: "light", label: "Light", desc: "Some trees or obstacles" },
  { value: "moderate", label: "Moderate", desc: "Noticeable shade periods" },
  { value: "heavy", label: "Heavy", desc: "Often shaded mid-day" },
];

const BUILDING_TYPE_OPTIONS: Array<{
  value: FormData["buildingType"];
  label: string;
}> = [
  { value: "residential", label: "Residential" },
  { value: "commercial", label: "Commercial" },
  { value: "government", label: "Government" },
  { value: "education", label: "Education" },
  { value: "agriculture", label: "Agriculture" },
  { value: "industrial", label: "Industrial" },
  { value: "multifamily", label: "Multifamily" },
  { value: "mixed_use", label: "Mixed use" },
  { value: "other", label: "Other" },
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
function StepAddressEnergy({
  data,
  update,
  onNext,
}: {
  data: FormData;
  update: (k: keyof FormData, v: string | boolean | number | null) => void;
  onNext: () => void;
}) {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const [resolved, setResolved] = useState<ResolvedPlace | null>(null);
  const [zipInfo, setZipInfo] = useState<ZipInfo | null>(null);
  const [loadingZip, setLoadingZip] = useState(false);
  const [error, setError] = useState("");

  const lookupZip = useCallback(async (zip: string) => {
    if (zip.length !== 5) return;
    setLoadingZip(true);
    try {
      const res = await fetch(`/api/leads/zip?zip=${zip}`);
      const d = await res.json();
      if (d.state) setZipInfo(d);
    } catch { /* optional */ }
    setLoadingZip(false);
  }, []);

  const applyResolved = useCallback(
    (p: ResolvedPlace | null) => {
      setResolved(p);
      if (!p) {
        update("placeId", "");
        update("lat", null);
        update("lng", null);
        return;
      }
      update("zipCode", p.zipCode);
      update("formattedAddress", p.formattedAddress);
      update("streetAddress", p.streetAddress);
      update("placeId", p.placeId);
      update("lat", p.lat);
      update("lng", p.lng);
      update("city", p.city);
      update("state", p.state);
      void lookupZip(p.zipCode);
    },
    [update, lookupZip]
  );

  const handleNext = () => {
    if (!resolved) {
      setError("Please select your full address from the dropdown list.");
      return;
    }
    if (!data.utilityProvider.trim()) {
      setError("Enter your electric utility or retail provider (e.g. PG&E, Oncor).");
      return;
    }
    if (data.monthlyBill === null) {
      setError("Select your typical monthly electric bill.");
      return;
    }
    setError("");
    onNext();
  };

  return (
    <div>
      <h2
        style={{
          fontFamily: "var(--font-brand)",
          fontSize: "clamp(1.35rem, 3.5vw, 1.85rem)",
          fontWeight: 700,
          color: "#0f172a",
          marginBottom: 8,
          letterSpacing: "-0.02em",
        }}
      >
        Determine location &amp; usage
      </h2>
      <p style={{ color: "#64748b", fontSize: "0.92rem", marginBottom: 20, lineHeight: 1.55 }}>
        We use your street address to center satellite imagery on your roof. Choose a suggestion from the list — same as professional solar audit tools.
      </p>

      <PlacesAddressField
        apiKey={mapsKey}
        value={data.addressInput}
        onChangeText={(v) => update("addressInput", v)}
        onResolved={applyResolved}
        error={error && !resolved ? error : undefined}
      />

      {loadingZip && <p style={{ fontSize: "0.8rem", color: "#64748b" }}>Loading regional incentives…</p>}
      {zipInfo?.city && (
        <div
          style={{
            background: "#ecfdf5",
            color: "#166534",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: "0.88rem",
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          {zipInfo.city}, {zipInfo.state}
          {zipInfo.incentives?.stateRebate
            ? ` · up to $${zipInfo.incentives.stateRebate.toLocaleString()} state programs in some areas`
            : ""}
        </div>
      )}

      <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 8 }}>
        Electric utility / provider
      </label>
      <input
        type="text"
        placeholder="e.g. Austin Energy, ComEd, SDG&amp;E"
        value={data.utilityProvider}
        onChange={(e) => update("utilityProvider", e.target.value)}
        style={{
          width: "100%",
          padding: "14px 16px",
          fontSize: "1rem",
          border: "2px solid #e2e8f0",
          borderRadius: 6,
          marginBottom: 20,
          fontFamily: "var(--font-brand)",
        }}
      />

      <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 10 }}>
        Typical monthly electric bill
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
        {BILL_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => {
              update("monthlyBill", opt.value);
              setError("");
            }}
            style={{
              padding: "12px 6px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: "0.82rem",
              border: data.monthlyBill === opt.value ? "2px solid #ea580c" : "2px solid #e2e8f0",
              background: data.monthlyBill === opt.value ? "#fff7ed" : "white",
              color: data.monthlyBill === opt.value ? "#c2410c" : "#475569",
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && resolved && <p style={{ color: "#dc2626", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}

      <button
        type="button"
        onClick={handleNext}
        style={{
          width: "100%",
          padding: "16px",
          background: "#ea580c",
          color: "white",
          fontWeight: 700,
          fontSize: "1rem",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
        }}
      >
        Next →
      </button>
    </div>
  );
}

function StepProperty({ data, update, onNext, onBack }: { data: FormData; update: (k: keyof FormData, v: string | boolean | number | null) => void; onNext: () => void; onBack: () => void }) {
  const [error, setError] = useState("");

  if (data.isHomeowner === false) {
    return (
      <div>
        <h2 style={{ fontFamily: "var(--font-brand)", fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
          Thanks for your interest
        </h2>
        <p style={{ color: "#475569", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 24 }}>
          SolarAdvisor connects <strong>property owners</strong> with vetted solar specialists. If you are not the owner or authorized decision-maker for this property, we cannot continue this estimate.
        </p>
        <Link href="/" style={{ display: "inline-block", color: "#2563eb", fontWeight: 600 }}>
          ← Back to home
        </Link>
      </div>
    );
  }

  const handleNext = () => {
    if (data.isHomeowner === null) {
      setError("Please indicate whether you own this property.");
      return;
    }
    setError("");
    onNext();
  };

  const btn = (active: boolean): CSSProperties => ({
    padding: "14px 12px",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: "0.88rem",
    border: active ? "2px solid #ea580c" : "2px solid #e2e8f0",
    background: active ? "#fff7ed" : "white",
    color: active ? "#c2410c" : "#475569",
    cursor: "pointer",
    textAlign: "center",
  });

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-brand)", fontSize: "clamp(1.35rem, 3.5vw, 1.85rem)", fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
        Property details
      </h2>
      <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: 22, lineHeight: 1.55 }}>
        Eligibility and roof context for <strong>{data.formattedAddress || "your property"}</strong>.
      </p>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 10 }}>
          Do you own this property or have authority to install solar?
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button type="button" onClick={() => { update("isHomeowner", true); setError(""); }} style={btn(data.isHomeowner === true)}>
            Yes
          </button>
          <button type="button" onClick={() => { update("isHomeowner", false); setError(""); }} style={btn(false)}>
            No
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 10 }}>
          Building type
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {BUILDING_TYPE_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => update("buildingType", opt.value)} style={btn(data.buildingType === opt.value)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 10 }}>
          Stories (optional)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button type="button" onClick={() => update("stories", "one")} style={btn(data.stories === "one")}>
            One story
          </button>
          <button type="button" onClick={() => update("stories", "two_plus")} style={btn(data.stories === "two_plus")}>
            Two or more
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 10 }}>
          Roof pitch (optional)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {ROOF_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => update("roofSlope", opt.value)} style={btn(data.roofSlope === opt.value)}>
              <div>{opt.label}</div>
              <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 500 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 10 }}>
          Mid-day shading (optional)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {SHADE_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => update("shadingLevel", opt.value)} style={btn(data.shadingLevel === opt.value)}>
              <div>{opt.label}</div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "flex", gap: 12 }}>
        <button type="button" onClick={onBack} style={{ flex: "0 0 auto", padding: "14px 20px", background: "white", border: "2px solid #e2e8f0", borderRadius: 6, fontWeight: 600, cursor: "pointer", color: "#64748b" }}>
          ← Back
        </button>
        <button type="button" onClick={handleNext} style={{ flex: 1, padding: "16px", background: "#ea580c", color: "white", fontWeight: 700, fontSize: "1rem", borderRadius: 6, border: "none", cursor: "pointer" }}>
          Next →
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
        <h2 style={{ fontFamily: "var(--font-brand)", fontSize: "clamp(1.35rem, 3.5vw, 1.85rem)", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em", marginBottom: 6 }}>
          Your solar estimate
        </h2>
        <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.5 }}>
          ${data.monthlyBill}/mo bill · {data.utilityProvider && <>{data.utilityProvider} · </>}
          {data.formattedAddress ? data.formattedAddress.split(",").slice(-2).join(",").trim() : `ZIP ${data.zipCode}`}
        </p>
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
          { val: `${estimate.systemKw} kW`, label: "System size" },
          { val: `${estimate.panels}`, label: "Panels" },
          { val: `${estimate.roiYears} yrs`, label: "Simple payback" },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--white)", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 10px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-brand)", fontWeight: 700, fontSize: "1.15rem", color: "#c2410c" }}>{s.val}</div>
            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 600, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Satellite roof overlay ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          Roof preview · satellite
        </div>
        <SatelliteRoof
          zipCode={data.zipCode}
          panels={estimate.panels}
          systemKw={estimate.systemKw}
          lat={data.lat}
          lng={data.lng}
        />
      </div>

      {/* Federal credit callout */}
      <div style={{ background: "#ecfdf5", borderRadius: 10, padding: "14px 18px", marginBottom: 20, border: "1px solid #bbf7d0" }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Federal incentive</div>
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
    addressInput: "",
    formattedAddress: "",
    streetAddress: "",
    placeId: "",
    lat: null,
    lng: null,
    city: "",
    state: "",
    zipCode: "",
    utilityProvider: "",
    buildingType: "residential",
    stories: "",
    isHomeowner: null,
    monthlyBill: null,
    roofSlope: "",
    shadingLevel: "",
    roofType: "",
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

  useEffect(() => {
    const zip = new URLSearchParams(window.location.search).get("zip");
    if (zip && /^\d{5}$/.test(zip)) {
      setFormData((prev) => (prev.zipCode === zip ? prev : { ...prev, zipCode: zip }));
    }
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
      const qs = new URLSearchParams(window.location.search);
      const payload = {
        zipCode: formData.zipCode,
        formattedAddress: formData.formattedAddress,
        streetAddress: formData.streetAddress || undefined,
        placeId: formData.placeId,
        latitude: formData.lat ?? undefined,
        longitude: formData.lng ?? undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        utilityProvider: formData.utilityProvider.trim(),
        buildingType: formData.buildingType,
        stories: formData.stories || undefined,
        isHomeowner: true as const,
        monthlyBill: formData.monthlyBill!,
        roofSlope: formData.roofSlope || undefined,
        shadingLevel: formData.shadingLevel || undefined,
        roofType: formData.roofType || undefined,
        isDecisionMaker: formData.isDecisionMaker,
        preferredFinancing: formData.preferredFinancing,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone,
        contactPreference: formData.contactPreference,
        consentGiven: formData.consentGiven,
        utmSource: qs.get("utm_source") || undefined,
        utmMedium: qs.get("utm_medium") || undefined,
        utmCampaign: qs.get("utm_campaign") || undefined,
      };

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          data.details?.fieldErrors
            ? Object.values(data.details.fieldErrors).flat().join(" ")
            : data.error || data.detail || "Something went wrong. Please try again.";
        setSubmitError(typeof msg === "string" ? msg : "Something went wrong. Please try again.");
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

  const stepLabels = ["Location", "Property", "Estimate", "Contact"];

  return (
    <div style={{ position: "relative", minHeight: "100vh", fontFamily: "var(--font-brand)" }}>
      <Image
        src={FUNNEL_MAP_BG}
        alt=""
        fill
        priority
        sizes="100vw"
        style={{ objectFit: "cover" }}
      />
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)", pointerEvents: "none" }} aria-hidden />

      <div style={{ position: "relative", zIndex: 2 }}>
      {/* Top bar */}
      <div style={{
        background: "rgba(255,255,255,0.97)", borderBottom: "1px solid #e2e8f0",
        padding: "14px clamp(16px,4vw,40px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <BrandLogo />
        <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Secure · Free estimate</span>
      </div>

      {/* Progress */}
      <div style={{ background: "rgba(255,255,255,0.96)", padding: "16px clamp(16px,4vw,40px)", borderBottom: "1px solid #e2e8f0" }}>
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
              background: "#ea580c",
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
          background: "rgba(255,255,255,0.98)", borderRadius: 12, padding: "clamp(24px,5vw,40px)",
          border: "1px solid #e2e8f0", boxShadow: "0 25px 50px rgba(0,0,0,0.2)",
        }}>
          {step === 1 && <StepAddressEnergy data={formData} update={update} onNext={goNext} />}
          {step === 2 && <StepProperty data={formData} update={update} onNext={goNext} onBack={goBack} />}
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
          {["4.9★ Rated", "3.3M+ Estimates", "No Cost · No Obligation"].map(t => (
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
    </div>
  );
}
