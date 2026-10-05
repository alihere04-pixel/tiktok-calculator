import { describe, it, expect, afterEach, vi } from 'vitest';
import { generateMetadata } from './page';

const SLUG = 'how-to-calculate-tiktok-shop-profit';

async function metadataFor(slug: string) {
  return generateMetadata({ params: Promise.resolve({ slug }) });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('blog post metadata', () => {
  it('builds an absolute canonical URL from the configured site URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fynza.store');

    const meta = await metadataFor(SLUG);

    expect(meta.alternates?.canonical).toBe(`https://fynza.store/blog/${SLUG}`);
  });

  it('points openGraph and JSON-LD URLs at the configured site URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fynza.store');

    const meta = await metadataFor(SLUG);

    expect(meta.openGraph?.url).toBe(`https://fynza.store/blog/${SLUG}`);
  });

  it('never hardcodes a domain that differs from the configured site URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fynza.store');

    const meta = await metadataFor(SLUG);
    const serialised = JSON.stringify(meta);

    expect(serialised).not.toContain('vercel.app');
    expect(serialised).not.toContain('localhost');
  });

  it('returns empty metadata for an unknown slug', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://fynza.store');

    expect(await metadataFor('does-not-exist')).toEqual({});
  });
});