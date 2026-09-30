import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, renderHook, act } from '@testing-library/react';
import { CalculatorForm } from './CalculatorForm';
import { useCalculator } from '@/hooks/useCalculator';
import type { MarketRateSummary } from '@/hooks/useCalculator';

afterEach(cleanup);

/**
 * PH as the browser receives it: every row labelled "Marketplace" *and*
 * carrying a `mallRate`, which is the real shape of the rate file.
 */
const PH_RATES: MarketRateSummary = {
  market: 'PH',
  currency: 'PHP',
  categories: [
    {
      id: 'ph-shoes',
      name: 'Shoes',
      parentCategory: 'Fashion',
      tier: 'Marketplace',
      rate: 0.068,
      mallRate: 0.079,
      confidence: 'high',
    },
    {
      id: 'ph-luggage-bags',
      name: 'Luggage & Bags',
      parentCategory: 'Fashion',
      tier: 'Marketplace',
      rate: 0.069,
      mallRate: 0.076,
      confidence: 'high',
    },
  ],
};

/** The same data with `mallRate` dropped, i.e. the pre-fix projection. */
const PH_RATES_WITHOUT_MALL: MarketRateSummary = {
  ...PH_RATES,
  categories: PH_RATES.categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentCategory: c.parentCategory,
    tier: c.tier,
    rate: c.rate,
    confidence: c.confidence,
  })),
};

/** Opens a Select and commits the option whose text contains `optionText`. */
function chooseOption(controlLabel: RegExp, optionText: string) {
  fireEvent.focus(screen.getByLabelText(controlLabel));
  const option = screen.getAllByRole('option').find((el) => el.textContent?.includes(optionText));
  if (!option) throw new Error(`No option matching "${optionText}"`);
  fireEvent.mouseDown(option);
}

/** The market Select is labelled by country name, not by market code. */
function switchToPH() {
  chooseOption(/Country \/ market/, 'Philippines');
}

function renderPH() {
  render(<CalculatorForm ratesByMarket={{ PH: PH_RATES }} />);
  switchToPH();
}

describe('PH hook contract', () => {
  it('exposes exactly Marketplace and Mall for PH', () => {
    const { result } = renderHook(() => useCalculator({ PH: PH_RATES }, 'PH'));
    expect(result.current.sellerTiers).toEqual(['marketplace', 'mall']);
  });

  it('flags the Seller tier control as visible for PH', () => {
    const { result } = renderHook(() => useCalculator({ PH: PH_RATES }, 'PH'));
    expect(result.current.showSellerTier).toBe(true);
  });

  it('hides the control when the projection omits mallRate', () => {
    // The regression this guards: the rows' own "Marketplace" label was the
    // only tier signal, the market looked single-tier, and the control
    // silently stopped rendering, making Mall unreachable.
    const { result } = renderHook(
      () => useCalculator({ PH: PH_RATES_WITHOUT_MALL }, 'PH')
    );
    expect(result.current.sellerTiers).toEqual(['marketplace']);
    expect(result.current.showSellerTier).toBe(false);
  });

  it('passes the selected tier through to the inputs the engine receives', () => {
    const { result } = renderHook(() => useCalculator({ PH: PH_RATES }, 'PH'));
    act(() => {
      result.current.setCategoryId('ph-shoes');
      result.current.setSellerTier('mall');
    });
    expect(result.current.inputs.sellerTier).toBe('mall');
    expect(result.current.inputs.categoryId).toBe('ph-shoes');
  });

  it('previews the rate of the selected tier', () => {
    const { result } = renderHook(() => useCalculator({ PH: PH_RATES }, 'PH'));
    act(() => {
      result.current.setCategoryId('ph-shoes');
      result.current.setSellerTier('marketplace');
    });
    expect(result.current.selectedCategory?.displayRate).toBe(0.068);

    act(() => result.current.setSellerTier('mall'));
    expect(result.current.selectedCategory?.displayRate).toBe(0.079);
  });

  it('does not add a Seller tier to US or UK', () => {
    const us: MarketRateSummary = {
      market: 'US',
      currency: 'USD',
      categories: [{ id: 'us-1', name: 'Beauty', rate: 0.06 }],
    };
    const uk: MarketRateSummary = { ...us, market: 'UK', currency: 'GBP' };
    for (const market of ['US', 'UK'] as const) {
      const { result } = renderHook(() =>
        useCalculator({ [market]: market === 'US' ? us : uk }, market)
      );
      expect(result.current.sellerTiers, market).toEqual([]);
      expect(result.current.showSellerTier, market).toBe(false);
    }
  });
});

