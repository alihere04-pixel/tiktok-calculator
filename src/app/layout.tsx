import type { Metadata } from "next";
import { ReactNode } from "react";
import { siteUrl } from "@/lib/site/config";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Footer } from "@/components/layout/Footer";
import { monitoringConfig } from "@/lib/monitoring/config";
import { useAnalyticsConsent } from "@/hooks/useAnalyticsConsent";
import { ConsentBanner } from "@/components/analytics/ConsentBanner";

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
  const consentAccepted = useAnalyticsConsent();
  const analyticsEnabled = monitoringConfig().analytics.enabled;

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Footer />
        {consentAccepted && analyticsEnabled ? (
          <Analytics />
        ) : null}
        {!localStorage.getItem('analytics_consent') && (
          <ConsentBanner />
        )}
      </body>
    </html>
  );
}