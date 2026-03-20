import Link from "next/link";

const EFFECTIVE_DATE = "March 20, 2026";

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 20px 64px", fontFamily: "var(--font-brand)" }}>
      <h1 style={{ fontSize: "clamp(1.9rem, 4vw, 2.6rem)", marginBottom: 10, color: "#0f172a" }}>Privacy Policy</h1>
      <p style={{ color: "#64748b", marginBottom: 28 }}>Effective date: {EFFECTIVE_DATE}</p>

      <p style={{ color: "#334155", lineHeight: 1.7, marginBottom: 18 }}>
        SolarAdvisor respects your privacy. This Privacy Policy explains what information we collect, why we collect it, how we use it,
        and what choices you have when you use our website, estimate tools, and related services.
      </p>

      <h2 style={{ marginTop: 30, marginBottom: 10, color: "#0f172a" }}>Information We Collect</h2>
      <ul style={{ color: "#334155", lineHeight: 1.7, paddingLeft: 20 }}>
        <li>Contact details, including name, email address, and phone number.</li>
        <li>Property and estimate data, including street address, ZIP code, utility provider, and energy bill range.</li>
        <li>Technical usage data, such as browser/device information, pages visited, and referral/UTM parameters.</li>
      </ul>

      <h2 style={{ marginTop: 30, marginBottom: 10, color: "#0f172a" }}>How We Use Information</h2>
      <ul style={{ color: "#334155", lineHeight: 1.7, paddingLeft: 20 }}>
        <li>To provide and improve your solar estimate experience.</li>
        <li>To connect eligible users with solar providers and partners.</li>
        <li>To communicate by email, phone, and SMS when consent is provided.</li>
        <li>To detect abuse, maintain platform security, and comply with law.</li>
      </ul>

      <h2 style={{ marginTop: 30, marginBottom: 10, color: "#0f172a" }}>SMS / Phone Consent</h2>
      <p style={{ color: "#334155", lineHeight: 1.7 }}>
        If you provide consent, SolarAdvisor and partner installers may contact you by call or SMS regarding your estimate.
        Message and data rates may apply. Consent is not a condition of purchase. You can opt out of SMS at any time by replying
        <strong> STOP</strong>.
      </p>

      <h2 style={{ marginTop: 30, marginBottom: 10, color: "#0f172a" }}>Information Sharing</h2>
      <p style={{ color: "#334155", lineHeight: 1.7 }}>
        We share information with service providers and installation partners only as needed to provide estimate services and follow-up.
        We do not sell personal information for unrelated third-party advertising.
      </p>

      <h2 style={{ marginTop: 30, marginBottom: 10, color: "#0f172a" }}>Data Retention</h2>
      <p style={{ color: "#334155", lineHeight: 1.7 }}>
        We retain data for as long as needed to deliver services, resolve disputes, prevent fraud, and comply with legal obligations.
      </p>

      <h2 style={{ marginTop: 30, marginBottom: 10, color: "#0f172a" }}>Your Choices</h2>
      <ul style={{ color: "#334155", lineHeight: 1.7, paddingLeft: 20 }}>
        <li>Request access, correction, or deletion of your personal data.</li>
        <li>Withdraw marketing consent at any time.</li>
        <li>Disable cookies in your browser settings (some features may be limited).</li>
      </ul>

      <h2 style={{ marginTop: 30, marginBottom: 10, color: "#0f172a" }}>Contact</h2>
      <p style={{ color: "#334155", lineHeight: 1.7, marginBottom: 24 }}>
        Privacy requests: <a href="mailto:privacy@solaradvisor.com">privacy@solaradvisor.com</a>
      </p>

      <Link href="/" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
        ← Back to home
      </Link>
    </main>
  );
}
