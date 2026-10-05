"use client";

import { ReactNode } from "react";
import "./globals.css";
import { AnalyticsGate } from "@/components/analytics/AnalyticsGate";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";
import { Footer } from "@/components/layout/Footer";

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <title>TikTok Shop Profit Calculator</title>
        <meta name="description" content="Calculate your real TikTok Shop profit after all fees" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://tiktok-shop-calculator.vercel.app" />
      </head>
      <body className="min-h-full flex flex-col">
        <ConsentBanner />
        {children}
        <Footer />
        <AnalyticsGate />
      </body>
    </html>
  );
}