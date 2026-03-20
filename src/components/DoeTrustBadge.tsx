import Image from "next/image";

/**
 * U.S. Department of Energy seal (public domain) — links to energy.gov solar.
 * SolarAdvisor remains independent; this is reference / attribution only.
 */
const DOE_SEAL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Seal_of_the_United_States_Department_of_Energy.svg/80px-Seal_of_the_United_States_Department_of_Energy.svg.png";

export default function DoeTrustBadge() {
  return (
    <a
      href="https://www.energy.gov/eere/solar"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        textDecoration: "none",
        color: "inherit",
        maxWidth: 240,
      }}
    >
      <Image
        src={DOE_SEAL}
        alt="U.S. Department of Energy seal"
        width={48}
        height={48}
        unoptimized
        style={{ flexShrink: 0, opacity: 0.95 }}
      />
      <div style={{ textAlign: "left", lineHeight: 1.25 }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Public data & methods
        </div>
        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0f172a" }}>
          U.S. Department of Energy — Solar
        </div>
        <div style={{ fontSize: "0.65rem", color: "#64748b", marginTop: 2 }}>
          SolarAdvisor is independent ·{" "}
          <span style={{ color: "#2563eb", textDecoration: "underline" }}>energy.gov ↗</span>
        </div>
      </div>
    </a>
  );
}
