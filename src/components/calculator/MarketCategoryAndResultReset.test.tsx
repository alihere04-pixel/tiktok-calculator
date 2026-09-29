import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { CalculatorForm } from './CalculatorForm';
import { runCalculation } from '@/app/actions';
import { makeSnapshot } from '@/test/snapshot-fixture';
import type { CalculationOutcome } from '@/lib/results/types';
import type { MarketRateSummary } from '@/hooks/useCalculator';
import type { Market } from '@/hooks/useCalculator';

vi.mock('@/app/actions', () => ({ runCalculation: vi.fn() }));

const mockRun = vi.mocked(runCalculation);

function summary(market: Market, tiers: Array<string | undefined>): MarketRateSummary {
  const currency = { US: 'USD', PH: 'PHP', SG: 'SGD', MY: 'MYR', UK: 'GBP' }[market];
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

const SNAPSHOT = makeSnapshot({ totalPlatformFees: 6, netProfit: 59 });

/** Opens the category listbox and commits the option at `index`. */
function chooseCategory(index = 0) {
  fireEvent.focus(screen.getByLabelText(/^Category/));
  fireEvent.mouseDown(screen.getAllByRole('option')[index]);
}

/** Picks a value in a Select by its option text. */
function chooseOption(controlLabel: RegExp, optionText: string) {
  fireEvent.focus(screen.getByLabelText(controlLabel));
  const option = screen.getAllByRole('option').find((el) => el.textContent?.includes(optionText));
  if (!option) throw new Error(`No option matching "${optionText}"`);
  fireEvent.mouseDown(option);
}

/** The market Select is labelled by country name, not by market code. */
const MARKET_LABELS: Record<Market, string> = {
  US: 'United States',
  UK: 'United Kingdom',
  MY: 'Malaysia',
  SG: 'Singapore',
  PH: 'Philippines',
};

function selectMarket(market: Market) {
  chooseOption(/^Country \/ market/, MARKET_LABELS[market]);
}

function calculateButton() {
  return screen.getByRole('button', { name: 'Calculate Profit' }) as HTMLButtonElement;
}

function fillMoney(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  mockRun.mockReset();
  mockRun.mockResolvedValue({ ok: true, snapshot: SNAPSHOT } satisfies CalculationOutcome);
});

afterEach(cleanup);

describe('a category is required before calculating', () => {
  it('disables Calculate Profit while no category is selected', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);

    expect(calculateButton().hasAttribute('disabled')).toBe(true);
  });

  it('explains why Calculate Profit is unavailable', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);

    expect(screen.getByText(/Choose a category first/)).toBeDefined();
  });

  it('enables Calculate Profit once a category is chosen', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    chooseCategory();

    expect(calculateButton().hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText(/Choose a category first/)).toBeNull();
  });

  it('never calls the calculation action without a category', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);

    fireEvent.click(calculateButton());

    expect(mockRun).not.toHaveBeenCalled();
  });

  it('blocks the Malaysia case that reported an empty categoryId', async () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    selectMarket('MY');
    fillMoney(/^Selling price/, '100');
    fillMoney(/^Cost of goods/, '40');
    fillMoney(/^Outbound shipping cost/, '10');

    // Tier is selectable, category is not: this is the reported state.
    expect(calculateButton().hasAttribute('disabled')).toBe(true);

    fireEvent.click(calculateButton());
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('calculates for Malaysia once a category is chosen', async () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    selectMarket('MY');
    fillMoney(/^Selling price/, '100');
    fillMoney(/^Cost of goods/, '40');
    fillMoney(/^Outbound shipping cost/, '10');
    chooseCategory(0);

    fireEvent.click(calculateButton());

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));
    expect(mockRun.mock.calls[0][0].inputs.market).toBe('MY');
    expect(mockRun.mock.calls[0][0].inputs.categoryId).toBe('my-cat-0');
    expect(screen.getByText('Your result')).toBeDefined();
  });
});

describe('changing seller tier keeps the chosen category', () => {
  it('preserves categoryId when a tier is selected after the category', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    selectMarket('MY');
    chooseCategory(0);

    chooseOption(/^Seller tier/, 'BXP Mall');

    // Still valid, so Calculate stays available.
    expect(calculateButton().hasAttribute('disabled')).toBe(false);
  });

  it('still submits the chosen category after a tier change', async () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    selectMarket('MY');
    chooseCategory(1);
    chooseOption(/^Seller tier/, 'BXP Mall');

    fireEvent.click(calculateButton());

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));
    expect(mockRun.mock.calls[0][0].inputs.categoryId).toBe('my-cat-1');
  });

  it('does not show the seller tier selector for a single-tier market', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    selectMarket('US');

    expect(screen.queryByLabelText(/^Seller tier/)).toBeNull();
  });
});

describe('changing market clears the previous result', () => {
  async function calculateForUS() {
    render(<CalculatorForm ratesByMarket={RATES} />);
    chooseCategory(0);
    fireEvent.click(calculateButton());
    await waitFor(() => expect(screen.getByText('Your result')).toBeDefined());
  }

  it('removes the old result as soon as the market changes', async () => {
    await calculateForUS();
    expect(screen.getByText('Your result')).toBeDefined();

    selectMarket('UK');

    expect(screen.queryByText('Your result')).toBeNull();
    expect(screen.queryByText('Fee breakdown')).toBeNull();
    expect(screen.queryByText('Source attribution')).toBeNull();
  });

  it('removes the old result when switching to Malaysia', async () => {
    await calculateForUS();

    selectMarket('MY');

    expect(screen.queryByText('Your result')).toBeNull();
  });

  it('does not show a result again until the new market is calculated', async () => {
    await calculateForUS();
    selectMarket('UK');
    expect(screen.queryByText('Your result')).toBeNull();

    // Filling the new market's fields must not resurrect the old figures.
    chooseCategory(0);
    fillMoney(/^Selling price/, '100');
    expect(screen.queryByText('Your result')).toBeNull();

    fireEvent.click(calculateButton());

    await waitFor(() => expect(screen.getByText('Your result')).toBeDefined());
    // The second call is the UK run; the first was the original US one.
    const lastCall = mockRun.mock.calls[mockRun.mock.calls.length - 1][0];
    expect(lastCall.inputs.market).toBe('UK');
    expect(lastCall.inputs.categoryId).toBe('uk-cat-0');
  });

  it('does not re-run the action just because the market changed', async () => {
    await calculateForUS();
    expect(mockRun).toHaveBeenCalledTimes(1);

    selectMarket('UK');

    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('keeps the out-of-date banner for a non-market input change', async () => {
    await calculateForUS();

    // isStale must survive: a result is still on screen for this market.
    fillMoney(/^Selling price/, '120');

    expect(screen.getByText(/these figures are out of date/)).toBeDefined();
  });

  it('clears a previous error when the market changes', async () => {
    mockRun.mockResolvedValue({ ok: false, errors: ['Something went wrong'] });
    render(<CalculatorForm ratesByMarket={RATES} />);
    chooseCategory(0);
    fireEvent.click(calculateButton());
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());

    selectMarket('UK');

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
