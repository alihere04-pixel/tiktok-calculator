import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { CalculatorForm } from './CalculatorForm';
import { runCalculation } from '@/app/actions';
import { makeSnapshot } from '@/test/snapshot-fixture';
import type { MarketRateSummary } from '@/hooks/useCalculator';
import type { Market } from '@/hooks/useCalculator';
import type { CalculationOutcome } from '@/lib/results/types';

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

/** Every money field on the form, for the US default market. Labels are matched
 *  loosely because a required field renders a trailing `*` inside the label. */
const MONEY_LABELS = [
  /^Selling price/,
  /^Seller discount/,
  /^Platform discount/,
  /^Customer shipping/,
  /^Cost of goods/,
  /^Outbound shipping cost/,
  /^Ad spend per unit/,
];

function moneyField(label: RegExp): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

/**
 * Types `text` one character at a time, the way a real keystroke appends to
 * whatever the field is currently showing. This is what exposed the original
 * bug: the field pre-filled with `0`, so typing produced `0100`.
 */
function typeInto(input: HTMLInputElement, text: string): void {
  let typed = '';
  for (const char of text) {
    typed += char;
    fireEvent.change(input, { target: { value: typed } });
  }
}

function submittedInputs() {
  const call = mockRun.mock.calls[0]?.[0];
  if (!call) throw new Error('runCalculation was never called');
  return call.inputs;
}

/**
 * A category is mandatory, so the Calculate button is disabled without one.
 * These tests are about the money fields, so pick a category to make the form
 * submittable and let the assertions concentrate on the numeric model.
 */
function calculateWithCategoryChosen() {
  fireEvent.focus(screen.getByLabelText(/^Category/));
  fireEvent.mouseDown(screen.getAllByRole('option')[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Calculate Profit' }));
}

beforeEach(() => {
  mockRun.mockReset();
  mockRun.mockResolvedValue({ ok: true, snapshot: makeSnapshot({}) } satisfies CalculationOutcome);
});

afterEach(cleanup);

describe('money inputs are visually empty until entered', () => {
  it('starts every money field empty rather than pre-filled with 0', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);

    for (const label of MONEY_LABELS) {
      expect(moneyField(label).value, label.source).toBe('');
    }
  });

  it('shows the placeholder instead of a hard-coded zero', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    expect(moneyField(/^Selling price/).getAttribute('placeholder')).toBe('0.00');
  });

  it('types 100 as 100, not 0100', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    const input = moneyField(/^Selling price/);

    typeInto(input, '100');

    expect(input.value).toBe('100');
    expect(input.value).not.toBe('0100');
  });
});

describe('money inputs can be cleared and can hold a real 0', () => {
  it('clears back to fully empty', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    const input = moneyField(/^Cost of goods/);

    typeInto(input, '40');
    expect(input.value).toBe('40');

    fireEvent.change(input, { target: { value: '' } });

    expect(input.value).toBe('');
  });

  it('accepts an intentionally entered 0 and keeps it visible', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    const input = moneyField(/^Outbound shipping cost/);

    fireEvent.change(input, { target: { value: '0' } });

    expect(input.value).toBe('0');
  });

  it('distinguishes a cleared field from an entered 0 across two fields', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    const cleared = moneyField(/^Seller discount/);
    const zero = moneyField(/^Customer shipping/);

    fireEvent.change(cleared, { target: { value: '' } });
    fireEvent.change(zero, { target: { value: '0' } });

    expect(cleared.value).toBe('');
    expect(zero.value).toBe('0');
  });
});

describe('currency prefix stays separated from the typed amount', () => {
  it('renders the currency prefix beside the input', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    const input = moneyField(/^Selling price/);
    const prefix = input.parentElement?.querySelector('span.absolute');

    expect(prefix?.textContent).toBe('USD');
  });

  it('keeps the left padding that clears the prefix', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    const input = moneyField(/^Selling price/);

    expect(input.classList.contains('pl-12')).toBe(true);
    expect(input.classList.contains('pl-7')).toBe(false);
  });

  it('leaves unprefixed numeric fields without the prefix padding', () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    const returnRate = moneyField(/^Return \/ refund rate/);

    expect(returnRate.classList.contains('pl-12')).toBe(false);
  });
});

describe('the numeric calculation model is unchanged', () => {
  it('sends a number for a typed amount, not a string', async () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    typeInto(moneyField(/^Selling price/), '100');

    calculateWithCategoryChosen();
    await waitFor(() => expect(mockRun).toHaveBeenCalled());

    expect(submittedInputs().sellingPrice).toBe(100);
  });

  it('sends 0 for a cleared field, preserving numeric zero semantics', async () => {
    render(<CalculatorForm ratesByMarket={RATES} />);
    const cogs = moneyField(/^Cost of goods/);

    typeInto(cogs, '40');
    expect(cogs.value).toBe('40');
    fireEvent.change(cogs, { target: { value: '' } });

    calculateWithCategoryChosen();
    await waitFor(() => expect(mockRun).toHaveBeenCalled());

    expect(submittedInputs().cogs).toBe(0);
  });

  it('still defaults untouched money fields to 0 for validation', async () => {
    render(<CalculatorForm ratesByMarket={RATES} />);

    calculateWithCategoryChosen();
    await waitFor(() => expect(mockRun).toHaveBeenCalled());

    const inputs = submittedInputs();
    expect(inputs.sellingPrice).toBe(0);
    expect(inputs.cogs).toBe(0);
    expect(inputs.outboundShipping).toBe(0);
  });
});
