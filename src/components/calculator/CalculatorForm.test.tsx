import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CalculatorForm } from './CalculatorForm';
import type { MarketRateSummary } from '@/hooks/useCalculator';
import type { Market } from '@/hooks/useCalculator';

afterEach(cleanup);

function summary(market: Market, tiers: Array<string | undefined>): MarketRateSummary {
  return {
    market,
    currency: market === 'US' ? 'USD' : market === 'PH' ? 'PHP' : market === 'SG' ? 'SGD' : market === 'MY' ? 'MYR' : 'GBP',
    categories: tiers.map((tier, i) => ({
      id: `${market.toLowerCase()}-cat-${i}`,
      name: `${market} Category ${i}`,
      parentCategory: `${market} Group`,
      tier,
      rate: 0.06,
    })),
  };
}

const RATES: Partial<Record<Market, MarketRateSummary>> = {
  US: summary('US', [undefined, undefined]),
  PH: summary('PH', ['Marketplace']),
  SG: summary('SG', ['Standard', 'BXP']),
  MY: summary('MY', ['BXP Marketplace', 'BXP Mall']),
  UK: summary('UK', [undefined]),
};

describe('CalculatorForm', () => {
  it('renders all seven collapsible sections', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    for (const title of [
      'Market & product',
      'Discounts & shipping',
      'Costs',
      'Affiliate & marketing',
      'Promotions',
      'Fulfillment',
      'Programs & promotions',
    ]) {
      expect(screen.getByText(title)).toBeDefined();
    }
  });

  it('renders each section header as a collapsed-capable button with aria-expanded', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    const button = screen.getByRole('button', { name: /Market & product/ });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBeTruthy();
  });

  it('shows the US return rate field by default (US is the initial market)', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    expect(screen.getByText('Return / refund rate')).toBeDefined();
  });

  it('hides the seller tier selector for US (single-tier markets only)', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    expect(screen.queryByText('Seller tier')).toBeNull();
  });

  it('renders no results panel before Calculate Profit is clicked', () => {
    const { container } = render(<CalculatorForm ratesByMarket={RATES} />);
    expect(container.textContent).not.toContain('Net profit');
    expect(container.textContent).not.toContain('Total platform fees');
  });
});
