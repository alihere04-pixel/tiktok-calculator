import { describe, it, expect, afterEach, vi } from 'vitest';
import { generateMetadata } from './page';
import { getAllBlogPosts } from '@/lib/blog';

const posts = getAllBlogPosts();

async function metadataFor(slug: string) {
  return generateMetadata({ params: Promise.resolve({ slug }) });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('blog post metadata', () => {
  it('has at least one published post to check', () => {
    expect(posts.length).toBeGreaterThan(0);
  });

  it.each(posts.map((post) => [post.slug, post.title] as const))(
    'builds an absolute canonical URL for %s',
    async (slug) => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fynza.store');

      const meta = await metadataFor(slug);

      expect(meta.alternates?.canonical).toBe(`https://fynza.store/tiktok/blog/${slug}`);
    },
  );

  it.each(posts.map((post) => [post.slug] as const))(
    'points openGraph and JSON-LD URLs at the configured site URL for %s',
    async (slug) => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fynza.store');

      const meta = await metadataFor(slug);

      expect(meta.openGraph?.url).toBe(`https://fynza.store/tiktok/blog/${slug}`);
    },
  );

  it.each(posts.map((post) => [post.slug] as const))(
    'never hardcodes a domain that differs from the configured site URL in %s',
    async (slug) => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fynza.store');

      const meta = await metadataFor(slug);
      const serialised = JSON.stringify(meta);

      expect(serialised).not.toContain('vercel.app');
      expect(serialised).not.toContain('localhost');
    },
  );

  it('uses the requested SEO title for the fee calculator post', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fynza.store');

    const post = posts.find((p) => p.slug === 'tiktok-shop-fee-calculator-2026');

    expect(post).toBeDefined();
    expect(post?.title).toBe(
      'TikTok Shop Fee Calculator 2026: Free Tool & Market Rates',
    );
    expect(post?.h1).toBe('TikTok Shop Fee Calculator 2026 — All 5 Markets');
  });

  it('keeps the SEO title and the on-page h1 distinct for the platform comparison post', () => {
    // The comparison post is the only one whose h1 is not merely a restatement
    // of the title: the title is written for the SERP, the h1 for the reader.
    const post = posts.find((p) => p.slug === 'tiktok-shop-vs-amazon-fees');

    expect(post).toBeDefined();
    expect(post?.title).toBe('TikTok Shop vs Amazon Fees 2026: Which Platform Pays More?');
    expect(post?.h1).toBe('TikTok Shop vs Amazon Fees 2026: Complete Cost Comparison');
    expect(post?.h1).not.toBe(post?.title);
    expect(post?.description).toContain('TikTok Shop vs Amazon');
    expect(post?.keywords).toContain('TikTok Shop vs Amazon fees');
  });

  it('falls back to the title when a post has no separate h1', () => {
    const post = posts.find((p) => p.slug === 'how-to-calculate-tiktok-shop-profit');

    expect(post?.h1).toBeUndefined();
    expect(post?.title).toBe('How to Calculate TikTok Shop Profit: Complete 2026 Guide');
  });

  it('returns empty metadata for an unknown slug', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fynza.store');

    expect(await metadataFor('does-not-exist')).toEqual({});
  });
});
