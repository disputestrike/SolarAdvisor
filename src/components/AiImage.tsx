"use client";

import { useState, useEffect, useCallback } from "react";

interface AiImageProps {
  type: string;
  alt: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  className?: string;
  priority?: boolean;
}

// Photo-realistic CSS fallback scenes when AI API not configured
const FALLBACK_SCENES: Record<string, { gradient: string; scene: string }> = {
  hero_family: {
    gradient: "linear-gradient(180deg, #87CEEB 0%, #98D5F0 30%, #4CAF50 70%, #388E3C 100%)",
    scene: "🏠☀️",
  },
  hero_home_panels: {
    gradient: "linear-gradient(180deg, #1565C0 0%, #1976D2 40%, #8B7355 70%, #6D4C2A 100%)",
    scene: "🏡⚡",
  },
  roof_overlay: {
    gradient: "linear-gradient(180deg, #0D47A1 0%, #1565C0 50%, #5D4037 100%)",
    scene: "☀️🔲",
  },
  savings_couple: {
    gradient: "linear-gradient(135deg, #FFF8E1 0%, #FFF3E0 50%, #FFECB3 100%)",
    scene: "💰😊",
  },
  installer_working: {
    gradient: "linear-gradient(180deg, #64B5F6 0%, #42A5F5 40%, #8B7355 70%, #5D4037 100%)",
    scene: "👷⚡",
  },
  neighborhood_solar: {
    gradient: "linear-gradient(180deg, #29B6F6 0%, #81C784 40%, #66BB6A 100%)",
    scene: "🏘️☀️",
  },
  testimonial_home: {
    gradient: "linear-gradient(180deg, #FFA726 0%, #FFB74D 30%, #81C784 60%, #66BB6A 100%)",
    scene: "🏠💚",
  },
};

export default function AiImage({
  type,
  alt,
  width = 800,
  height = 500,
  style = {},
  priority = false,
}: AiImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchImage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/images?type=${type}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.image) {
        setSrc(data.image);
      }
    } catch {
      /* fallback UI when !src */
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    if (!priority) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            void fetchImage();
            observer.disconnect();
          }
        },
        { rootMargin: "200px" }
      );
      const el = document.getElementById(`ai-img-${type}`);
      if (el) observer.observe(el);
      return () => observer.disconnect();
    }
    void fetchImage();
  }, [type, priority, fetchImage]);

  const fallback = FALLBACK_SCENES[type] || FALLBACK_SCENES.hero_home_panels;

  // Render real AI image
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          ...style,
        }}
      />
    );
  }

  // Loading shimmer
  if (loading) {
    return (
      <div
        id={`ai-img-${type}`}
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(90deg, #f0e6cc 25%, #ffe4a0 50%, #f0e6cc 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          borderRadius: style.borderRadius || 0,
          ...style,
        }}
      >
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
        `}</style>
      </div>
    );
  }

  // Fallback: photorealistic CSS scene
  return (
    <div
      id={`ai-img-${type}`}
      style={{
        width: "100%",
        height: "100%",
        background: fallback.gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Sky/ground details */}
      {type.includes("home") || type.includes("hero") || type.includes("neighborhood") || type.includes("testimonial") ? (
        <>
          {/* Sun */}
          <div style={{
            position: "absolute", top: "8%", right: "15%",
            width: 80, height: 80, borderRadius: "50%",
            background: "radial-gradient(circle, #FFF9C4, #FFD700, #FFA000)",
            boxShadow: "0 0 40px rgba(255,215,0,0.8), 0 0 80px rgba(255,165,0,0.4)",
          }} />
          {/* Clouds */}
          <div style={{ position: "absolute", top: "15%", left: "10%", opacity: 0.9 }}>
            <div style={{ width: 100, height: 30, background: "white", borderRadius: 20, position: "relative" }}>
              <div style={{ position: "absolute", top: -15, left: 20, width: 50, height: 30, background: "white", borderRadius: "50%" }} />
              <div style={{ position: "absolute", top: -10, left: 45, width: 40, height: 25, background: "white", borderRadius: "50%" }} />
            </div>
          </div>
          {/* House silhouette */}
          <div style={{ position: "absolute", bottom: "30%", left: "50%", transform: "translateX(-50%)" }}>
            {/* Roof */}
            <div style={{
              width: 0, height: 0,
              borderLeft: "90px solid transparent",
              borderRight: "90px solid transparent",
              borderBottom: "60px solid #8B6914",
              position: "relative", zIndex: 2,
            }}>
              {/* Solar panels on roof */}
              <div style={{
                position: "absolute", top: 15, left: -50,
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2,
              }}>
                {Array(8).fill(0).map((_, i) => (
                  <div key={i} style={{
                    width: 20, height: 12,
                    background: "#1A237E",
                    border: "0.5px solid #4FC3F7",
                    borderRadius: 1,
                  }} />
                ))}
              </div>
            </div>
            {/* House body */}
            <div style={{
              width: 160, height: 80,
              background: "#D7CCC8",
              border: "2px solid #BCAAA4",
              position: "relative", zIndex: 1,
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              paddingBottom: 0,
            }}>
              {/* Door */}
              <div style={{ width: 28, height: 44, background: "#795548", borderRadius: "4px 4px 0 0", marginBottom: 0 }} />
              {/* Windows */}
              <div style={{ position: "absolute", top: 16, left: 18, width: 28, height: 28, background: "#B3E5FC", border: "2px solid #795548" }} />
              <div style={{ position: "absolute", top: 16, right: 18, width: 28, height: 28, background: "#B3E5FC", border: "2px solid #795548" }} />
            </div>
          </div>
          {/* Lawn */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            height: "30%", background: "linear-gradient(180deg, #66BB6A, #388E3C)",
          }} />
          {/* Trees */}
          {[10, 82].map((left, i) => (
            <div key={i} style={{ position: "absolute", bottom: "28%", left: `${left}%` }}>
              <div style={{ width: 0, height: 0, borderLeft: "20px solid transparent", borderRight: "20px solid transparent", borderBottom: "50px solid #2E7D32", margin: "0 auto" }} />
              <div style={{ width: 8, height: 20, background: "#5D4037", margin: "0 auto" }} />
            </div>
          ))}
          {/* Alt text overlay */}
          <div style={{
            position: "absolute", bottom: "32%", left: "50%", transform: "translateX(-150%)",
            background: "rgba(0,0,0,0.6)", color: "white", fontSize: "0.65rem",
            padding: "3px 8px", borderRadius: 4, fontFamily: "var(--font-body)",
            whiteSpace: "nowrap",
          }}>
            🔄 AI image — configure API key
          </div>
        </>
      ) : (
        <div style={{ fontSize: 64, textAlign: "center" }}>
          {fallback.scene}
        </div>
      )}
    </div>
  );
}
