import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import BrandLogo from "@/components/BrandLogo";
import DoeTrustBadge from "@/components/DoeTrustBadge";
import HeroZipCTA from "@/components/HeroZipCTA";

const LiveChat = dynamic(() => import("@/components/LiveChat"), { ssr: false });
const SatelliteRoofDemo = dynamic(() => import("@/components/SatelliteRoofDemo"), { ssr: false });

/** Social proof counter — static display; tune to match your analytics when available. */
const ONLINE_ESTIMATES_COUNT = "3,372,403";
const ONLINE_ESTIMATES_SINCE = 2008;

// Reliable background images — no API key needed, always render
const HERO_SKY =
  "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=2400&q=80";
const STRIP_PANELS =
  "https://images.unsplash.com/photo-1611365892117-00ac5ef43c90?auto=format&fit=crop&w=2000&q=85";

const TESTIMONIALS = [
  { name: "Marcus T.", location: "Phoenix, AZ", savings: "$187/mo", quote: "My bill dropped from $340 to $153. SolarAdvisor made the whole process painless.", stars: 5 },
  { name: "Linda R.", location: "Tampa, FL", savings: "$142/mo", quote: "I was skeptical but the estimate was spot-on. $0 down and I'm saving day one.", stars: 5 },
  { name: "James K.", location: "San Diego, CA", savings: "$230/mo", quote: "Best decision I made for my home. The calculator was incredibly accurate.", stars: 5 },
  { name: "Priya M.", location: "Austin, TX", savings: "$165/mo", quote: "The team walked me through every option. No pressure, pure expert guidance.", stars: 5 },
];

const FAQS = [
  { q: "How does $0-down solar work?", a: "You lease the solar system with no upfront cost. Your monthly lease payment is set lower than your current electricity bill, so you start saving immediately. No installation cost, no maintenance cost." },
  { q: "What is the 30% federal tax credit?", a: "The Inflation Reduction Act provides a 30% Investment Tax Credit (ITC) on the full cost of your solar system. If you purchase or finance your system, you can claim this credit on your federal tax return." },
  { q: "How long do solar panels last?", a: "Quality solar panels are warranted for 25–30 years and typically last 30–40 years. Most systems pay for themselves in 6–10 years, generating free electricity for 20+ years after that." },
  { q: "Will solar increase my home value?", a: "Yes. Studies by the National Renewable Energy Laboratory show solar-equipped homes sell for 4–6% more than comparable homes. Buyers pay a premium for low energy costs." },
  { q: "What if my roof isn't perfect?", a: "We work with all roof types. If your roof needs repairs, we can coordinate that before installation. Flat, sloped, tile, shingle — we've done them all." },
  { q: "How long does installation take?", a: "Most residential installations are completed in 1–3 days. Permitting typically takes 2–6 weeks depending on your municipality. You'll have power in 4–8 weeks from agreement." },
];

const PROCESS_STEPS = [
  { num: "01", title: "Free estimate", desc: "Personalized savings analysis in about a minute — no obligation." },
  { num: "02", title: "Site assessment", desc: "A specialist reviews your roof, shading, and usage on-site or remotely." },
  { num: "03", title: "Custom proposal", desc: "Financing, incentives, and production modeled for your property." },
  { num: "04", title: "Professional install", desc: "Certified crews complete most systems in 1–3 days." },
  { num: "05", title: "Inspection & PTO", desc: "Permits, inspection, and utility permission to operate handled for you." },
  { num: "06", title: "Start saving", desc: "Monitor production and savings; support when you need it." },
];

function Bullet({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
      <span
        style={{
          flexShrink: 0, width: 6, height: 6, marginTop: "0.45rem", borderRadius: "50%",
          background: "var(--corp-blue)",
          opacity: 0.85,
        }}
      />
      <span style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.55 }}>{children}</span>
    </div>
  );
}

