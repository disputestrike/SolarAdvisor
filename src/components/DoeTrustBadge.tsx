/**
 * Trust context only: we do not display official government seals or imply endorsement.
 * Links to public DOE solar resources for transparency.
 */
export default function DoeTrustBadge() {
  return (
    <a
      href="https://www.energy.gov/eere/solar"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        textDecoration: "none",
        color: "inherit",
        maxWidth: 200,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: 8,
          background: "linear-gradient(145deg, #fff7ed 0%, #ffedd5 100%)",
          border: "1px solid #fdba74",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-hidden
      >
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="5" fill="#ea580c" />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <path
              key={a}
              d="M16 4 L17 9 L16 8 L15 9 Z"
              fill="#c2410c"
              transform={`rotate(${a} 16 16)`}
            />
          ))}
        </svg>
      </div>
      <div style={{ textAlign: "left", lineHeight: 1.25 }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Reference data
        </div>
        <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0f172a" }}>
          U.S. Dept. of Energy solar resources
        </div>
        <div style={{ fontSize: "0.65rem", color: "#64748b", marginTop: 2 }}>
          Independent service ·{" "}
          <span style={{ color: "#2563eb", textDecoration: "underline" }}>energy.gov ↗</span>
        </div>
      </div>
    </a>
  );
}
