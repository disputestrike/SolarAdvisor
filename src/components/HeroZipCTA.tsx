"use client";

import { useState } from "react";

export default function HeroZipCTA() {
  const [zip, setZip] = useState("");
  const [hint, setHint] = useState("");

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <form
        action="/funnel"
        method="get"
        onSubmit={(e) => {
          const z = zip.replace(/\D/g, "").slice(0, 5);
          e.preventDefault();
          if (z.length > 0 && z.length < 5) {
            setHint("Enter a 5-digit ZIP to prefill your estimate.");
            return;
          }
          setHint("");
          window.location.assign(z.length === 5 ? `/funnel?zip=${z}` : "/funnel");
        }}
        style={{ margin: 0 }}
      >
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
          name="zip"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="ZIP code"
          maxLength={5}
          value={zip}
          onChange={(e) => {
            setHint("");
            setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
          }}
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
          type="submit"
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
      </form>
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
