import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CalculationErrorState } from './CalculationErrorState';

afterEach(cleanup);

describe('CalculationErrorState', () => {
  it('is announced as an alert', () => {
    render(<CalculationErrorState errors={['sellingPrice must be greater than 0']} />);
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('lists every validation message verbatim', () => {
    render(
      <CalculationErrorState
        errors={['categoryId is required and must be a non-empty string', 'sellingPrice must be greater than 0']}
      />
    );
    expect(screen.getByText('categoryId is required and must be a non-empty string')).toBeDefined();
    expect(screen.getByText('sellingPrice must be greater than 0')).toBeDefined();
  });

  it('uses the singular form for one problem and the plural for many', () => {
    const one = render(<CalculationErrorState errors={['only one problem']} />);
    expect(one.container.textContent).toContain('Fix this');
    cleanup();

    const many = render(<CalculationErrorState errors={['first', 'second']} />);
    expect(many.container.textContent).toContain('Fix these 2 things');
  });

  it('offers no dismiss button when the handler is absent', () => {
    render(<CalculationErrorState errors={['boom']} />);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('dismisses on click when a handler is given', () => {
    const onDismiss = vi.fn();
    render(<CalculationErrorState errors={['boom']} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
