import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SummaryCards } from './SummaryCards';
import { makeSnapshot } from '@/test/snapshot-fixture';

afterEach(cleanup);

function renderCards(overrides: Parameters<typeof makeSnapshot>[0] = {}) {
  return render(<SummaryCards snapshot={makeSnapshot(overrides)} />);
}

describe('SummaryCards', () => {
  it('shows the four PRD headline figures', () => {
    renderCards();
    expect(screen.getByText('Net profit / unit')).toBeDefined();
    expect(screen.getByText('Profit margin')).toBeDefined();
    expect(screen.getByText('Effective take rate')).toBeDefined();
    expect(screen.getByText('Break-even price')).toBeDefined();
  });

  it('labels profit, loss and break-even with words, not colour alone', () => {
    renderCards({ netProfit: 59 });
    expect(screen.getByText('Profit per unit')).toBeDefined();

    cleanup();
    renderCards({ netProfit: -5 });
    expect(screen.getByText('Loss per unit')).toBeDefined();

    cleanup();
    renderCards({ netProfit: 0 });
    expect(screen.getByText('Break even')).toBeDefined();
  });

  it('applies the PRD margin bands at their exact boundaries', () => {
    // 20% is the first green band, 10% the first amber band.
    renderCards({ profitMargin: 0.2 });
    expect(screen.getByText('Healthy margin')).toBeDefined();

    cleanup();
    renderCards({ profitMargin: 0.1999 });
    expect(screen.getByText('Thin margin')).toBeDefined();

    cleanup();
    renderCards({ profitMargin: 0.1 });
    expect(screen.getByText('Thin margin')).toBeDefined();

    cleanup();
    renderCards({ profitMargin: 0.0999 });
    expect(screen.getByText('Below 10% margin')).toBeDefined();
  });

  it('colours profit green, loss red and break-even neutral', () => {
    const { container } = renderCards({ netProfit: 10 });
    expect(container.querySelector('[class*="text-green-700"]')).not.toBeNull();

    cleanup();
    const loss = renderCards({ netProfit: -10 });
    expect(loss.container.querySelector('[class*="text-red-700"]')).not.toBeNull();

    cleanup();
    const flat = renderCards({ netProfit: 0 });
    expect(flat.container.querySelector('[class*="text-zinc-700"]')).not.toBeNull();
  });

  it('colours the take rate blue regardless of the margin band', () => {
    const { container } = renderCards({ profitMargin: 0.05 });
    expect(container.querySelector('[class*="text-blue-700"]')).not.toBeNull();
  });

  it('formats currency with the snapshot currency code', () => {
    renderCards({ currency: 'MYR', netProfit: 12.5, breakEvenPrice: 40 });
    expect(screen.getByText('RM 12.50')).toBeDefined();
    expect(screen.getByText('RM 40.00')).toBeDefined();
  });

  it('renders engine fractions as percentages', () => {
    renderCards({ profitMargin: 0.25, effectiveTakeRate: 0.0659 });
    expect(screen.getByText('25.0%')).toBeDefined();
    expect(screen.getByText('6.6%')).toBeDefined();
  });
});

describe('SummaryCards - incomplete results (F-04)', () => {
  const INCOMPLETE = {
    complete: false,
    unpricedFees: ['Commission Fee'],
  };

  it('warns that the calculation is incomplete and names the missing fee', () => {
    renderCards(INCOMPLETE);
    expect(screen.getByText('Incomplete calculation.')).toBeDefined();
    expect(screen.getByText(/Commission Fee/)).toBeDefined();
  });

  it('marks the derived figures as bounds rather than final numbers', () => {
    // A headline net profit built from a missing fee would otherwise read as
    // the answer, when it is really the best case.
    renderCards(INCOMPLETE);
    expect(screen.getByText('Net profit / unit (max)')).toBeDefined();
    expect(screen.getByText('Profit margin (max)')).toBeDefined();
    expect(screen.getByText('Effective take rate (min)')).toBeDefined();
    expect(screen.getByText('Break-even price (min)')).toBeDefined();
  });

  it('replaces the plain labels with the bound labels only when incomplete', () => {
    renderCards();
    expect(screen.getByText('Net profit / unit')).toBeDefined();
    expect(screen.queryByText('Incomplete calculation.')).toBeNull();
  });

  it('does not warn when every fee was priced', () => {
    renderCards({ complete: true, unpricedFees: [] });
    expect(screen.queryByText('Incomplete calculation.')).toBeNull();
  });

  it('does not warn on a complete result that merely lists no unpriced fees', () => {
    // Guards against treating a complete false/empty pair as incomplete: the
    // engine sets both together, and the fee count is the honest signal.
    renderCards({ complete: true, unpricedFees: [] });
    expect(screen.queryByText(/not in the rate data/)).toBeNull();
  });
});