describe('PH Seller tier control in the form', () => {
  it('renders the control for PH', () => {
    renderPH();
    expect(screen.getByLabelText(/Seller tier/)).toBeDefined();
  });

  it('offers exactly Marketplace and Mall', () => {
    renderPH();
    fireEvent.focus(screen.getByLabelText(/Seller tier/));
    const labels = screen.getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(['Marketplace', 'Mall']);
  });

  it('does not render the control when mallRate is absent from the projection', () => {
    render(<CalculatorForm ratesByMarket={{ PH: PH_RATES_WITHOUT_MALL }} />);
    switchToPH();
    expect(screen.queryByLabelText(/Seller tier/)).toBeNull();
  });

  it('shows the commission rate of the selected tier', () => {
    renderPH();
    chooseOption(/^Category/, 'Shoes');

    chooseOption(/Seller tier/, 'Marketplace');
    expect(screen.getByText(/6\.80% commission/)).toBeDefined();

    chooseOption(/Seller tier/, 'Mall');
    expect(screen.getByText(/7\.90% commission/)).toBeDefined();
    expect(screen.queryByText(/6\.80% commission/)).toBeNull();
  });

  it('does not claim a tier the seller has not chosen', () => {
    renderPH();
    chooseOption(/^Category/, 'Shoes');
    // The row is labelled "Marketplace", but no selection has been made, so no
    // tier tag may claim otherwise.
    expect(screen.queryByText('Marketplace')).toBeNull();
  });

  it('labels the selection with the chosen tier, not the row label', () => {
    renderPH();
    chooseOption(/^Category/, 'Shoes');
    chooseOption(/Seller tier/, 'Mall');
    expect(screen.getByText('Mall')).toBeDefined();
  });

  it('keeps the MY four-tier control intact', () => {
    const my: MarketRateSummary = {
      market: 'MY',
      currency: 'MYR',
      categories: [
        {
          id: 'my-electronics',
          name: 'Electronics',
          parentCategory: 'Electronics',
          tier: 'BXP Marketplace',
          rate: 0.0702,
        },
        {
          id: 'my-electronics-pro',
          name: 'Electronics',
          parentCategory: 'Electronics',
          tier: 'BXP Mall',
          rate: 0.1026,
        },
        {
          id: 'my-electronics-non-bxp-mall',
          name: 'Electronics',
          parentCategory: 'Electronics',
          tier: 'Non-BXP Mall',
          rate: 0.1459,
        },
        {
          id: 'my-electronics-non-bxp-mkt',
          name: 'Electronics',
          parentCategory: 'Electronics',
          tier: 'Non-BXP Marketplace',
          rate: 0.1134,
        },
      ],
    };
    const { result } = renderHook(() => useCalculator({ MY: my }, 'MY'));
    expect(result.current.sellerTiers).toEqual([
      'bxp-marketplace',
      'bxp-mall',
      'non-bxp-marketplace',
      'non-bxp-mall',
    ]);
    expect(result.current.showSellerTier).toBe(true);
  });

  it('keeps the SG four-tier control intact', () => {
    const sg: MarketRateSummary = {
      market: 'SG',
      currency: 'SGD',
      categories: [
        {
          id: 'sg-a',
          name: 'Beauty',
          parentCategory: 'Beauty',
          tier: 'Standard',
          rate: 0.06,
        },
        {
          id: 'sg-b',
          name: 'Beauty',
          parentCategory: 'Beauty',
          tier: 'BXP',
          rate: 0.075,
        },
        {
          id: 'sg-c',
          name: 'Beauty',
          parentCategory: 'Beauty',
          tier: 'BXP Restricted',
          rate: 0.09,
        },
        {
          id: 'sg-d',
          name: 'Beauty',
          parentCategory: 'Beauty',
          tier: 'BXP Mixed',
          rate: 0.0327,
        },
      ],
    };
    const { result } = renderHook(() => useCalculator({ SG: sg }, 'SG'));
    expect(result.current.sellerTiers).toEqual([
      'standard',
      'bxp',
      'bxp-restricted',
      'bxp-mixed',
    ]);
    expect(result.current.showSellerTier).toBe(true);
  });
});
