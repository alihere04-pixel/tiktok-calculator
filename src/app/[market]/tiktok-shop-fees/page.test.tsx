import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import MarketFeesPage, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from './page';
import { SEO_SLUGS } from '@/lib/seo/market-pages';

afterEach(cleanup);

async function renderPage(slug: string) {
  const element = await MarketFeesPage({ params: Promise.resolve({ market: slug }) });
  return render(element);
}

describe('SSG contract', () => {
  it('prerenders exactly the five SEO pages', () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(5);
    expect(params.map((p) => p.market)).toEqual(['us', 'uk', 'my', 'sg', 'ph']);
    expect(SEO_SLUGS).toEqual(params.map((p) => p.market));
  });

  it('rejects any other slug, so no extra route can be generated', () => {
    // Without this, an unknown slug would be rendered on demand and the route
    // count would not be bounded at five.
    expect(dynamicParams).toBe(false);
  });
});

describe('generateMetadata', () => {
  it('produces a title, description, canonical and Open Graph for each market', async () => {
    for (const slug of SEO_SLUGS) {
      const meta = await generateMetadata({ params: Promise.resolve({ market: slug }) });

      expect(meta.title).toMatch(/TikTok Shop .* Seller Fees \(2026\)/);
      expect(String(meta.description).length).toBeGreaterThan(50);
      expect(String(meta.description).length).toBeLessThanOrEqual(165);
      expect(meta.alternates?.canonical).toBe(`/tiktok/${slug}/tiktok-shop-fees`);
      expect(meta.openGraph?.title).toBeTruthy();
      expect(meta.openGraph?.description).toBe(meta.description);
      // `Metadata['twitter']` is a union, so the card field is narrowed here
      // rather than assumed.
      expect((meta.twitter as { card?: string } | undefined)?.card).toBe('summary');
    }
  });

  it('gives each market a distinct title', async () => {
    const titles = await Promise.all(
      SEO_SLUGS.map(async (slug) => (await generateMetadata({ params: Promise.resolve({ market: slug }) })).title)
    );
    expect(new Set(titles).size).toBe(5);
  });

  it('returns empty metadata for an unknown slug rather than throwing', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ market: 'de' }) });
    expect(meta).toEqual({});
  });
});

describe.each(SEO_SLUGS)('%s page', (slug) => {
  it('renders the H1 the PRD asks for', async () => {
    await renderPage(slug);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
      /TikTok Shop Seller Fees \(2026\)$/
    );
  });

  it('renders all eight required sections as level-2 headings', async () => {
    await renderPage(slug);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

    expect(headings).toEqual(
      expect.arrayContaining([
        'Category commission rates',
        'Transaction fees',
        'Fixed and per-order fees',
        'Category exceptions',
        'New seller promotions',
        'Affiliate commission guide',
        'Estimate fees for your price',
        'Frequently asked questions',
      ])
    );
  });

  it('renders a category rate table with a caption', async () => {
    await renderPage(slug);
    expect(screen.getByText(/Commission rate by category, in/)).toBeTruthy();
  });

  it('shows the refund administration section only on the US page', async () => {
    await renderPage(slug);
    const present = screen.queryByRole('heading', { name: 'Refund administration fees' }) !== null;
    expect(present).toBe(slug === 'us');
  });

  it('embeds the mini fee estimator', async () => {
    await renderPage(slug);
    expect(screen.getByLabelText(/Selling price/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Estimate platform fees/ })).toBeTruthy();
  });

  it('renders the FAQ with native disclosure widgets', async () => {
    const { container } = await renderPage(slug);
    expect(container.querySelectorAll('details').length).toBeGreaterThanOrEqual(5);
  });

  it('shows the last verified date', async () => {
    await renderPage(slug);
    const lastVerified: Record<string, string> = {
      us: 'September 26, 2026',
      uk: 'October 8, 2026',
      my: 'September 26, 2026',
      sg: 'October 7, 2026',
      ph: 'September 26, 2026',
    };
    expect(screen.getAllByText(lastVerified[slug]).length).toBeGreaterThan(0);
  });

  it('links back to the main calculator', async () => {
    await renderPage(slug);
    const links = screen.getAllByRole('link', { name: /profit calculator/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((l) => l.getAttribute('href') === '/')).toBe(true);
  });

  it('offers a Seller Center verification link', async () => {
    await renderPage(slug);
    const cta = screen.getAllByRole('link', { name: /Verify in TikTok Seller Center/ });
    expect(cta.length).toBeGreaterThan(0);
    for (const link of cta) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\/seller-[a-z]+\.tiktok\.com/);
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('emits FAQPage and WebPage JSON-LD', async () => {
    const { container } = await renderPage(slug);
    const blocks = Array.from(container.querySelectorAll('script[type="application/ld+json"]'));

    expect(blocks).toHaveLength(2);
    const parsed = blocks.map((b) => JSON.parse(b.textContent ?? '{}'));
    expect(parsed.map((p) => p['@type']).sort()).toEqual(['FAQPage', 'WebPage']);
  });

  it('never emits an unescaped script terminator inside JSON-LD', async () => {
    const { container } = await renderPage(slug);
    for (const block of Array.from(container.querySelectorAll('script[type="application/ld+json"]'))) {
      expect(block.textContent).not.toContain('</');
      expect(block.textContent).not.toContain('<');
    }
  });
});

