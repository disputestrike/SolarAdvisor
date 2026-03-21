import type { Metadata } from "next";
// Self-hosted via fontsource — no network fetch at build time
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/900.css";
import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/source-sans-3/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "SolarAdvisor — Solar Estimate Platform",
  description:
    "Get a free personalized solar estimate in about 60 seconds for residential, commercial, and other property types.",
  keywords:
    "solar panels, solar energy, solar savings, solar estimate, commercial solar, business solar",
  openGraph: {
    title: "SolarAdvisor — Cut Your Electric Bill by Up to 90%",
    description: "Free personalized solar estimate in 60 seconds. No cost, no obligation.",
    type: "website",
    siteName: "SolarAdvisor",
  },
  twitter: {
    card: "summary_large_image",
    title: "SolarAdvisor — Free Solar Estimate",
    description: "See how much you can save with home solar.",
  },
  robots: "index, follow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#FF8C00" />
      </head>
      <body>{children}</body>
    </html>
  );
}
