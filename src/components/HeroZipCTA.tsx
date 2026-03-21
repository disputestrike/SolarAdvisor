"use client";

import { useState } from "react";

export default function HeroZipCTA() {
  const [zip, setZip] = useState("");
  const [hint, setHint] = useState("");

  /** Full page navigation — reliable if client router fails after runtime errors. */
  const go = () => {
    const z = zip.replace(/\D/g, "").slice(0, 5);
    if (z.length === 5) {
      setHint("");
    } else if (z.length > 0) {
      setHint("Enter a 5-digit ZIP to prefill your estimate.");
    } else {
      setHint("");
    }
    if (typeof window !== "undefined") {
      window.location.assign(z.length === 5 ? `/funnel?zip=${z}` : "/funnel");
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 0,
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 20px 50px rgba(15,23,42,0.35)",
          border: "1px solid rgba(255,255,255,0.2)",
        }}
      >
        <input
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="ZIP code"
          maxLength={5}
          value={zip}
          onChange={(e) => {
            setHint("");
            setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
          }}
          onKeyDown={(e) => e.key === "Enter" && go()}
          style={{
            flex: "1 1 140px",
            minWidth: 140,
            padding: "18px 22px",
            fontSize: "1.15rem",
            fontWeight: 600,
            border: "none",
            outline: "none",
            fontFamily: "var(--font-brand)",
            color: "#0f172a",
          }}
        />
        <button
          type="button"
          onClick={go}
          style={{
            flex: "1 1 160px",
            padding: "18px 28px",
            fontSize: "1.05rem",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-brand)",
            background: "#ea580c",
            color: "white",
            textTransform: "none",
            letterSpacing: "0.01em",
          }}
        >
          Calculate cost
        </button>
      </div>
      {hint && (
        <p
          style={{
            margin: "10px 0 0",
            fontSize: "0.85rem",
            color: "#fef3c7",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
