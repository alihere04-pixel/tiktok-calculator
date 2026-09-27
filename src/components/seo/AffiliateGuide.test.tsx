import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AffiliateGuide } from './AffiliateGuide';
import type { SectionData, AffiliateSection } from '@/lib/seo/market-pages';

afterEach(cleanup);

const URL = 'https://seller-us.tiktok.com/university/essay?knowledge_id=1';

const UNVERIFIED: SectionData<AffiliateSection> = {
  status: 'unverified',
  reason: 'We do not have verified affiliate commission rates for this market.',
  guidance: 'Commission is set per creator agreement.',
};

const AVAILABLE: SectionData<AffiliateSection> = {
  status: 'available',
  data: {
    marketName: 'US',
    config: {
      openCollabRange: [0.1, 0.3],
      targetedCollabRange: [0.15, 0.5],
      shopAdsMinRatio: 0.02,
      decreaseProtectionDays: 7,
      sourceUrl: URL,
    },
  },
};

describe('AffiliateGuide', () => {
  it('explains all three collaboration models', () => {
    render(<AffiliateGuide section={UNVERIFIED} sourceUrl={URL} />);
    expect(screen.getByText('Open collaboration')).toBeTruthy();
    expect(screen.getByText('Targeted collaboration')).toBeTruthy();
    expect(screen.getByText('Shop Ads')).toBeTruthy();
  });

  it('pairs each model with its definition in a description list', () => {
    const { container } = render(<AffiliateGuide section={UNVERIFIED} sourceUrl={URL} />);
    expect(container.querySelectorAll('dt')).toHaveLength(3);
    expect(container.querySelectorAll('dd')).toHaveLength(3);
  });

  it('shows the disclosure card and the official link when unverified', () => {
    render(<AffiliateGuide section={UNVERIFIED} sourceUrl={URL} />);
    expect(screen.getByText('Not in our verified dataset')).toBeTruthy();
    expect(
      screen.getByText('We do not have verified affiliate commission rates for this market.')
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: /Verify in TikTok Seller Center/ }).getAttribute('href')).toBe(URL);
  });

  it('prints no percentage at all when unverified', () => {
    // The rate files carry no affiliate rates, so any percentage on this page
    // would be one we made up.
    const { container } = render(<AffiliateGuide section={UNVERIFIED} sourceUrl={URL} />);
    expect(container.textContent).not.toMatch(/\d+(\.\d+)?%/);
  });

  it('states plainly that the guide is not a rate table', () => {
    render(<AffiliateGuide section={UNVERIFIED} sourceUrl={URL} />);
    expect(screen.getByText(/This is a structural guide, not a rate table/)).toBeTruthy();
  });

  it('renders real numbers instead of the card once a rate file supplies them', () => {
    render(<AffiliateGuide section={AVAILABLE} sourceUrl={URL} />);
    expect(screen.queryByText('Not in our verified dataset')).toBeNull();
    expect(screen.getByText('10% - 30%')).toBeTruthy();
    expect(screen.getByText('15% - 50%')).toBeTruthy();
    expect(screen.getByText('2%')).toBeTruthy();
    expect(screen.getByText('7 days')).toBeTruthy();
  });

  it('links the official affiliate source when data is available', () => {
    render(<AffiliateGuide section={AVAILABLE} sourceUrl={URL} />);
    const link = screen.getByRole('link', { name: /Official source/ });
    expect(link.getAttribute('href')).toBe(URL);
  });
});
