const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "../src/app/funnel/page.tsx");
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf("function StepQualify(");
const end = s.indexOf("function StepEstimate(");
if (start < 0 || end < 0) {
  console.error("markers not found");
  process.exit(1);
}

const newFn = `function StepProperty({ data, update, onNext, onBack }: { data: FormData; update: (k: keyof FormData, v: string | boolean | number | null) => void; onNext: () => void; onBack: () => void }) {
  const [error, setError] = useState("");

  if (data.isHomeowner === false) {
    return (
      <div>
        <h2 style={{ fontFamily: "var(--font-brand)", fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>
          Thanks for your interest
        </h2>
        <p style={{ color: "#475569", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 24 }}>
          SolarAdvisor connects <strong>property owners</strong> with vetted solar specialists. If you are not the owner or authorized decision-maker for this property, we cannot continue this estimate.
        </p>
        <Link href="/" style={{ display: "inline-block", color: "#2563eb", fontWeight: 600 }}>
          ← Back to home
        </Link>
      </div>
    );
  }

  const handleNext = () => {
    if (data.isHomeowner === null) {
      setError("Please indicate whether you own this property.");
      return;
    }
    setError("");
    onNext();
  };

  const btn = (active: boolean) => ({
    padding: "14px 12px",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: "0.88rem",
    border: active ? "2px solid #ea580c" : "2px solid #e2e8f0",
    background: active ? "#fff7ed" : "white",
    color: active ? "#c2410c" : "#475569",
    cursor: "pointer",
    textAlign: "center",
  });

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-brand)", fontSize: "clamp(1.35rem, 3.5vw, 1.85rem)", fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
        Property details
      </h2>
      <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: 22, lineHeight: 1.55 }}>
        Eligibility and roof context for <strong>{data.formattedAddress || "your property"}</strong>.
      </p>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 10 }}>
          Do you own this property or have authority to install solar?
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button type="button" onClick={() => { update("isHomeowner", true); setError(""); }} style={btn(data.isHomeowner === true)}>
            Yes
          </button>
          <button type="button" onClick={() => { update("isHomeowner", false); setError(""); }} style={btn(data.isHomeowner === false)}>
            No
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 10 }}>
          Building type
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button type="button" onClick={() => update("buildingType", "residential")} style={btn(data.buildingType === "residential")}>
            Residential
          </button>
          <button type="button" onClick={() => update("buildingType", "commercial")} style={btn(data.buildingType === "commercial")}>
            Commercial
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 10 }}>
          Stories (optional)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button type="button" onClick={() => update("stories", "one")} style={btn(data.stories === "one")}>
            One story
          </button>
          <button type="button" onClick={() => update("stories", "two_plus")} style={btn(data.stories === "two_plus")}>
            Two or more
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 10 }}>
          Roof pitch (optional)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {ROOF_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => update("roofSlope", opt.value)} style={btn(data.roofSlope === opt.value)}>
              <div>{opt.label}</div>
              <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 500 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 10 }}>
          Mid-day shading (optional)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          {SHADE_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => update("shadingLevel", opt.value)} style={btn(data.shadingLevel === opt.value)}>
              <div>{opt.label}</div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 500 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "flex", gap: 12 }}>
        <button type="button" onClick={onBack} style={{ flex: "0 0 auto", padding: "14px 20px", background: "white", border: "2px solid #e2e8f0", borderRadius: 6, fontWeight: 600, cursor: "pointer", color: "#64748b" }}>
          ← Back
        </button>
        <button type="button" onClick={handleNext} style={{ flex: 1, padding: "16px", background: "#ea580c", color: "white", fontWeight: 700, fontSize: "1rem", borderRadius: 6, border: "none", cursor: "pointer" }}>
          Next →
        </button>
      </div>
    </div>
  );
}

`;

s = s.slice(0, start) + newFn + s.slice(end);
fs.writeFileSync(p, s);
console.log("patched");
