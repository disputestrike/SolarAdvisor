"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

function ThankYouContent() {
  const params = useSearchParams();
  const tier = params.get("tier") || "medium";
  const savings = parseInt(params.get("savings") || "0");
  const name = params.get("name") || "there";

  const isHot = tier === "hot";

  return (
    <div style={{ minHeight: "100vh", background: "var(--sun-bg)", fontFamily: "var(--font-body)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      {/* Confetti-like sun */}
      <div style={{
        width: 100, height: 100, borderRadius: "50%",
        background: "radial-gradient(circle at 35% 35%, var(--sun-glow), var(--sun-core))",
        boxShadow: "0 0 40px rgba(255,215,0,0.6), 0 0 80px rgba(255,140,0,0.3)",
        marginBottom: 28, animation: "sunPulse 3s ease-in-out infinite",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44,
      }}>
        ☀
      </div>

      <div style={{ textAlign: "center", maxWidth: 560 }}>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: "clamp(2rem,5vw,3rem)", fontWeight: 900,
          color: "var(--earth-dark)", letterSpacing: "-0.02em", marginBottom: 14,
        }}>
          {isHot ? `You're a Great Fit, ${name}!` : `Your Estimate Is Ready, ${name}!`}
        </h1>

        <p style={{ color: "var(--text-secondary)", fontSize: "1.05rem", lineHeight: 1.7, marginBottom: 28 }}>
          {isHot
            ? "Based on your profile, you qualify for our best solar packages including $0-down options. A specialist will contact you within the hour."
            : "A SolarAdvisor expert will reach out within 24 hours with your full personalized proposal. Check your email for a preview."}
        </p>

        {/* Savings preview */}
        {savings > 0 && (
          <div style={{
            background: "var(--white)", border: "2px solid var(--sun-glow)",
            borderRadius: 20, padding: "24px 32px", marginBottom: 28,
            boxShadow: "0 0 40px rgba(255,215,0,0.15)",
          }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
              Estimated Monthly Savings
            </div>
            <div style={{
              fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(2.5rem,7vw,3.8rem)",
              background: "linear-gradient(135deg, var(--sun-core), var(--sun-glow))",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              animation: "countUp 1s cubic-bezier(0.34,1.56,0.64,1) forwards",
            }}>
              ${savings}/month
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: 4 }}>
              That&apos;s ${savings * 12}/year · ${(savings * 300).toLocaleString()} over 25 years
            </div>
          </div>
        )}

        {/* What happens next */}
        <div style={{
          background: "var(--earth-dark)", borderRadius: 20, padding: "24px 28px",
          textAlign: "left", marginBottom: 28,
        }}>
          <div style={{ fontWeight: 700, color: "var(--sun-glow)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
            What Happens Next
          </div>
          {[
            { icon: "📱", time: isHot ? "Within 1 hour" : "Within 24 hours", desc: "A solar specialist contacts you to confirm your estimate" },
            { icon: "📋", time: "Same day", desc: "You receive your full savings report and financing options by email" },
            { icon: "📅", time: "At your convenience", desc: "Optional site visit for exact measurement and final quote" },
            { icon: "⚡", time: "4–8 weeks", desc: "If you decide to move forward, panels are installed and generating power" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 14, marginBottom: i < 3 ? 14 : 0 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--sun-glow)", marginBottom: 2 }}>{item.time}</div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.875rem" }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Referral CTA */}
        <div style={{
          background: "var(--white)", border: "1px solid var(--border)",
          borderRadius: 16, padding: "20px 24px", marginBottom: 28,
          textAlign: "center",
        }}>
          <div style={{ fontWeight: 700, color: "var(--earth-dark)", marginBottom: 6 }}>
            Know a neighbor who should go solar?
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 14 }}>
            Share SolarAdvisor and help them start saving too.
          </p>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: "SolarAdvisor", text: "Get a free solar estimate!", url: window.location.origin });
              } else {
                navigator.clipboard.writeText(window.location.origin);
                alert("Link copied to clipboard!");
              }
            }}
            style={{
              background: "linear-gradient(135deg, var(--sun-core), var(--sun-glow))",
              color: "white", fontWeight: 700, fontSize: "0.9rem",
              padding: "12px 28px", borderRadius: "999px", border: "none", cursor: "pointer",
              boxShadow: "0 4px 16px rgba(255,140,0,0.3)",
            }}
          >
            🔗 Share SolarAdvisor
          </button>
        </div>

        <Link href="/" style={{ color: "var(--text-muted)", fontSize: "0.85rem", textDecoration: "underline" }}>
          ← Back to Homepage
        </Link>
      </div>
    </div>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--sun-bg)" }}>
        <div style={{ fontSize: 48, animation: "spin 1s linear infinite" }}>☀</div>
      </div>
    }>
      <ThankYouContent />
    </Suspense>
  );
}
