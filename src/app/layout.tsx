import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AnalyticsGate } from "@/components/analytics/AnalyticsGate";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";
import { Footer } from "@/components/layout/Footer";
import { siteUrl } from "@/lib/site/config";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "TikTok Shop Profit Calculator",
  description: "Calculate your real TikTok Shop profit after all fees",
  robots: "index, follow",
  alternates: { canonical: "/tiktok" },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ConsentBanner />
        {children}
        <Footer />
        <AnalyticsGate />
      </body>
    </html>
  );
}