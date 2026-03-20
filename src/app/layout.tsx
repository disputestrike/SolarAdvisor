import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SolarAdvisor — Solar Estimate Platform",
  description: "Get a free personalized solar estimate in about 60 seconds for residential, commercial, and other property types.",
  keywords: "solar panels, solar energy, solar savings, solar estimate, commercial solar, business solar",
  openGraph: {
    title: "SolarAdvisor — Cut Your Electric Bill by Up to 90%",
    description: "Free personalized solar estimate in 60 seconds. No cost, no obligation.",
    type: "website",
    siteName: "SolarAdvisor",
  },
  robots: "index, follow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#FF8C00" />
      </head>
      <body>{children}</body>
    </html>
  );
}
