import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SponsorLinks } from './SponsorLinks';

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.doUnmock('@/lib/seo/sponsor-links');
});

const REAL_URL = 'https://seller.tiktok.com/';
const AFF_URL = 'https://partner.example/tiktok?aff=us123';

async function renderWithEnabledLinks(
  links: { id: string; label: string; url: string; description: string; affiliate: boolean }[]
) {
  vi.doMock('@/lib/seo/sponsor-links', () => ({
    SPONSOR_LINKS_ENABLED: true,
    activeSponsorLinks: () => links.filter((l) => l.url.trim() !== ''),
  }));
  const { SponsorLinks: Enabled } = await import('./SponsorLinks');
  return render(<Enabled />);
}

describe('SponsorLinks in its shipped state', () => {
  it('renders nothing while the programme is disabled', () => {
    const { container } = render(<SponsorLinks />);
    expect(container.innerHTML).toBe('');
  });

  it('shows no link at all, so no visitor can click an unconfigured URL', () => {
    render(<SponsorLinks />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});

describe('SponsorLinks once real URLs are supplied', () => {
  it('renders each link', async () => {
    await renderWithEnabledLinks([
      { id: 'a', label: 'Open Seller Center', url: REAL_URL, description: 'Where rates live.', affiliate: false },
    ]);
    expect(screen.getByRole('link', { name: /Open Seller Center/ })).toBeTruthy();
  });

  it('uses rel="sponsored noopener noreferrer"', async () => {
    // All three tokens matter: `sponsored` declares the paid placement,
    // `noopener` blocks window.opener access, `noreferrer` withholds the
    // referrer. Dropping `sponsored` is a manual-action risk on a paid link.
    await renderWithEnabledLinks([
      { id: 'a', label: 'Open Seller Center', url: REAL_URL, description: 'Where rates live.', affiliate: true },
    ]);
    const link = screen.getByRole('link', { name: /Open Seller Center/ });
    const rel = link.getAttribute('rel') ?? '';
    expect(rel).toContain('sponsored');
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('opens in a new tab', async () => {
    await renderWithEnabledLinks([
      { id: 'a', label: 'Open Seller Center', url: REAL_URL, description: 'Where rates live.', affiliate: true },
    ]);
    expect(screen.getByRole('link', { name: /Open Seller Center/ }).getAttribute('target')).toBe('_blank');
  });

  it('discloses the affiliate relationship in visible text, not a tooltip', async () => {
    // A disclosure in an aria-label or title attribute is not a disclosure.
    const { container } = await renderWithEnabledLinks([
      { id: 'a', label: 'Open Seller Center', url: AFF_URL, description: 'Where rates live.', affiliate: true },
    ]);
    expect(screen.getByText(/We may earn a commission/)).toBeTruthy();
    expect(screen.getByText(/Affiliate link\./)).toBeTruthy();
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('says the link does not change what the visitor pays', async () => {
    await renderWithEnabledLinks([
      { id: 'a', label: 'Open Seller Center', url: AFF_URL, description: 'Where rates live.', affiliate: true },
    ]);
    expect(screen.getByText(/does not change what you pay/)).toBeTruthy();
  });

  it('omits the affiliate notice when no link is an affiliate link', async () => {
    await renderWithEnabledLinks([
      { id: 'a', label: 'Open Seller Center', url: REAL_URL, description: 'Where rates live.', affiliate: false },
    ]);
    expect(screen.queryByText(/We may earn a commission/)).toBeNull();
    expect(screen.queryByText(/Affiliate link\./)).toBeNull();
  });

  it('never renders a link with a blank href', async () => {
    await renderWithEnabledLinks([
      { id: 'a', label: 'Good', url: REAL_URL, description: 'Real link.', affiliate: false },
      { id: 'b', label: 'Broken', url: '   ', description: 'No URL yet.', affiliate: true },
    ]);
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')?.trim()).not.toBe('');
    }
    expect(screen.queryByText('Broken')).toBeNull();
  });

  it('names the destination host for screen readers', async () => {
    await renderWithEnabledLinks([
      { id: 'a', label: 'Open Seller Center', url: REAL_URL, description: 'Where rates live.', affiliate: false },
    ]);
    expect(screen.getByText(/opens .* in a new tab/)).toBeTruthy();
  });

  it('hides the arrow from assistive technology', async () => {
    const { container } = await renderWithEnabledLinks([
      { id: 'a', label: 'Open Seller Center', url: REAL_URL, description: 'Where rates live.', affiliate: false },
    ]);
    const arrow = [...container.querySelectorAll('span')].find((s) => s.textContent === '\u2197');
    expect(arrow?.getAttribute('aria-hidden')).toBe('true');
  });

  it('labels the section for assistive technology', async () => {
    await renderWithEnabledLinks([
      { id: 'a', label: 'Open Seller Center', url: REAL_URL, description: 'Where rates live.', affiliate: false },
    ]);
    expect(screen.getByRole('region', { name: 'Next steps' })).toBeTruthy();
  });

  it('renders as a server component, so links are in the static HTML', async () => {
    // The sponsor module is deliberately not "use client", which is what puts
    // the links in the pre-rendered HTML instead of behind hydration.
    await renderWithEnabledLinks([
      { id: 'a', label: 'Open Seller Center', url: REAL_URL, description: 'Where rates live.', affiliate: false },
    ]);
    const link = screen.getByRole('link', { name: /Open Seller Center/ });
    expect(link.getAttribute('href')).toBe(REAL_URL);
  });
});
