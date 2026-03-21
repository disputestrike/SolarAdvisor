"use client";

import { useEffect, useRef, useState } from "react";

export interface ResolvedPlace {
  formattedAddress: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  lat: number | null;
  lng: number | null;
  placeId: string;
}

interface PlacesAddressFieldProps {
  apiKey: string | undefined;
  value: string;
  onChangeText: (v: string) => void;
  onResolved: (p: ResolvedPlace | null) => void;
  error?: string;
}

/** Script onload fires before `google.maps.places` is ready — poll until Places exists or timeout. */
function loadMapsPlaces(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject();
    if (window.google?.maps?.places) return resolve();
    const id = "google-maps-places-js";
    const waitForPlaces = () => {
      let n = 0;
      const max = 400;
      const t = window.setInterval(() => {
        if (window.google?.maps?.places) {
          window.clearInterval(t);
          resolve();
        } else if (++n >= max) {
          window.clearInterval(t);
          reject(new Error("Google Maps Places API did not become ready in time"));
        }
      }, 50);
    };
    if (document.getElementById(id)) {
      waitForPlaces();
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    s.onload = () => waitForPlaces();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

function parsePlace(place: google.maps.places.PlaceResult): ResolvedPlace | null {
  if (!place.geometry?.location || !place.address_components) return null;
  const comps = place.address_components;
  let streetNum = "";
  let route = "";
  let city = "";
  let state = "";
  let zip = "";

  for (const c of comps) {
    if (c.types.includes("street_number")) streetNum = c.long_name;
    if (c.types.includes("route")) route = c.long_name;
    if (c.types.includes("locality")) city = c.long_name;
    if (c.types.includes("administrative_area_level_1")) state = c.short_name;
    if (c.types.includes("postal_code")) zip = c.long_name;
  }

  if (!zip || zip.length < 5) return null;

  const streetAddress = [streetNum, route].filter(Boolean).join(" ").trim() || (place.name ?? "");
  const lat = place.geometry.location.lat();
  const lng = place.geometry.location.lng();
  const formatted = place.formatted_address ?? place.name ?? "";
  const placeId = place.place_id ?? "";

  if (!formatted || !placeId) return null;

  return {
    formattedAddress: formatted,
    streetAddress,
    city: city || "",
    state: state || "",
    zipCode: zip.slice(0, 5),
    lat,
    lng,
    placeId,
  };
}

/**
 * Google Places Autocomplete — user must pick a suggestion (validates like reference flows).
 */
export default function PlacesAddressField({
  apiKey,
  value,
  onChangeText,
  onResolved,
  error,
}: PlacesAddressFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const onResolvedRef = useRef(onResolved);
  const onChangeTextRef = useRef(onChangeText);
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState(false);

  onResolvedRef.current = onResolved;
  onChangeTextRef.current = onChangeText;

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;
    let cancelled = false;
    loadMapsPlaces(apiKey)
      .then(() => {
        if (cancelled || !inputRef.current) return;
        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          componentRestrictions: { country: "us" },
          fields: ["address_components", "formatted_address", "geometry", "name", "place_id"],
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          const r = parsePlace(place);
          onResolvedRef.current(r);
          if (r) onChangeTextRef.current(r.formattedAddress);
        });
        acRef.current = ac;
        setReady(true);
      })
      .catch(() => setLoadErr(true));
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontWeight: 700, fontSize: "0.8rem", color: "#0f172a", marginBottom: 8 }}>
        Street address
      </label>
      <input
        ref={inputRef}
        type="text"
        autoComplete="street-address"
        placeholder={loadErr || !apiKey ? "Enter full address (add Google Maps key for autocomplete)" : "Start typing your address…"}
        value={value}
        onChange={(e) => {
          onChangeText(e.target.value);
          onResolved(null);
        }}
        style={{
          width: "100%",
          padding: "14px 16px",
          fontSize: "1rem",
          border: error ? "2px solid #dc2626" : "2px solid #e2e8f0",
          borderRadius: 6,
          outline: "none",
          fontFamily: "var(--font-brand)",
          background: "white",
        }}
      />
      <p style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 6 }}>
        {ready
          ? "Select an address from the dropdown so we can locate your roof."
          : apiKey
            ? "Loading address search…"
            : "Configure NEXT_PUBLIC_GOOGLE_MAPS_KEY for address autocomplete."}
      </p>
      {(error || loadErr) && (
        <p style={{ color: "#dc2626", fontSize: "0.82rem", marginTop: 8 }}>{error || "Could not load Google Maps."}</p>
      )}
    </div>
  );
}
