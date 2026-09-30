import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MiniFeeCalculator } from './MiniFeeCalculator';
import { runCalculation } from '@/app/actions';
import { makeSnapshot } from '@/test/snapshot-fixture';
import type { MarketRateSummary } from '@/hooks/useCalculator';
import type { CalculationOutcome, CalculationRequest } from '@/lib/results/types';

vi.mock('@/app/actions', () => ({ runCalculation: vi.fn() }));

const mockRun = vi.mocked(runCalculation);

const RATES: MarketRateSummary = {
  market: 'MY',
  currency: 'MYR',
  categories: [
    { id: 'my-1', name: 'Electronics (example: Guitar)', tier: 'BXP Marketplace', rate: 0.0702 },
    { id: 'my-2', name: 'Electronics (example: Guitar)', tier: 'BXP Mall', rate: 0.1026 },
    { id: 'my-3', name: 'Toys (example: Remote control car)', tier: 'Non-BXP Mall', rate: 0.1782 },
  ],
};

function clickEstimate() {
  fireEvent.click(screen.getByRole('button', { name: /Estimate platform fees/ }));
}

function lastRequest(): CalculationRequest {
  expect(mockRun).toHaveBeenCalled();
  return mockRun.mock.calls[mockRun.mock.calls.length - 1][0];
}

beforeEach(() => {
  mockRun.mockReset();
});

afterEach(cleanup);

