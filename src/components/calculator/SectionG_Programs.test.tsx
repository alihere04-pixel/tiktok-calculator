import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CalculatorForm } from './CalculatorForm';
import { SectionG_Programs } from './SectionG_Programs';
import { MARKET_CAPABILITIES, createDefaultInputs } from '@/hooks/useCalculator';
import type { UseCalculatorReturn } from '@/hooks/useCalculator';
import type { Market, MarketRateSummary } from '@/hooks/useCalculator';

afterEach(cleanup);

const ALL_MARKETS: Market[] = ['US', 'PH', 'SG', 'MY', 'UK'];

function summary(market: Market, tiers: Array<string | undefined>): MarketRateSummary {
  const currency =
    market === 'US'
      ? 'USD'
      : market === 'PH'
        ? 'PHP'
        : market === 'SG'
          ? 'SGD'
          : market === 'MY'
            ? 'MYR'
            : 'GBP';
  return {
    market,
    currency,
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

/**
 * SectionG only reads `inputs`, `update` and `conditional`, so a stub carrying
 * the real capability table is enough to exercise the per-market gating without
 * driving the whole combobox UI.
 */
function stubCalculator(market: Market): UseCalculatorReturn {
  const caps = MARKET_CAPABILITIES[market];
  return {
    inputs: { ...createDefaultInputs(market), isPreOrder: true, isShippingProgramEnrolled: true, isGMVMaxActive: true },
    update: () => {},
    conditional: {
      sellerTier: false,
      platformDiscount: caps.platformDiscount,
      returnRate: caps.returnRate,
      newSellerPromo: caps.newSellerPromo,
      preOrder: caps.preOrder,
      shippingProgram: caps.shippingProgram,
      fulfillment: caps.fulfillment,
      gmvMax: caps.gmvMax,
      affiliateRate: false,
      promoDays: false,
      fbtDetails: false,
    },
  } as unknown as UseCalculatorReturn;
}

describe('SectionG_Programs - placement in the form', () => {
  it('renders as its own section', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    expect(screen.getByText('Programs & promotions')).toBeDefined();
  });

  it('is separate from the Fulfillment section', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    expect(screen.getByText('Fulfillment')).toBeDefined();
    expect(screen.getByText('Programs & promotions')).toBeDefined();
  });

  it('shows no program toggles on US, which supports neither program', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    expect(screen.queryByText('This is a pre-order product')).toBeNull();
    expect(screen.queryByText('Enrolled in the TikTok Shipping Program')).toBeNull();
  });
});

describe('SectionG_Programs - per market gating', () => {
  it('shows the pre-order toggle for PH, SG and MY', () => {
    for (const market of ['PH', 'SG', 'MY'] as Market[]) {
      render(<SectionG_Programs calculator={stubCalculator(market)} />);
      expect(screen.getByText('This is a pre-order product')).toBeDefined();
      cleanup();
    }
  });

  it('hides the pre-order toggle for US and UK', () => {
    for (const market of ['US', 'UK'] as Market[]) {
      render(<SectionG_Programs calculator={stubCalculator(market)} />);
      expect(screen.queryByText('This is a pre-order product')).toBeNull();
      cleanup();
    }
  });

  it('shows the Shipping Program toggle for PH only', () => {
    for (const market of ALL_MARKETS) {
      render(<SectionG_Programs calculator={stubCalculator(market)} />);
      if (market === 'PH') {
        expect(screen.getByText('Enrolled in the TikTok Shipping Program')).toBeDefined();
      } else {
        expect(screen.queryByText('Enrolled in the TikTok Shipping Program')).toBeNull();
      }
      cleanup();
    }
  });

  it('never shows the GMV Max toggle in Phase 2', () => {
    for (const market of ALL_MARKETS) {
      render(<SectionG_Programs calculator={stubCalculator(market)} />);
      expect(screen.queryByText('GMV Max active')).toBeNull();
      cleanup();
    }
  });

  it('shows an explanatory message instead of controls when a market has no programs', () => {
    render(<SectionG_Programs calculator={stubCalculator('US')} />);
    expect(screen.getByText('No optional programs are modelled for the selected market.')).toBeDefined();
  });
});

describe('SectionF_Fulfillment - isolation', () => {
  it('keeps the honest FBT explanation visible', () => {
    const { container } = render(<CalculatorForm ratesByMarket={RATES} />);
    expect(container.textContent).toContain(
      'Fulfilled by TikTok fees are not in the rate data for any market yet'
    );
  });

  it('includes the forward-looking guidance that was requested', () => {
    const { container } = render(<CalculatorForm ratesByMarket={RATES} />);
    expect(container.textContent).toContain('FBT calculation support is planned for a future update');
    expect(container.textContent).toContain(
      'Outbound Shipping Cost field to estimate your fulfillment cost'
    );
  });

  it('offers no fulfillment selector, for the US or any other market', () => {
    // F-15: the FBT/Self-ship radio, product weight and dimensions were read
    // by no engine and priced by no rate row, so they are removed rather than
    // left as a control that cannot change the answer.
    render(<CalculatorForm ratesByMarket={RATES} />);
    expect(screen.queryByText('Fulfillment method')).toBeNull();
    expect(screen.queryByLabelText(/Fulfilled by TikTok/)).toBeNull();
  });

  it('no market advertises a fulfillment capability', () => {
    expect(MARKET_CAPABILITIES.US.fulfillment).toBe(false);
    expect(MARKET_CAPABILITIES.UK.fulfillment).toBe(false);
  });
});

describe('SectionE_Advanced - unchanged', () => {
  it('still renders the promotions section with the promo toggle', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    expect(screen.getByText('Promotions')).toBeDefined();
    expect(screen.getByText('New seller promo active')).toBeDefined();
  });
});
