import Link from "next/link";

interface BrandLogoProps {
  inverted?: boolean;
  size?: "default" | "sm";
}

/** Wordmark + geometric mark — no emoji; intended for a credible, installer-adjacent look. */
export default function BrandLogo({ inverted = false, size = "default" }: BrandLogoProps) {
  const text = inverted ? "#f8fafc" : "#0f172a";
  const sub = inverted ? "rgba(248,250,252,0.65)" : "#64748b";
  const sun = "#ea580c";
  const h = size === "sm" ? 32 : 38;

  return (
    <Link
      href="/"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        textDecoration: "none",
        color: text,
      }}
    >
      <svg width={h} height={h} viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r="7.5" fill={sun} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <rect
            key={deg}
            x="19"
            y="2"
            width="2"
            height="7"
            rx="1"
            fill={sun}
            opacity={0.95}
            transform={`rotate(${deg} 20 20)`}
          />
        ))}
      </svg>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
        <span
          style={{
            fontFamily: "var(--font-brand)", fontWeight: 700,
            fontSize: size === "sm" ? "1.05rem" : "1.2rem", letterSpacing: "-0.03em",
          }}
        >
          SolarAdvisor
        </span>
        <span style={{ fontSize: size === "sm" ? "0.62rem" : "0.65rem", color: sub, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Solar estimates
        </span>
      </span>
    </Link>
  );
}
