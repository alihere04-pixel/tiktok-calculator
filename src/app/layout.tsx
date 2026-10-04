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
        <ConsentBanner />
        {children}
        <Footer />
        <AnalyticsGate />
      </body>
    </html>
  );
}