describe('MiniFeeCalculator', () => {
  it('shows nothing before the estimate is requested', () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: makeSnapshot() });
    const { container } = render(<MiniFeeCalculator rates={RATES} />);

    expect(container.textContent).not.toContain('Estimated platform fees');
  });

  it('calls the shared server action rather than computing fees itself', async () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: makeSnapshot() });
    render(<MiniFeeCalculator rates={RATES} />);
    clickEstimate();

    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));
  });

  it('sends the market, price and category through, and pins cost inputs to zero', async () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: makeSnapshot() });
    render(<MiniFeeCalculator rates={RATES} />);
    clickEstimate();

    await waitFor(() => expect(mockRun).toHaveBeenCalled());
    const inputs = lastRequest().inputs;

    expect(inputs.market).toBe('MY');
    expect(inputs.sellingPrice).toBe(25);
    expect(inputs.categoryId).toBe('my-1');

    // Cost fields stay at zero: this widget estimates platform fees, and a
    // non-zero cogs would imply a profit estimate it cannot support.
    expect(inputs.cogs).toBe(0);
    expect(inputs.outboundShipping).toBe(0);
    expect(inputs.cpa).toBe(0);
    expect(inputs.affiliateMode).toBe('none');
    expect(inputs.returnRate).toBe(0);
    expect(inputs.isGMVMaxActive).toBe(false);
  });

  it('renders the total fees and the take rate on success', async () => {
    const snapshot = makeSnapshot({
      totalPlatformFees: 3.75,
      effectiveTakeRate: 0.15,
      currency: 'MYR',
    });
    mockRun.mockResolvedValue({ ok: true, snapshot } as CalculationOutcome);
    render(<MiniFeeCalculator rates={RATES} />);
    clickEstimate();

    expect(await screen.findByText('Estimated platform fees')).toBeTruthy();
    expect(screen.getByText('RM 3.75')).toBeTruthy();
    expect(screen.getByText(/15\.0% of the/)).toBeTruthy();
  });

  it('lists the individual fee lines the engine returned', async () => {
    const snapshot = makeSnapshot({
      totalPlatformFees: 3.75,
      currency: 'MYR',
      fees: [
        { name: 'Commission Fee', rate: '7.02%', base: 25, amount: 1.755, pricing: 'priced', sourceUrl: '', effectiveDate: '', lastVerified: '', confidence: 'high' },
        { name: 'Transaction Fee', rate: '3.78%', base: 25, amount: 0.945, pricing: 'priced', sourceUrl: '', effectiveDate: '', lastVerified: '', confidence: 'high' },
      ],
    });
    mockRun.mockResolvedValue({ ok: true, snapshot } as CalculationOutcome);
    render(<MiniFeeCalculator rates={RATES} />);
    clickEstimate();

    expect(await screen.findByText('Commission Fee')).toBeTruthy();
    expect(screen.getByText('RM 1.76')).toBeTruthy();
    expect(screen.getByText('Transaction Fee')).toBeTruthy();
  });

  it('says the figure is not a profit estimate', async () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: makeSnapshot({ currency: 'MYR' }) } as CalculationOutcome);
    render(<MiniFeeCalculator rates={RATES} />);
    clickEstimate();

    expect(await screen.findByText(/This is not a profit estimate/)).toBeTruthy();
  });

  it('rejects a non-positive price without calling the server', () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: makeSnapshot() });
    render(<MiniFeeCalculator rates={RATES} />);

    const price = screen.getByLabelText(/Selling price/);
    fireEvent.change(price, { target: { value: '0' } });
    clickEstimate();

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Enter a price greater than 0 to estimate fees.')).toBeTruthy();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric price without calling the server', () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: makeSnapshot() });
    render(<MiniFeeCalculator rates={RATES} />);

    fireEvent.change(screen.getByLabelText(/Selling price/), { target: { value: 'abc' } });
    clickEstimate();

    expect(mockRun).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('surfaces server-side validation errors in an alert', async () => {
    mockRun.mockResolvedValue({ ok: false, errors: ['categoryId is required'] });
    render(<MiniFeeCalculator rates={RATES} />);
    clickEstimate();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('categoryId is required');
  });

  it('clears a previous result when a new request fails', async () => {
    mockRun.mockResolvedValue({ ok: true, snapshot: makeSnapshot({ totalPlatformFees: 3.75, currency: 'MYR' }) } as CalculationOutcome);
    render(<MiniFeeCalculator rates={RATES} />);
    clickEstimate();
    expect(await screen.findByText('Estimated platform fees')).toBeTruthy();

    // Wait for the button to come back before retrying: the label and disabled
    // state only settle once the transition finishes.
    const button = await waitFor(() => {
      const el = screen.getByRole('button', { name: /Estimate platform fees/ }) as HTMLButtonElement;
      expect(el.disabled).toBe(false);
      return el;
    });

    mockRun.mockResolvedValue({ ok: false, errors: ['boom'] });
    fireEvent.click(button);

    await screen.findByRole('alert');
    expect(screen.queryByText('Estimated platform fees')).toBeNull();
  });

  it('disambiguates categories that share a name but differ by tier', () => {
    // MY stores four categories all named "Electronics (example: Guitar)".
    render(<MiniFeeCalculator rates={RATES} />);
    fireEvent.focus(screen.getByRole('combobox'));

    const labels = screen.getAllByRole('option').map((o) => o.textContent);
    expect(labels).toContain('Electronics (example: Guitar) - BXP Marketplace');
    expect(labels).toContain('Electronics (example: Guitar) - BXP Mall');
    // A unique name is left alone.
    expect(labels).toContain('Toys (example: Remote control car)');
  });

  it('disables the button while a request is in flight', async () => {
    let resolve: (value: CalculationOutcome) => void = () => {};
    mockRun.mockReturnValue(new Promise<CalculationOutcome>((r) => { resolve = r; }));

    render(<MiniFeeCalculator rates={RATES} />);
    fireEvent.click(screen.getByRole('button', { name: /Estimate platform fees/ }));

    const busy = await screen.findByRole('button', { name: /Calculating/ }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);

    resolve({ ok: true, snapshot: makeSnapshot({ currency: 'MYR' }) } as CalculationOutcome);
    await waitFor(() =>
      expect((screen.getByRole('button', { name: /Estimate platform fees/ }) as HTMLButtonElement).disabled).toBe(false)
    );
  });
});