export default function HomePage() {
  return (
    <main style={{ background: "var(--surface-page)", minHeight: "100vh", fontFamily: "var(--font-brand)" }}>
      {/* ——— NAV ——— */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
      <nav
        style={{ padding: "0 clamp(16px, 4vw, 40px)" }}
        className="nav-pro"
      >
        <div className="nav-pro__left" style={{ justifySelf: "start" }}>
          <BrandLogo />
        </div>
        <div
          className="nav-pro__center"
          style={{
            justifySelf: "center",
            textAlign: "center",
            fontSize: "clamp(0.78rem, 1.5vw, 0.9rem)",
            color: "var(--corp-navy)",
            lineHeight: 1.35,
            fontWeight: 500,
          }}
        >
          <span style={{ color: "var(--corp-blue)", fontWeight: 800, fontSize: "clamp(0.95rem, 2vw, 1.1rem)" }}>
            {ONLINE_ESTIMATES_COUNT}
          </span>
          <span style={{ color: "var(--corp-muted)", display: "block" }}>
            online solar estimates since {ONLINE_ESTIMATES_SINCE}
          </span>
        </div>
        <div className="nav-pro__right" style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <a href="#how-it-works" style={{ color: "var(--corp-muted)", fontWeight: 600, fontSize: "0.82rem", textDecoration: "none" }}>How it works</a>
          <a href="#faq" style={{ color: "var(--corp-muted)", fontWeight: 600, fontSize: "0.82rem", textDecoration: "none" }}>FAQ</a>
          <DoeTrustBadge />
        </div>
      </nav>
      </header>

      {/* ——— HERO ——— */}
      <section className="hero-pro" style={{ position: "relative", padding: 0 }}>
        <Image
          src={HERO_SKY}
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-pro__bg"
          style={{ objectFit: "cover", objectPosition: "center 30%" }}
        />
        <div className="hero-pro__overlay" aria-hidden />
        <div className="hero-pro__inner" style={{ padding: "clamp(72px, 10vh, 120px) clamp(20px, 5vw, 48px)" }}>
          <p style={{
            fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
            color: "rgba(248, 250, 252, 0.85)", marginBottom: 14,
          }}>
            Solar · financing · incentives
          </p>
          <h1 style={{
            fontFamily: "var(--font-brand)", fontWeight: 700,
            fontSize: "clamp(1.85rem, 4.5vw, 3rem)", lineHeight: 1.15,
            letterSpacing: "-0.02em", color: "#ffffff", marginBottom: 28,
            textShadow: "0 2px 24px rgba(0,0,0,0.25)",
          }}>
            See how much it will cost to install solar
          </h1>

          <HeroZipCTA />

          <p style={{ marginTop: 18, fontSize: "0.88rem", color: "rgba(248,250,252,0.75)", fontWeight: 500 }}>
            Free estimate · Typical completion under one minute · No obligation
          </p>

          <div
            style={{
              marginTop: 36,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {["30% federal tax credit (purchase / loan)", "$0-down lease options", "25-year equipment coverage typical"].map((t) => (
              <span
                key={t}
                style={{
                  fontSize: "0.72rem", fontWeight: 600, color: "rgba(248,250,252,0.92)",
                  background: "rgba(15,23,42,0.35)", border: "1px solid rgba(255,255,255,0.2)",
                  padding: "6px 12px", borderRadius: 4,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Photoreal strip — grounds the page in real hardware */}
      <section style={{ position: "relative", height: "min(38vw, 420px)", minHeight: 200 }}>
        <Image
          src={STRIP_PANELS}
          alt="Solar panels installed on a residential roof"
          fill
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center 60%" }}
        />
        <div
          style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.55) 100%)",
            pointerEvents: "none",
          }}
          aria-hidden
        />
      </section>

      <LiveChat />

      {/* ——— METRICS ROW ——— */}
      <section style={{ background: "white", borderBottom: "1px solid #e2e8f0", padding: "40px clamp(20px, 5vw, 80px)" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 28, textAlign: "center" }}>
          {[
            { val: "3.3M+", label: "Estimates modeled" },
            { val: "~$187", label: "Example monthly savings" },
            { val: "A–rated", label: "Installer partners" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontFamily: "var(--font-brand)", fontWeight: 700, fontSize: "1.65rem", color: "var(--corp-blue)" }}>{s.val}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--corp-muted)", fontWeight: 600, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ——— HOW IT WORKS ——— */}
      <section id="how-it-works" style={{ background: "var(--corp-navy)", padding: "clamp(56px, 8vw, 96px) clamp(20px, 5vw, 80px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
              Process
            </div>
            <h2 style={{ fontFamily: "var(--font-brand)", fontSize: "clamp(1.65rem, 3.5vw, 2.35rem)", fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.02em" }}>
              From estimate to permission to operate
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 20 }}>
            {PROCESS_STEPS.map((step) => (
              <div
                key={step.num}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  borderRadius: 10,
                  padding: "24px 22px",
                }}
              >
                <div
                  style={{
                    width: 44, height: 44, borderRadius: 10,
                    border: "1px solid rgba(248,250,252,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: "0.8rem", color: "#e2e8f0", marginBottom: 14,
                  }}
                >
                  {step.num}
                </div>
                <h3 style={{ fontFamily: "var(--font-brand)", fontWeight: 700, fontSize: "1.05rem", color: "#f8fafc", marginBottom: 8 }}>
                  {step.title}
                </h3>
                <p style={{ color: "rgba(226, 232, 240, 0.75)", fontSize: "0.88rem", lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ——— SATELLITE ——— */}
      <section style={{ padding: "clamp(56px, 8vw, 96px) clamp(20px, 5vw, 80px)", background: "white" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 44, alignItems: "center" }}>
            <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--corp-blue)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                Roof & production modeling
              </div>
              <h2 style={{ fontFamily: "var(--font-brand)", fontSize: "clamp(1.55rem, 3.5vw, 2.2rem)", fontWeight: 700, color: "var(--corp-navy)", letterSpacing: "-0.02em", marginBottom: 14 }}>
                Satellite-based layout on your roof — not a cartoon mockup
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: 20 }}>
                We combine imagery and published solar intensity data to approximate roof area, sun hours, and a panel count that matches your bill — before you speak with anyone.
              </p>
              <Bullet>Satellite roof measurement and pitch context</Bullet>
              <Bullet>Annual sunshine hours by coordinates</Bullet>
              <Bullet>Panel count scaled to your usage and local rates</Bullet>
              <Bullet>Transparent assumptions you can review with a specialist</Bullet>
            </div>
            <div>
              <SatelliteRoofDemo />
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: "#0f172a", padding: "clamp(36px, 5vw, 56px) clamp(20px, 5vw, 80px)", textAlign: "center" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--font-brand)", fontSize: "clamp(1.45rem, 3vw, 2rem)", fontWeight: 700, color: "white", marginBottom: 12 }}>
            Example outcome: ~$2,200/year in energy savings
          </h2>
          <p style={{ color: "rgba(226,232,240,0.85)", fontSize: "0.98rem", marginBottom: 24 }}>
            Your result depends on roof, utility rates, and financing. Run the calculator to see your range.
          </p>
          <Link
            href="/funnel"
            style={{
              display: "inline-block",
              background: "white",
              color: "#c2410c",
              fontWeight: 700,
              fontSize: "1rem",
              padding: "14px 28px",
              borderRadius: 4,
              textDecoration: "none",
            }}
          >
            Continue to full estimate →
          </Link>
        </div>
      </section>

      {/* ——— TESTIMONIALS ——— */}
      <section style={{ padding: "clamp(56px, 8vw, 96px) clamp(20px, 5vw, 80px)", background: "var(--surface-page)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--corp-blue)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
              Homeowners
            </div>
            <h2 style={{ fontFamily: "var(--font-brand)", fontSize: "clamp(1.65rem, 3.5vw, 2.35rem)", fontWeight: 700, color: "var(--corp-navy)", letterSpacing: "-0.02em" }}>
              Recent feedback
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                style={{
                  background: "white",
                  borderRadius: 10,
                  padding: "24px 22px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#b45309", letterSpacing: "0.08em", marginBottom: 12 }}>{"★".repeat(t.stars)}</div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.65, marginBottom: 18 }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--corp-navy)", fontSize: "0.9rem" }}>{t.name}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--corp-muted)" }}>{t.location}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#15803d", whiteSpace: "nowrap" }}>{t.savings}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ——— FAQ ——— */}
      <section id="faq" style={{ background: "white", padding: "clamp(56px, 8vw, 96px) clamp(20px, 5vw, 80px)", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontFamily: "var(--font-brand)", fontSize: "clamp(1.65rem, 3.5vw, 2.35rem)", fontWeight: 700, color: "var(--corp-navy)", letterSpacing: "-0.02em" }}>
              Common questions
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((faq) => (
              <details key={faq.q} style={{ background: "var(--surface-page)", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                <summary
                  style={{
                    padding: "18px 20px",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    color: "var(--corp-navy)",
                    cursor: "pointer",
                    listStyle: "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    userSelect: "none",
                    fontFamily: "var(--font-brand)",
                  }}
                >
                  {faq.q}
                  <span style={{ color: "var(--corp-blue)", fontSize: "1.2rem", lineHeight: 1 }}>+</span>
                </summary>
                <div style={{ padding: "0 20px 18px", color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.65 }}>
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ——— FINAL CTA ——— */}
      <section style={{ padding: "clamp(56px, 8vw, 88px) clamp(20px, 5vw, 80px)", textAlign: "center", background: "var(--surface-page)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--font-brand)", fontSize: "clamp(1.65rem, 3.5vw, 2.25rem)", fontWeight: 700, color: "var(--corp-navy)", letterSpacing: "-0.02em", marginBottom: 12 }}>
            Ready for a serious number on your roof?
          </h2>
          <p style={{ color: "var(--corp-muted)", fontSize: "0.98rem", marginBottom: 28, lineHeight: 1.6 }}>
            Same flow used in {ONLINE_ESTIMATES_COUNT}+ estimates since {ONLINE_ESTIMATES_SINCE}. No cartoon promises — just math, incentives, and next steps.
          </p>
          <Link
            href="/funnel"
            style={{
              display: "inline-block",
              background: "#ea580c",
              color: "white",
              fontWeight: 700,
              fontSize: "1rem",
              padding: "16px 36px",
              borderRadius: 4,
              textDecoration: "none",
            }}
          >
            Start free estimate
          </Link>
          <p style={{ marginTop: 14, fontSize: "0.8rem", color: "var(--corp-muted)" }}>Free · No obligation · About one minute</p>
        </div>
      </section>

      {/* ——— FOOTER ——— */}
      <footer style={{ background: "var(--corp-navy)", padding: "36px clamp(20px, 5vw, 80px)", borderTop: "1px solid rgba(148,163,184,0.2)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 24 }}>
          <BrandLogo inverted />
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
              { label: "Contact", href: "/contact" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                style={{ color: "rgba(248,250,252,0.55)", fontSize: "0.82rem", textDecoration: "none", fontWeight: 500 }}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <p style={{ color: "rgba(248,250,252,0.38)", fontSize: "0.75rem", maxWidth: 360, lineHeight: 1.5 }}>
            © {new Date().getFullYear()} SolarAdvisor. Independent service — not affiliated with the U.S. Department of Energy or any government agency.
          </p>
        </div>
      </footer>
    </main>
  );
}
