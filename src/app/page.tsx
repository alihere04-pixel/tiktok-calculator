import type { Metadata } from "next";
import HomePage from "@/components/HomePage";

const DESCRIPTION =
  "Free TikTok Shop profit calculator. See your real profit after every platform fee. Supports US, UK, MY, SG, PH markets.";

export const metadata: Metadata = {
  title: "TikTok Shop Profit Calculator (2026)",
  description: DESCRIPTION,
  alternates: { canonical: "/tiktok" },
  openGraph: {
    title: "TikTok Shop Profit Calculator (2026)",
    description: DESCRIPTION,
    url: "https://fynza.store/tiktok",
    siteName: "TikTok Shop Profit Calculator",
    type: "website",
    images: [{ url: "/tiktok/og-blog-default.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TikTok Shop Profit Calculator (2026)",
    description: DESCRIPTION,
    images: ["/tiktok/og-blog-default.png"],
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "TikTok Shop Profit Calculator (2026)",
            url: "https://fynza.store/tiktok",
            description: DESCRIPTION,
            applicationCategory: "FinanceApplication",
          }),
        }}
      />
      <HomePage />
    </>
  );
}
