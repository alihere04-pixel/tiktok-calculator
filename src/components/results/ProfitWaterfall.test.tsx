import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ProfitWaterfall } from './ProfitWaterfall';
import { makeInputs, makeSnapshot } from '@/test/snapshot-fixture';

afterEach(cleanup);

const INPUTS = makeInputs({
  sellingPrice: 100,
  cogs: 30,
  outboundShipping: 5,
  cpa: 10,
  customerShipping: 0,
});

const SNAPSHOT = makeSnapshot({
  totalPlatformFees: 6,
  netProfit: 49,
});

describe('ProfitWaterfall', () => {
  it('walks the price through every deduction in the PRD order', () => {
    render(<ProfitWaterfall snapshot={SNAPSHOT} inputs={INPUTS} />);
    expect(screen.getByText('Selling price')).toBeDefined();
    expect(screen.getByText('− Platform fees')).toBeDefined();
    expect(screen.getByText('− COGS')).toBeDefined();
    expect(screen.getByText('− Outbound shipping')).toBeDefined();
    expect(screen.getByText('− Ad spend')).toBeDefined();
    expect(screen.getByText('= Net profit')).toBeDefined();
  });

  it('shows each amount and its share of the selling price', () => {
    const { container } = render(<ProfitWaterfall snapshot={SNAPSHOT} inputs={INPUTS} />);
    const text = container.textContent ?? '';
    expect(text).toContain('$100.00');
    expect(text).toContain('$6.00');
    expect(text).toContain('$30.00');
    expect(text).toContain('$5.00');
    expect(text).toContain('$10.00');
    // 6% of 100, 30% of 100, 5% of 100, 10% of 100
    expect(text).toContain('6.0%');
    expect(text).toContain('30.0%');
    expect(text).toContain('5.0%');
    expect(text).toContain('10.0%');
  });

  it('reconciles with the engine: price minus deductions equals the snapshot profit', () => {
    // 100 - 6 - 30 - 5 - 10 = 49, which is what the engine reported.
    const { container } = render(<ProfitWaterfall snapshot={SNAPSHOT} inputs={INPUTS} />);
    expect(container.textContent).toContain('$49.00');
    expect(INPUTS.sellingPrice - 6 - INPUTS.cogs - INPUTS.outboundShipping - INPUTS.cpa).toBe(
      SNAPSHOT.netProfit
    );
  });

  it('renders nothing when there is no selling price to scale against', () => {
    const { container } = render(
      <ProfitWaterfall snapshot={SNAPSHOT} inputs={makeInputs({ sellingPrice: 0 })} />
    );
    expect(container.textContent).toBe('');
  });

  it('explains the rescale when costs exceed the price', () => {
    const { container } = render(
      <ProfitWaterfall
        snapshot={makeSnapshot({ netProfit: -40, totalPlatformFees: 120 })}
        inputs={makeInputs({ sellingPrice: 100, cogs: 10, outboundShipping: 5, cpa: 5 })}
      />
    );
    expect(container.textContent).toContain('costs exceed the selling price');
  });

  it('notes that customer-paid shipping is not a seller cost, only when it is set', () => {
    const withoutIt = render(<ProfitWaterfall snapshot={SNAPSHOT} inputs={INPUTS} />);
    expect(withoutIt.container.textContent).not.toContain('Shipping charged to the customer');
    cleanup();

    const withIt = render(
      <ProfitWaterfall snapshot={SNAPSHOT} inputs={makeInputs({ ...INPUTS, customerShipping: 4 })} />
    );
    expect(withIt.container.textContent).toContain('Shipping charged to the customer');
  });

  it('keeps the coloured bar out of the accessibility tree', () => {
    const { container } = render(<ProfitWaterfall snapshot={SNAPSHOT} inputs={INPUTS} />);
    const bar = container.querySelector('[aria-hidden="true"]');
    expect(bar).not.toBeNull();
  });

  it('omits zero-value bars but still lists them', () => {
    const { container } = render(
      <ProfitWaterfall
        snapshot={makeSnapshot({ totalPlatformFees: 0, netProfit: 65 })}
        inputs={makeInputs({ sellingPrice: 100, cogs: 30, outboundShipping: 5, cpa: 0 })}
      />
    );
    // 100 - 0 - 30 - 5 - 0 = 65
    expect(container.textContent).toContain('$65.00');
    expect(screen.getByText('− Ad spend')).toBeDefined();
  });
});
