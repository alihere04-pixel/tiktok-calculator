import type { Metadata } from "next";
import Link from "next/link";

const DESCRIPTION =
  "The page you're looking for doesn't exist. Try the TikTok Shop Profit Calculator or the blog instead.";

export const metadata: Metadata = {
  title: "404 — TikTok Shop Calculator",
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  alternates: { canonical: "/tiktok" },
  openGraph: {
    title: "404 — TikTok Shop Calculator",
    description: DESCRIPTION,
    url: "https://fynza.store/tiktok",
    siteName: "TikTok Shop Profit Calculator",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "404 — TikTok Shop Calculator",
    description: DESCRIPTION,
  },
};

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-20 text-center">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "404 — Page Not Found",
            url: "https://fynza.store/tiktok",
            description: "Page not found",
          }),
        }}
      />
      <h1 className="text-4xl font-bold text-gray-900">404 — Page not found</h1>
      <p className="mt-4 max-w-md text-gray-600">
        {"The page you're looking for doesn't exist."}
      </p>
      <nav className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="rounded-lg bg-orange-600 px-5 py-2.5 font-medium text-white hover:bg-orange-700"
        >
          TikTok Calculator
        </Link>
        <Link
          href="/blog"
          className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-900 hover:bg-gray-100"
        >
          Blog
        </Link>
        <Link
          href="https://fynza.store"
          className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-900 hover:bg-gray-100"
        >
          Main site
        </Link>
      </nav>
    </main>
  );
}
