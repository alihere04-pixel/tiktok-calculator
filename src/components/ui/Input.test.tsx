import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Input } from './Input';

afterEach(cleanup);

/**
 * The currency prefix is absolutely positioned at `left-3` (0.75rem), so the
 * input must reserve enough left padding to clear the prefix text. `pl-7`
 * (1.75rem) was not enough and the amount overlapped the symbol; `pl-10`
 * (2.5rem) is.
 */
describe('Input prefix padding', () => {
  it('reserves sufficient left padding for the prefix', () => {
    render(<Input label="Amount" prefix="USD" defaultValue="100" />);
    const input = screen.getByLabelText('Amount');

    expect(screen.getByText('USD')).toBeTruthy();
    expect(input.classList.contains('pl-10')).toBe(true);
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

    expect(input.classList.contains('pl-10')).toBe(false);
    expect(input.classList.contains('pl-7')).toBe(false);
  });

  it('keeps suffix padding independent of prefix padding', () => {
    render(<Input label="Amount" prefix="USD" suffix="/mo" />);
    const input = screen.getByLabelText('Amount');

    expect(input.classList.contains('pl-10')).toBe(true);
    expect(input.classList.contains('pr-10')).toBe(true);
  });
});