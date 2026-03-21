"use client";

import type { ResolvedPlace } from "./PlacesAddressField";

interface Props {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  update: (k: "streetAddress" | "city" | "state" | "zipCode" | "addressInput", v: string) => void;
  /** When user chose manual entry but Maps is available — shorter copy */
  variant?: "no_maps_key" | "manual_choice";
}

/** When Google Places is unavailable — full address for roof / lead record. */
export function buildManualResolved(p: {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
}): ResolvedPlace | null {
  const z = p.zipCode.replace(/\D/g, "").slice(0, 5);
  const street = p.streetAddress.trim();
  const city = p.city.trim();
  const state = p.state.trim().toUpperCase().slice(0, 2);
  if (!street || !city || state.length !== 2 || z.length !== 5) return null;
  const formatted = `${street}, ${city}, ${state} ${z}`;
  /** Stable id for the same address — avoids new UUID every effect run (fewer churn / clearer lead keys). */
  const key = `${street}|${city}|${state}|${z}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  const placeId = `manual_${Math.abs(h).toString(16)}`;
  return {
    formattedAddress: formatted,
    streetAddress: street,
    city,
    state,
    zipCode: z,
    lat: null,
    lng: null,
    placeId,
  };
}

export default function ManualAddressFields({ streetAddress, city, state, zipCode, update, variant = "no_maps_key" }: Props) {
  const zipDigits = zipCode.replace(/\D/g, "").slice(0, 5);

  const intro =
    variant === "manual_choice"
      ? "Enter your property address below — we need street, city, state, and ZIP for your estimate."
      : "Google address search is not configured on this deployment. Enter your property address below — we still need street, city, state, and ZIP to estimate solar for your roof.";

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: 14, lineHeight: 1.55 }}>
        {intro}
      </p>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 8 }}>Street address</label>
        <input
          type="text"
          value={streetAddress}
          placeholder="e.g. 3945 Connecticut Ave NW, APT 110"
          onChange={(e) => update("streetAddress", e.target.value)}
          style={{
            width: "100%",
            padding: "14px 16px",
            fontSize: "1rem",
            border: "2px solid #e2e8f0",
            borderRadius: 6,
            outline: "none",
            fontFamily: "var(--font-brand)",
            background: "white",
          }}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 8 }}>City</label>
          <input
            type="text"
            value={city}
            placeholder="Washington"
            onChange={(e) => update("city", e.target.value)}
            style={{
              width: "100%",
              padding: "14px 16px",
              fontSize: "1rem",
              border: "2px solid #e2e8f0",
              borderRadius: 6,
              outline: "none",
              fontFamily: "var(--font-brand)",
              background: "white",
            }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 8 }}>State</label>
          <input
            type="text"
            value={state}
            placeholder="DC"
            maxLength={2}
            onChange={(e) => update("state", e.target.value.toUpperCase().replace(/[^A-Za-z]/g, "").slice(0, 2))}
            style={{
              width: "100%",
              padding: "14px 16px",
              fontSize: "1rem",
              border: "2px solid #e2e8f0",
              borderRadius: 6,
              outline: "none",
              fontFamily: "var(--font-brand)",
              background: "white",
            }}
          />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 8 }}>ZIP code</label>
        <input
          type="text"
          inputMode="numeric"
          value={zipDigits}
          placeholder="20008"
          maxLength={5}
          onChange={(e) => update("zipCode", e.target.value.replace(/\D/g, "").slice(0, 5))}
          style={{
            width: "100%",
            padding: "14px 16px",
            fontSize: "1rem",
            border: "2px solid #e2e8f0",
            borderRadius: 6,
            outline: "none",
            fontFamily: "var(--font-brand)",
            background: "white",
          }}
        />
      </div>
    </div>
  );
}
