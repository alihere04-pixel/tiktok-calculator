import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Input } from './Input';

afterEach(cleanup);

/**
 * The currency prefix is absolutely positioned at `left-3` (0.75rem), so the
 * input must reserve enough left padding to clear the prefix text.
 *
 * Every currency the calculator supports (USD, MYR, GBP, SGD, PHP) is three
 * characters and renders roughly 28px wide at `text-sm`, so it ends near x=40px.
 * `pl-7` (1.75rem) let the digits overlap it, and `pl-10` (2.5rem) only just
 * cleared it. `pl-12` (3rem) leaves a real gap for all five codes.
 */
describe('Input prefix padding', () => {
  it('reserves sufficient left padding for the prefix', () => {
    render(<Input label="Amount" prefix="USD" defaultValue="100" />);
    const input = screen.getByLabelText('Amount');

    expect(screen.getByText('USD')).toBeTruthy();
    expect(input.classList.contains('pl-12')).toBe(true);
    expect(input.classList.contains('pl-7')).toBe(false);
  });

  it('positions the prefix at left-3', () => {
    render(<Input label="Amount" prefix="USD" />);
    const prefix = screen.getByText('USD');

    expect(prefix.classList.contains('absolute')).toBe(true);
    expect(prefix.classList.contains('left-3')).toBe(true);
  });

  it('does not add prefix padding when there is no prefix', () => {
    render(<Input label="Amount" defaultValue="100" />);
    const input = screen.getByLabelText('Amount');

    expect(input.classList.contains('pl-12')).toBe(false);
    expect(input.classList.contains('pl-7')).toBe(false);
  });

  it('keeps suffix padding independent of prefix padding', () => {
    render(<Input label="Amount" prefix="USD" suffix="/mo" />);
    const input = screen.getByLabelText('Amount');

    expect(input.classList.contains('pl-12')).toBe(true);
    expect(input.classList.contains('pr-10')).toBe(true);
  });

  it('leaves a real gap between a three-letter code and the amount', () => {
    // Encodes the arithmetic behind the padding choice, so a revert to a
    // tighter class fails here rather than shipping as a visual regression.
    // Values are the real rendered sizes at `text-sm` (0.875rem).
    const PREFIX_OFFSET_PX = 12; // left-3
    const THREE_CHAR_CODE_PX = 28; // 'MYR' / 'USD' / 'GBP' / 'SGD' / 'PHP'
    const MIN_GAP_PX = 8;
    const PADDING_PX: Record<string, number> = { 'pl-7': 28, 'pl-10': 40, 'pl-12': 48 };

    render(<Input label="Amount" prefix="MYR" defaultValue="100" />);
    const input = screen.getByLabelText('Amount');

    const applied = Object.keys(PADDING_PX).find((cls) => input.classList.contains(cls));
    expect(applied, 'a prefix padding class must be applied').toBeDefined();
    const paddingPx = applied ? PADDING_PX[applied] : 0;
    const gapPx = paddingPx - (PREFIX_OFFSET_PX + THREE_CHAR_CODE_PX);

    // pl-7 gives -12px (overlap) and pl-10 gives 0px, which is why the amount
    // looked glued to the code. Only a class that leaves a real gap passes.
    expect(gapPx).toBeGreaterThanOrEqual(MIN_GAP_PX);
  });

  it('clears every supported currency code', () => {
    for (const code of ['USD', 'MYR', 'GBP', 'SGD', 'PHP']) {
      const { unmount } = render(<Input label="Amount" prefix={code} defaultValue="100" />);
      const input = screen.getByLabelText('Amount');
      expect(input.classList.contains('pl-12'), code).toBe(true);
      unmount();
    }
  });
});