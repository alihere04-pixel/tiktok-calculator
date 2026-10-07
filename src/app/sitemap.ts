import type { MetadataRoute } from 'next';
import { absoluteUrl, siteUrl, BASE_PATH } from '@/lib/site/config';
import { SEO_MARKETS } from '@/lib/seo/market-pages';
import { LEGAL_SLUGS } from '@/lib/legal/content';
import { getAllBlogPosts } from '@/lib/blog';

/**
 * Sitemap covering every indexable page.
 *
 * The list is derived from the same sources the routes come from
 * (`SEO_MARKETS` and `LEGAL_SLUGS`) rather than typed out, so a new market or a
 * new legal page cannot exist without appearing here. That is the whole reason
 * this is a function and not a JSON file somebody has to remember to update.
 *
 * Priorities are deliberate: the calculator is the product, the fee pages are
 * the organic acquisition, and the legal pages exist to be reachable, not to
 * rank.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const blogPosts = getAllBlogPosts();

  return [
    {
      // No trailing slash: `/tiktok/` answers a 308 redirect to `/tiktok`, and a
      // sitemap URL that never resolves 200 wastes every crawl of the home page.
      url: `${siteUrl()}${BASE_PATH}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...SEO_MARKETS.map((market) => ({
      url: absoluteUrl(`/${market.slug}/tiktok-shop-fees`),
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    {
      url: absoluteUrl('/blog'),
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    ...LEGAL_SLUGS.map((slug) => ({
      url: absoluteUrl(`/${slug}`),
      lastModified,
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    })),
    ...blogPosts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: new Date(post.date),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
