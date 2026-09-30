import type { Metadata } from "next";
import { ReactNode } from "react";
import { siteUrl } from "@/lib/site/config";
import "./globals.css";
import { AnalyticsGate } from "@/components/analytics/AnalyticsGate";
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
        {children}
        <Footer />
        <AnalyticsGate />
      </body>
    </html>
  );
}