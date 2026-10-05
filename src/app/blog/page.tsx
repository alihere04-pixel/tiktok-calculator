import type { Metadata } from "next";
import Link from "next/link";
import { getAllBlogPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Fynza Blog - TikTok Shop Seller Guides & Fee Analysis",
  description:
    "Expert guides on TikTok Shop fees, profit calculation, and seller strategies. Learn to maximize your margins with our free calculator and market-specific fee data.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Fynza Blog - TikTok Shop Seller Guides & Fee Analysis",
    description:
      "Expert guides on TikTok Shop fees, profit calculation, and seller strategies.",
    url: "/blog",
    siteName: "TikTok Shop Profit Calculator",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Fynza Blog - TikTok Shop Seller Guides & Fee Analysis",
    description:
      "Expert guides on TikTok Shop fees, profit calculation, and seller strategies.",
  },
};

export default function BlogIndex() {
  const posts = getAllBlogPosts();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-semibold text-zinc-900 sm:text-3xl dark:text-zinc-50">
            Fynza Blog
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Expert guides on TikTok Shop fees, profit calculation, and seller strategies.
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8 sm:px-6">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-600 dark:text-zinc-400">
              No blog posts yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <time
                  dateTime={post.date}
                  className="text-xs text-zinc-500 dark:text-zinc-400"
                >
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-2 block hover:underline"
                >
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                    {post.title}
                  </h2>
                </Link>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {post.description}
                </p>
              </article>
            ))}
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed dark:focus-visible:ring-zinc-50 dark:focus-visible:ring-offset-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 active:bg-zinc-800 h-12 px-6 text-base"
          >
            Open the Profit Calculator
          </Link>
        </div>
      </main>
    </div>
  );
}