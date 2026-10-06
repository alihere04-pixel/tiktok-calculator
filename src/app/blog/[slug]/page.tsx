import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPostBySlug, getBlogPostSlugs } from "@/lib/blog";
import { markdownToHtml } from "@/lib/blog/markdown";
import { siteUrl } from "@/lib/site/config";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = getBlogPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {};
  }

  const baseUrl = siteUrl();
  const postUrl = `${baseUrl}/tiktok/blog/${slug}`;

  return {
    title: `${post.title} - TikTok Shop Profit Calculator`,
    description: post.description,
    alternates: { canonical: postUrl },
    openGraph: {
      title: post.title,
      description: post.description,
      url: postUrl,
      siteName: "TikTok Shop Profit Calculator",
      type: "article",
      publishedTime: post.date,
      tags: post.keywords,
      images: post.ogImage
        ? [{ url: `${baseUrl}/tiktok${post.ogImage}` }]
        : [{ url: `${baseUrl}/tiktok/og-blog-default.png` }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: post.ogImage
        ? [`${baseUrl}/tiktok${post.ogImage}`]
        : [`${baseUrl}/tiktok/og-blog-default.png`],
    },
    other: {
      "article:published_time": post.date,
      "article:tag": post.keywords?.join(", ") || "",
    },
  };
}

function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const baseUrl = siteUrl();
  const postUrl = `${baseUrl}/tiktok/blog/${slug}`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: postUrl,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Organization",
      name: "Fynza",
      url: baseUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "TikTok Shop Profit Calculator",
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/tiktok/favicon.ico`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
    keywords: post.keywords?.join(", "),
  };

  const htmlContent = await markdownToHtml(post.content);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <JsonLd data={articleSchema} />

      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm">
            <ol className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <li>
                <Link href="/" className="hover:underline">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/blog" className="hover:underline">
                  Blog
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-zinc-900 dark:text-zinc-100">
                {post.title}
              </li>
            </ol>
          </nav>

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

          <h1 className="mt-3 text-2xl font-semibold text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {post.h1 ?? post.title}
          </h1>

          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {post.description}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <article className="prose prose-zinc dark:prose-invert max-w-none">
          <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </article>

        <div className="mt-10 pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed dark:focus-visible:ring-zinc-50 dark:focus-visible:ring-offset-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 active:bg-zinc-800 h-12 px-6 text-base"
          >
            Calculate Your Profit Now
          </Link>
        </div>
      </main>
    </div>
  );
}