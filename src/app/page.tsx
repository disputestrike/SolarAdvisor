import Link from "next/link";
import dynamic from "next/dynamic";

const LiveChat = dynamic(() => import("@/components/LiveChat"), { ssr: false });
const AiImage = dynamic(() => import("@/components/AiImage"), { ssr: false });
const SatelliteRoofDemo = dynamic(() => import("@/components/SatelliteRoofDemo"), { ssr: false });

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
  { num: "01", title: "Free Estimate", desc: "Get your personalized savings analysis in 60 seconds — no obligation." },
  { num: "02", title: "Site Assessment", desc: "An expert evaluates your roof, shading, and energy usage on-site or virtually." },
  { num: "03", title: "Custom Proposal", desc: "Receive a tailored proposal with all financing options and incentives applied." },
  { num: "04", title: "Professional Install", desc: "Certified installers complete your system in 1–3 days with zero disruption." },
  { num: "05", title: "Inspection & PTO", desc: "We handle all permits, inspections, and utility Permission to Operate." },
  { num: "06", title: "Start Saving", desc: "Monitor your production and savings in real-time. We're here for life." },
];

export default function HomePage() {
  return (
    <main style={{ background: "var(--sun-bg)", minHeight: "100vh", fontFamily: "var(--font-body)" }}>
      {/* ─── NAV ─── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,251,242,0.92)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 clamp(16px,4vw,48px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 68,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>☀</span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "1.25rem", color: "var(--earth-dark)", letterSpacing: "-0.02em" }}>SolarAdvisor</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="#how-it-works" style={{ color: "var(--text-secondary)", fontWeight: 500, fontSize: "0.9rem", textDecoration: "none" }}>How It Works</a>
          <a href="#faq" style={{ color: "var(--text-secondary)", fontWeight: 500, fontSize: "0.9rem", textDecoration: "none" }}>FAQ</a>
          <Link href="/funnel" style={{
            background: "linear-gradient(135deg, var(--sun-core), var(--sun-glow))",
            color: "white", fontWeight: 700, fontSize: "0.875rem",
            padding: "10px 22px", borderRadius: "999px",
            textDecoration: "none", boxShadow: "0 4px 14px rgba(255,140,0,0.3)",
            transition: "all 0.2s ease",
          }}>Get Free Estimate</Link>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{
        position: "relative", overflow: "hidden",
        padding: "clamp(60px,10vw,140px) clamp(20px,5vw,80px)",
        maxWidth: 1200, margin: "0 auto",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60,
        alignItems: "center",
      }}>
        {/* Background orbs */}
        <div style={{
          position: "absolute", top: -100, right: -100,
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,215,0,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -50, left: -80,
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,140,0,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Left: Copy */}
        <div style={{ animation: "sunRise 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>
          {/* Trust badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
            {["✓ 30% Federal Tax Credit", "✓ $0-Down Options", "✓ 25-Year Warranty"].map(b => (
              <span key={b} style={{
                background: "var(--white)", border: "1px solid var(--border)",
                borderRadius: "999px", padding: "5px 14px",
                fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}>{b}</span>
            ))}
          </div>

          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 900,
            fontSize: "clamp(2.4rem, 5vw, 4.2rem)", lineHeight: 1.05,
            letterSpacing: "-0.03em", color: "var(--earth-dark)", marginBottom: 20,
          }}>
            See How Much Solar<br />
            <span style={{
              background: "linear-gradient(135deg, var(--sun-core), var(--sun-glow))",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Saves You Today</span>
          </h1>

          <p style={{ fontSize: "1.15rem", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 36, maxWidth: 460 }}>
            Get a free, personalized estimate in 60 seconds. No sales pressure. See your $0-down options, tax credits, and real monthly savings.
          </p>

          <Link href="/funnel" style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "linear-gradient(135deg, #FF8C00, #FFD700)",
            color: "white", fontWeight: 700, fontSize: "1.1rem",
            padding: "18px 40px", borderRadius: "999px", textDecoration: "none",
            boxShadow: "0 6px 30px rgba(255,140,0,0.45)",
            transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            Get My Free Solar Estimate
            <span style={{ fontSize: 20 }}>→</span>
          </Link>

          <p style={{ marginTop: 14, fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Free · No obligation · Takes 60 seconds
          </p>

          {/* Social proof numbers */}
          <div style={{ display: "flex", gap: 32, marginTop: 40, paddingTop: 32, borderTop: "1px solid var(--border)" }}>
            {[
              { val: "14,800+", label: "Homeowners Helped" },
              { val: "$187", label: "Avg Monthly Savings" },
              { val: "4.9★", label: "Customer Rating" },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "1.6rem", color: "var(--sun-core)" }}>{s.val}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: AI Photo-Realistic Image */}
        <div style={{ animation: "sunRise 0.8s 0.1s cubic-bezier(0.34,1.56,0.64,1) both", position: "relative" }}>
          {/* Main hero image */}
          <div style={{
            borderRadius: 24, overflow: "hidden",
            boxShadow: "0 24px 80px rgba(255,140,0,0.2), 0 4px 24px rgba(0,0,0,0.1)",
            border: "1px solid var(--border)",
            aspectRatio: "4/3",
            position: "relative",
          }}>
            <AiImage
              type="hero_home_panels"
              alt="Beautiful home with solar panels installed"
              priority
              style={{ borderRadius: 24 }}
            />
            {/* Overlay stats badge */}
            <div style={{
              position: "absolute", bottom: 16, left: 16,
              background: "rgba(255,251,242,0.95)", backdropFilter: "blur(8px)",
              borderRadius: 14, padding: "12px 18px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              border: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", gap: 20 }}>
                {[
                  { val: "~$187", label: "Monthly savings", color: "var(--leaf-green)" },
                  { val: "30%", label: "Federal credit", color: "var(--sun-core)" },
                  { val: "$0", label: "Down options", color: "var(--sky-blue)" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "1.3rem", color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Secondary image — happy homeowners */}
          <div style={{
            position: "absolute", bottom: -20, right: -20,
            width: "45%", aspectRatio: "1/1",
            borderRadius: 16, overflow: "hidden",
            border: "3px solid var(--white)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          }}>
            <AiImage
              type="savings_couple"
              alt="Happy homeowners reviewing solar savings"
            />
          </div>
        </div>
      </section>

      {/* Live Chat Widget — rendered on all pages */}
      <LiveChat />

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" style={{
        background: "var(--earth-dark)", padding: "clamp(60px,8vw,100px) clamp(20px,5vw,80px)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--sun-glow)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>
              THE PROCESS
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900, color: "var(--white)", letterSpacing: "-0.02em" }}>
              From Estimate to Energy Freedom
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            {PROCESS_STEPS.map((step) => (
              <div key={step.num} style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,215,0,0.15)",
                borderRadius: 20, padding: "28px 24px",
                transition: "all 0.3s ease",
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: "linear-gradient(135deg, var(--sun-core), var(--sun-glow))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: "0.9rem", color: "white", marginBottom: 16,
                  boxShadow: "0 4px 16px rgba(255,140,0,0.3)",
                }}>
                  {step.num}
                </div>
                <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.2rem", color: "var(--white)", marginBottom: 8 }}>
                  {step.title}
                </h3>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SATELLITE ROOF SHOWCASE ─── */}
      <section style={{ padding: "clamp(60px,8vw,100px) clamp(20px,5vw,80px)", background: "var(--white)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--sun-core)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>
                SATELLITE ROOF ANALYSIS
              </div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 900, color: "var(--earth-dark)", letterSpacing: "-0.02em", marginBottom: 16 }}>
                We Visualize Solar on Your Actual Roof
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.7, marginBottom: 24 }}>
                Using satellite imagery and Google&apos;s Solar API, we map your exact roof dimensions, calculate sun exposure, and overlay a custom panel layout — before you ever talk to anyone.
              </p>
              {[
                { icon: "🛰️", text: "Satellite roof measurement — exact square footage" },
                { icon: "☀️", text: "Annual sunshine hours calculated for your coordinates" },
                { icon: "🔲", text: "Panel layout optimized for your roof pitch and shading" },
                { icon: "💰", text: "Savings estimate based on your real local utility rates" },
              ].map(item => (
                <div key={item.text} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.5 }}>{item.text}</span>
                </div>
              ))}
            </div>
            {/* Live satellite demo */}
            <div>
              <SatelliteRoofDemo />
            </div>
          </div>
        </div>
      </section>
      <section style={{
        background: "linear-gradient(135deg, var(--sun-core) 0%, var(--sun-glow) 100%)",
        padding: "clamp(40px,6vw,70px) clamp(20px,5vw,80px)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 900, color: "white", marginBottom: 14 }}>
            The Average Homeowner Saves $2,240/Year
          </h2>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.1rem", marginBottom: 28 }}>
            Find out your exact number in 60 seconds — free, no obligation.
          </p>
          <Link href="/funnel" style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "white", color: "var(--sun-core)",
            fontWeight: 800, fontSize: "1.05rem",
            padding: "16px 36px", borderRadius: "999px", textDecoration: "none",
            boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
          }}>
            Calculate My Savings — Free →
          </Link>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section style={{ padding: "clamp(60px,8vw,100px) clamp(20px,5vw,80px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--sun-core)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12 }}>
              REAL RESULTS
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900, color: "var(--earth-dark)", letterSpacing: "-0.02em" }}>
              Homeowners Who Made the Switch
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 24 }}>
            {TESTIMONIALS.map((t) => (
              <div key={t.name} style={{
                background: "var(--white)", borderRadius: 20, padding: "28px 24px",
                border: "1px solid var(--border)", boxShadow: "var(--shadow-warm)",
                transition: "all 0.25s ease",
              }}>
                <div style={{ display: "flex", gap: 2, marginBottom: 14 }}>
                  {Array(t.stars).fill("★").map((s, i) => (
                    <span key={i} style={{ color: "var(--sun-glow)", fontSize: "1.1rem" }}>{s}</span>
                  ))}
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.65, marginBottom: 20, fontStyle: "italic" }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--earth-dark)", fontSize: "0.95rem" }}>{t.name}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{t.location}</div>
                  </div>
                  <div style={{
                    background: "var(--leaf-light)", color: "var(--leaf-green)",
                    fontWeight: 800, fontSize: "1rem", padding: "6px 12px",
                    borderRadius: "999px",
                  }}>
                    {t.savings}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" style={{
        background: "var(--surface)", padding: "clamp(60px,8vw,100px) clamp(20px,5vw,80px)",
        borderTop: "1px solid var(--border)",
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900, color: "var(--earth-dark)", letterSpacing: "-0.02em" }}>
              Common Questions
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FAQS.map((faq) => (
              <details key={faq.q} style={{
                background: "var(--white)", border: "1px solid var(--border)",
                borderRadius: 16, overflow: "hidden",
              }}>
                <summary style={{
                  padding: "20px 24px", fontWeight: 600, fontSize: "1rem",
                  color: "var(--earth-dark)", cursor: "pointer",
                  listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center",
                  userSelect: "none",
                }}>
                  {faq.q}
                  <span style={{ color: "var(--sun-core)", fontSize: "1.4rem", lineHeight: 1 }}>+</span>
                </summary>
                <div style={{ padding: "0 24px 20px", color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.7 }}>
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section style={{
        padding: "clamp(60px,8vw,100px) clamp(20px,5vw,80px)",
        textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,215,0,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative", maxWidth: 620, margin: "0 auto" }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>☀️</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 900, color: "var(--earth-dark)", letterSpacing: "-0.02em", marginBottom: 16 }}>
            Your Lower Electric Bill<br />Starts Today
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem", marginBottom: 36 }}>
            Join 14,800+ homeowners who got their free estimate and discovered how much they could save.
          </p>
          <Link href="/funnel" style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "linear-gradient(135deg, var(--sun-core), var(--sun-glow))",
            color: "white", fontWeight: 800, fontSize: "1.1rem",
            padding: "18px 44px", borderRadius: "999px", textDecoration: "none",
            boxShadow: "0 8px 36px rgba(255,140,0,0.45)",
          }}>
            Get My Free Estimate Now →
          </Link>
          <p style={{ marginTop: 14, fontSize: "0.82rem", color: "var(--text-muted)" }}>Free · No obligation · 60 seconds</p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{
        background: "var(--earth-dark)", padding: "40px clamp(20px,5vw,80px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>☀</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "1.1rem", color: "white" }}>SolarAdvisor</span>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            {["Privacy Policy", "Terms of Service", "Contact Us"].map(l => (
              <a key={l} href="#" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", textDecoration: "none" }}>{l}</a>
            ))}
          </div>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.78rem" }}>
            © 2024 SolarAdvisor. Not affiliated with any government agency.
          </p>
        </div>
      </footer>
    </main>
  );
}
