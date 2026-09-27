import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MonthlyProjectionCard } from './MonthlyProjectionCard';
import { makeSnapshot } from '@/test/snapshot-fixture';

afterEach(cleanup);

function renderCard(snapshotOverrides = {}, onChange: (v: number) => void = () => {}) {
  return render(
    <MonthlyProjectionCard
      snapshot={makeSnapshot(snapshotOverrides)}
      monthlyUnits={500}
      onMonthlyUnitsChange={onChange}
      isPending={false}
    />
  );
}

describe('MonthlyProjectionCard', () => {
  it('shows the PRD projection outputs', () => {
    const { container } = renderCard();
    const text = container.textContent ?? '';
    expect(text).toContain('Monthly units');
    expect(text).toContain('GMV');
    expect(text).toContain('Total fees');
    expect(text).toContain('Total profit');
    expect(text).toContain('Avg profit / unit');
  });

  it('formats the projected values in the snapshot currency', () => {
    const { container } = renderCard({
      currency: 'MYR',
      projection: {
        monthlyUnits: 1000,
        units: 1000,
        gmv: 100_000,
        totalFees: 6_000,
        totalProfit: 59_000,
        avgProfitPerUnit: 59,
      },
    });
    const text = container.textContent ?? '';
    expect(text).toContain('RM 100,000.00');
    expect(text).toContain('RM 6,000.00');
    expect(text).toContain('RM 59,000.00');
    expect(text).toContain('RM 59.00');
  });

  it('marks a projected loss in red as well as with a minus sign', () => {
    const { container } = renderCard({
      projection: {
        monthlyUnits: 100,
        units: 100,
        gmv: 10_000,
        totalFees: 1_000,
        totalProfit: -1_500,
        avgProfitPerUnit: -15,
      },
    });
    expect(container.textContent).toContain('-$1,500.00');
    expect(container.querySelector('[class*="text-red-700"]')).not.toBeNull();
  });

  it('prompts for a unit count when the field is zero', () => {
    render(
      <MonthlyProjectionCard
        snapshot={makeSnapshot({
          projection: { monthlyUnits: 0, units: 0, gmv: 0, totalFees: 0, totalProfit: 0, avgProfitPerUnit: 0 },
        })}
        monthlyUnits={0}
        onMonthlyUnitsChange={() => {}}
        isPending={false}
      />
    );
    expect(screen.getByText(/Enter a unit count above/)).toBeDefined();
  });

  it('reports unit changes to the parent', () => {
    const onChange = vi.fn();
    renderCard({}, onChange);
    fireEvent.change(screen.getByLabelText('Monthly units'), { target: { value: '250' } });
    expect(onChange).toHaveBeenCalledWith(250);
  });

  it('states the per-unit basis the projection came from', () => {
    const { container } = renderCard({ netProfit: 59 });
    expect(container.textContent).toContain('Based on $59.00 profit per unit');
  });
});
