import Link from "next/link";

const EFFECTIVE_DATE = "March 20, 2026";

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 20px 64px", fontFamily: "var(--font-brand)" }}>
      <h1 style={{ fontSize: "clamp(1.9rem, 4vw, 2.6rem)", marginBottom: 10, color: "#0f172a" }}>Terms of Service</h1>
      <p style={{ color: "#64748b", marginBottom: 28 }}>Effective date: {EFFECTIVE_DATE}</p>

      <p style={{ color: "#334155", lineHeight: 1.7, marginBottom: 18 }}>
        These Terms govern your use of SolarAdvisor websites, forms, and estimate tools. By using our services, you agree to these Terms.
        If you do not agree, do not use the services.
      </p>

      <h2 style={{ marginTop: 30, marginBottom: 10, color: "#0f172a" }}>Service Description</h2>
      <p style={{ color: "#334155", lineHeight: 1.7 }}>
        SolarAdvisor provides informational solar estimates and may connect users with independent installers or service providers.
        We are not the installer, lender, utility company, or government agency.
      </p>

      <h2 style={{ marginTop: 30, marginBottom: 10, color: "#0f172a" }}>Estimate Disclaimer</h2>
      <p style={{ color: "#334155", lineHeight: 1.7 }}>
        Estimates are based on user-provided information, public data, and modeling assumptions. Final pricing, production, incentives,
        and timelines depend on site inspection, utility tariffs, financing approval, equipment availability, and local permitting.
      </p>

      <h2 style={{ marginTop: 30, marginBottom: 10, color: "#0f172a" }}>User Responsibilities</h2>
      <ul style={{ color: "#334155", lineHeight: 1.7, paddingLeft: 20 }}>
        <li>Provide accurate and complete information.</li>
        <li>Use the service only for lawful purposes.</li>
        <li>Do not attempt to disrupt, scrape, or reverse engineer the platform.</li>
      </ul>

      <h2 style={{ marginTop: 30, marginBottom: 10, color: "#0f172a" }}>Communications Consent</h2>
      <p style={{ color: "#334155", lineHeight: 1.7 }}>
        By submitting your information and consent, you authorize SolarAdvisor and participating partners to contact you by phone, SMS,
        or email regarding your estimate and related offers. Message and data rates may apply. You can opt out of SMS by replying
        <strong> STOP</strong>.
      </p>

      <h2 style={{ marginTop: 30, marginBottom: 10, color: "#0f172a" }}>Limitation of Liability</h2>
      <p style={{ color: "#334155", lineHeight: 1.7 }}>
        To the maximum extent permitted by law, SolarAdvisor is not liable for indirect, incidental, consequential, special, or punitive
        damages arising from use of the service. Total liability is limited to amounts paid by you to SolarAdvisor for the service
        in the prior 12 months.
      </p>

      <h2 style={{ marginTop: 30, marginBottom: 10, color: "#0f172a" }}>Changes to Terms</h2>
      <p style={{ color: "#334155", lineHeight: 1.7 }}>
        We may update these Terms from time to time. Continued use after updates means you accept the revised Terms.
      </p>

      <h2 style={{ marginTop: 30, marginBottom: 10, color: "#0f172a" }}>Contact</h2>
      <p style={{ color: "#334155", lineHeight: 1.7, marginBottom: 24 }}>
        Questions about these Terms: <a href="mailto:legal@solaradvisor.com">legal@solaradvisor.com</a>
      </p>

      <Link href="/" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
        ← Back to home
      </Link>
    </main>
  );
}