describe('US page specifics', () => {
  it('discloses the refund administration fee instead of inventing one', async () => {
    await renderPage('us');
    const section = screen
      .getByRole('heading', { name: 'Refund administration fees' })
      .closest('section');
    expect(section).not.toBeNull();
    const text = section?.textContent ?? '';
    expect(text).toContain('Not in our verified dataset');
    expect(text).toMatch(/refund administration fee rate is not in our verified dataset/i);
    // No fabricated percentage in the disclosure.
    expect(text).not.toMatch(/\d+(\.\d+)?%\s*refund/i);
  });

  it('lists the $10K tiered threshold exceptions', async () => {
    await renderPage('us');
    expect(screen.getAllByText('Any portion of the sale over $10K, 3%').length).toBeGreaterThan(0);
  });
});

describe('UK page specifics', () => {
  it('shows the real new seller promotional rate', async () => {
    await renderPage('uk');
    expect(screen.getByText('Promotional rate:')).toBeTruthy();
  });

  it('excludes the promotional zero rate from the headline range', async () => {
    await renderPage('uk');
    // The note appears both above the table and as the first FAQ answer, which
    // is the same string by construction.
    expect(screen.getAllByText(/excludes the promotional rate/).length).toBeGreaterThan(0);
  });

  it('offers a category search box above the table', async () => {
    await renderPage('uk');
    expect(screen.getByPlaceholderText('Search categories...')).toBeTruthy();
  });

  it('shows the £0.50 self-ship fee in the fixed and per-order fees section', async () => {
    await renderPage('uk');
    const table = screen.getByText(/Fixed and per-order fees in GBP/);
    const section = table.closest('section');
    expect(section?.textContent).toContain('£0.50 per order');
    expect(section?.textContent).not.toContain('Not in our verified dataset');
    expect(section?.textContent).toContain('Applies to self-shipped orders. Since July 15, 2025.');
  });

  it('keeps all 347 rows in the HTML, so search engines and no-JS readers see them', async () => {
    const { container } = await renderPage('uk');

    // 4 policy records + 343 Excel rows. Nothing is filtered at build time.
    const rows = container.querySelectorAll('tr[data-search]');
    expect(rows).toHaveLength(347);
    // Not one row starts hidden, so a reader without JavaScript sees the lot.
    expect(Array.from(rows).every((row) => !row.hasAttribute('hidden'))).toBe(true);
  });

  it('labels each UK row with its parent category, since sub-category names repeat', async () => {
    await renderPage('uk');

    // UK lists 116 sub-categories under Beauty & Personal Care, so a bare name
    // like "Curlers & Straighteners" does not identify a category on its own.
    const row = screen.getByRole('row', { name: /Curlers & Straighteners/ });
    expect(row.textContent).toContain('Beauty & Personal Care');
  });
});

describe('the category search box is UK only', () => {
  it('is absent on the four markets whose tables are short enough to scan', async () => {
    for (const slug of SEO_SLUGS.filter((s) => s !== 'uk')) {
      cleanup();
      await renderPage(slug);
      expect(screen.queryByPlaceholderText('Search categories...')).toBeNull();
    }
  });

  it('leaves the other market tables free of the parent-category label', async () => {
    for (const slug of ['us', 'my', 'sg', 'ph']) {
      cleanup();
      const { container } = await renderPage(slug);
      // The attribute still exists so the markup is uniform, but no row gains a
      // second line it did not have before.
      const rows = container.querySelectorAll('tr[data-search]');
      expect(rows.length).toBeGreaterThan(0);
      expect(Array.from(rows).every((row) => !row.hasAttribute('hidden'))).toBe(true);
    }
  });
});

describe('MY page specifics', () => {
  it('shows the per-order support fee as an amount, not a percentage', async () => {
    await renderPage('my');
    const table = screen.getByText(/Fixed and per-order fees in MYR/);
    const section = table.closest('section');
    expect(section?.textContent).toContain('RM 0.54 per order');
    expect(section?.textContent).not.toContain('54%');
  });

  it('shows the dynamic commission range and per-item cap', async () => {
    await renderPage('my');
    expect(screen.getByText('4.00% - 6.00%')).toBeTruthy();
    expect(screen.getByText('Capped at RM 650,000.00 per item')).toBeTruthy();
  });
});

describe('affiliate section on every page', () => {
  it('explains the three models and quotes no percentage', async () => {
    for (const slug of SEO_SLUGS) {
      cleanup();
      await renderPage(slug);
      const section = screen
        .getByRole('heading', { name: 'Affiliate commission guide' })
        .closest('section');
      const text = section?.textContent ?? '';

      expect(text).toContain('Open collaboration');
      expect(text).toContain('Targeted collaboration');
      expect(text).toContain('Shop Ads');
      expect(text).toContain('Not in our verified dataset');
      // No rate file populates affiliate, so no percentage may appear here.
      expect(text).not.toMatch(/\d+(\.\d+)?%/);
    }
  });
});
