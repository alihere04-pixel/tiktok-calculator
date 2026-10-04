import type { Metadata } from "next";
import { ReactNode } from "react";
import { siteUrl } from "@/lib/site/config";
import "./globals.css";
import { AnalyticsGate } from "@/components/analytics/AnalyticsGate";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "TikTok Shop Profit Calculator",
  description: "Calculate your real TikTok Shop profit after all fees",
  robots: {
    index: true,
    follow: true,
  },
};

const analyticsConfig = {
  provider: process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? 'none',
  domain: process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN ?? '',
  consentGate: process.env.NEXT_PUBLIC_CONSENT_GATE ?? 'false',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* First in the body so the consent question is reached early in the tab
            order. Renders nothing unless analytics is configured, and asks
            nothing until it is. */}
        <ConsentBanner config={analyticsConfig} />
        {children}
        <Footer />
        <AnalyticsGate config={analyticsConfig} />
      </body>
    </html>
  );
}