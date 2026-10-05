import { describe, it, expect, afterEach, vi } from 'vitest';
import sitemap from './sitemap';
import robots from './robots';
import { SEO_MARKETS } from '@/lib/seo/market-pages';
import { LEGAL_SLUGS } from '@/lib/legal/content';
import { getAllBlogPosts } from '@/lib/blog';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('sitemap', () => {
  it('lists the home page, every market fee page and every legal page', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fees.example.com');
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://fees.example.com/');
    for (const market of SEO_MARKETS) {
      expect(urls).toContain(`https://fees.example.com/${market.slug}/tiktok-shop-fees`);
    }
    for (const slug of LEGAL_SLUGS) {
      expect(urls).toContain(`https://fees.example.com/${slug}`);
    }
  });

  it('derives its entries from the route sources, so nothing can drift', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fees.example.com');
    const blogPosts = getAllBlogPosts();
    // 1 home + 5 markets + 3 legal + blog posts.
    expect(sitemap()).toHaveLength(1 + SEO_MARKETS.length + LEGAL_SLUGS.length + blogPosts.length);
  });

  it('emits no duplicate URLs', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fees.example.com');
    const urls = sitemap().map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('emits no URL with a double slash', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fees.example.com/');
    for (const entry of sitemap()) {
      expect(entry.url).not.toContain('.com//');
    }
  });

  it('ranks the calculator above the fee pages and the fee pages above legal', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fees.example.com');
    const byUrl = Object.fromEntries(sitemap().map((e) => [e.url, e.priority]));
    expect(byUrl['https://fees.example.com/']).toBe(1);
    expect(byUrl['https://fees.example.com/us/tiktok-shop-fees']).toBe(0.8);
    expect(byUrl['https://fees.example.com/privacy']).toBe(0.2);
  });

  it('gives every entry a lastModified and a changeFrequency', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fees.example.com');
    for (const entry of sitemap()) {
      expect(entry.lastModified).toBeInstanceOf(Date);
      expect(entry.changeFrequency).toBeTruthy();
    }
  });
});

describe('robots', () => {
  it('allows crawling and blocks only build assets', () => {
    const rules = robots().rules as { userAgent: string; allow: string; disallow: string }[];
    expect(rules).toHaveLength(1);
    expect(rules[0].userAgent).toBe('*');
    expect(rules[0].allow).toBe('/');
    expect(rules[0].disallow).toBe('/_next/static/');
  });

  it('does not block the calculator or the fee pages', () => {
    const rules = robots().rules as { disallow: string }[];
    expect(rules[0].disallow).not.toBe('/');
    expect(rules[0].disallow).not.toContain('tiktok-shop-fees');
  });

  it('advertises the sitemap once the real domain is known', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fees.example.com');
    expect(robots().sitemap).toBe('https://fees.example.com/sitemap.xml');
  });

  it('omits the sitemap rather than advertising localhost', () => {
    // Advertising localhost to a crawler is worse than saying nothing.
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(robots().sitemap).toBeUndefined();
  });
});
