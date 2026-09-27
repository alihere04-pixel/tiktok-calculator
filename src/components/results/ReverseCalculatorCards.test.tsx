import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ReverseCalculatorCards } from './ReverseCalculatorCards';
import { makeSnapshot } from '@/test/snapshot-fixture';

afterEach(cleanup);

function renderCards(
  snapshotOverrides = {},
  handlers: { onTargetProfitChange?: (v: number) => void; onTargetROASChange?: (v: number) => void } = {}
) {
  return render(
    <ReverseCalculatorCards
      snapshot={makeSnapshot(snapshotOverrides)}
      targetProfit={5}
      targetROAS={4}
      onTargetProfitChange={handlers.onTargetProfitChange ?? (() => {})}
      onTargetROASChange={handlers.onTargetROASChange ?? (() => {})}
      isPending={false}
    />
  );
}

describe('ReverseCalculatorCards', () => {
  it('shows break-even price with no input of its own', () => {
    renderCards({ breakEvenPrice: 41.5 });
    expect(screen.getByText('$41.50')).toBeDefined();
    // Break-even is an output, so it must not be editable.
    expect(screen.getAllByRole('spinbutton').length).toBe(2);
  });

  it('suggests the price needed for a target profit', () => {
    const { container } = renderCards({
      reverse: {
        targetProfitInput: 5,
        targetProfitPrice: 50,
        targetProfitAchievable: true,
        targetROAS: 4,
        maxCPA: 25,
      },
    });
    expect(container.textContent).toContain('$50.00');
    expect(container.textContent).toContain('$5.00');
  });

  it('says a target is unreachable instead of printing a zero price', () => {
    const { container } = renderCards({
      reverse: {
        targetProfitInput: 9999,
        targetProfitPrice: 0,
        targetProfitAchievable: false,
        targetROAS: 4,
        maxCPA: 0,
      },
    });
    expect(container.textContent).toContain('not reachable at any price');
    expect(container.textContent).not.toContain('Sell at $0.00');
  });

  it('reports the max CPA for a target ROAS', () => {
    const { container } = renderCards();
    expect(container.textContent).toContain('$25.00');
    expect(container.textContent).toContain('4x ROAS');
  });

  it('explains a zero max CPA as no room for ad spend', () => {
    const { container } = renderCards({
      reverse: {
        targetProfitInput: 5,
        targetProfitPrice: 50,
        targetProfitAchievable: true,
        targetROAS: 4,
        maxCPA: 0,
      },
    });
    expect(container.textContent).toContain('no room for ad spend');
  });

  it('reports target profit and ROAS edits to the parent', () => {
    const onTargetProfitChange = vi.fn();
    const onTargetROASChange = vi.fn();
    renderCards({}, { onTargetProfitChange, onTargetROASChange });

    fireEvent.change(screen.getByLabelText('Target profit price'), { target: { value: '12' } });
    expect(onTargetProfitChange).toHaveBeenCalledWith(12);

    fireEvent.change(screen.getByLabelText('Max CPA'), { target: { value: '3' } });
    expect(onTargetROASChange).toHaveBeenCalledWith(3);
  });

  it('reports a cleared field as zero rather than NaN', () => {
    const onTargetProfitChange = vi.fn();
    renderCards({}, { onTargetProfitChange });
    fireEvent.change(screen.getByLabelText('Target profit price'), { target: { value: '' } });
    expect(onTargetProfitChange).toHaveBeenCalledWith(0);
  });

  it('announces a pending refresh', () => {
    render(
      <ReverseCalculatorCards
        snapshot={makeSnapshot()}
        targetProfit={5}
        targetROAS={4}
        onTargetProfitChange={() => {}}
        onTargetROASChange={() => {}}
        isPending
      />
    );
    expect(screen.getByRole('status').textContent).toContain('Updating reverse calculations');
  });
});
