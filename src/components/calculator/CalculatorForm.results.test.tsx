import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { CalculatorForm } from './CalculatorForm';
import { runCalculation } from '@/app/actions';
import { DEFAULT_MONTHLY_UNITS, DEFAULT_TARGET_PROFIT, DEFAULT_TARGET_ROAS } from '@/lib/results/defaults';
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

function clickCalculate() {
  fireEvent.click(screen.getByRole('button', { name: 'Calculate Profit' }));
}

beforeEach(() => {
  mockRun.mockReset();
});

afterEach(cleanup);

describe('CalculatorForm results cycle', () => {
  it('renders nothing but the form before Calculate is clicked', () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: SNAPSHOT });
    const { container } = render(<CalculatorForm ratesByMarket={RATES} />);

    expect(container.textContent).not.toContain('Your result');
    expect(container.textContent).not.toContain('Fee breakdown');
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('sends the current inputs with the PRD defaults on submit', async () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: SNAPSHOT });
    render(<CalculatorForm ratesByMarket={RATES} />);

    clickCalculate();

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));
    const request = mockRun.mock.calls[0][0];
    expect(request.inputs.market).toBe('US');
    expect(request.targetProfit).toBe(DEFAULT_TARGET_PROFIT);
    expect(request.targetROAS).toBe(DEFAULT_TARGET_ROAS);
    expect(request.monthlyUnits).toBe(DEFAULT_MONTHLY_UNITS);
  });

  it('shows the results panel after a successful calculation', async () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: SNAPSHOT });
    render(<CalculatorForm ratesByMarket={RATES} />);

    clickCalculate();

    await waitFor(() => expect(screen.getByText('Your result')).toBeDefined());
    expect(screen.getByText('Fee breakdown')).toBeDefined();
    expect(screen.getByText('Source attribution')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the error state and no panel when validation fails', async () => {
    mockRun.mockResolvedValue({
      ok: false,
      errors: ['categoryId is required and must be a non-empty string'],
    });
    render(<CalculatorForm ratesByMarket={RATES} />);

    clickCalculate();

    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert.textContent).toContain('categoryId is required');
    expect(screen.queryByText('Your result')).toBeNull();
    expect(screen.queryByText('Fee breakdown')).toBeNull();
  });

  it('renders the panel outside the form so its own inputs are not nested', async () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: SNAPSHOT });
    const { container } = render(<CalculatorForm ratesByMarket={RATES} />);

    clickCalculate();
    await waitFor(() => expect(screen.getByText('Your result')).toBeDefined());

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    expect(form?.querySelector('form')).toBeNull();
    // The reverse-calculator inputs live in the panel, not inside the form.
    expect(form?.textContent).not.toContain('Target profit price');
    expect(screen.getByLabelText('Target profit price')).toBeDefined();
    expect(container.querySelectorAll('form').length).toBe(1);
  });

  it('disables the button and shows progress while calculating', async () => {
    let resolve: (value: CalculationOutcome) => void = () => {};
    mockRun.mockReturnValue(
      new Promise<CalculationOutcome>((r) => {
        resolve = r;
      })
    );

    render(<CalculatorForm ratesByMarket={RATES} />);
    clickCalculate();

    const button = await screen.findByRole('button', { name: 'Calculating...' });
    expect(button.hasAttribute('disabled')).toBe(true);

    resolve({ ok: true, snapshot: SNAPSHOT });
    await waitFor(() => expect(screen.getByText('Your result')).toBeDefined());
  });

  it('marks a previous result as out of date once an input changes', async () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: SNAPSHOT });
    render(<CalculatorForm ratesByMarket={RATES} />);

    clickCalculate();
    await waitFor(() => expect(screen.getByText('Your result')).toBeDefined());
    expect(screen.queryByText(/out of date/)).toBeNull();

    fireEvent.change(screen.getByLabelText(/Selling price/), { target: { value: '120' } });

    expect(screen.getByText(/these figures are out of date/)).toBeDefined();
  });

  it('does not mark the result stale for a change that alters nothing', async () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: SNAPSHOT });
    render(<CalculatorForm ratesByMarket={RATES} />);

    clickCalculate();
    await waitFor(() => expect(screen.getByText('Your result')).toBeDefined());

    // Re-entering the same value must not trip the value comparison.
    fireEvent.change(screen.getByLabelText(/Selling price/), { target: { value: '0' } });
    expect(screen.queryByText(/out of date/)).toBeNull();
  });

  it('can dismiss a validation error and try again', async () => {
    mockRun.mockResolvedValue({ ok: false, errors: ['boom'] });
    render(<CalculatorForm ratesByMarket={RATES} />);

    clickCalculate();
    const alert = await waitFor(() => screen.getByRole('alert'));

    mockRun.mockResolvedValue({ ok: true, snapshot: SNAPSHOT });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(alert).toBeDefined();
    expect(screen.queryByText('Your result')).toBeNull();

    clickCalculate();
    await waitFor(() => expect(screen.getByText('Your result')).toBeDefined());
  });
});
