import type { Metadata } from "next";
import { ReactNode } from "react";
import { siteUrl } from "@/lib/site/config";
import "./globals.css";

export const metadata: Metadata = {
  // Required so the relative canonicals on the SEO and legal pages resolve to
  // absolute URLs. See @/lib/site/config for why the fallback is localhost.
  metadataBase: new URL(siteUrl()),
  title: "TikTok Shop Profit Calculator",
  description: "Calculate your real TikTok Shop profit after all fees",
  robots: {
    // The calculator and the five fee pages are the product. Nothing here is a
    // draft, so nothing is kept out of the index.
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
