import Link from "next/link";

export default function ContactPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 20px 64px", fontFamily: "var(--font-brand)" }}>
      <h1 style={{ fontSize: "clamp(1.9rem, 4vw, 2.6rem)", marginBottom: 10, color: "#0f172a" }}>Contact</h1>
      <p style={{ color: "#64748b", marginBottom: 28 }}>
        Questions about your estimate, legal policies, or data requests? Reach us below.
      </p>

      <section style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ marginBottom: 10, color: "#0f172a" }}>General Support</h2>
        <p style={{ color: "#334155", lineHeight: 1.7, margin: 0 }}>
          Email: <a href="mailto:support@solaradvisor.com">support@solaradvisor.com</a>
          <br />
          Phone: <a href="tel:+18005550199">+1 (800) 555-0199</a>
          <br />
          Hours: Monday-Friday, 9:00 AM-6:00 PM (local time)
        </p>
      </section>

      <section style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ marginBottom: 10, color: "#0f172a" }}>Privacy / Data Requests</h2>
        <p style={{ color: "#334155", lineHeight: 1.7, margin: 0 }}>
          Email: <a href="mailto:privacy@solaradvisor.com">privacy@solaradvisor.com</a>
        </p>
      </section>

      <section style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 26 }}>
        <h2 style={{ marginBottom: 10, color: "#0f172a" }}>Legal</h2>
        <p style={{ color: "#334155", lineHeight: 1.7, margin: 0 }}>
          Email: <a href="mailto:legal@solaradvisor.com">legal@solaradvisor.com</a>
        </p>
      </section>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link href="/privacy" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
          Privacy Policy
        </Link>
        <Link href="/terms" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
          Terms of Service
        </Link>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link href="/" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
