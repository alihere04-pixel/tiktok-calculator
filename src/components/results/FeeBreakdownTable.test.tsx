import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FeeBreakdownTable } from './FeeBreakdownTable';
import { makeFee, makeSnapshot } from '@/test/snapshot-fixture';

afterEach(cleanup);

const FEES = [
  makeFee({
    name: 'Referral Fee',
    rate: '6.0%',
    base: 100,
    amount: 6,
    notes: 'Standard referral fee on (Customer Payment + Platform Discount - Tax)',
  }),
  makeFee({
    name: 'Refund Admin Fee (modeled)',
    rate: '20% of referral fee, capped $5/SKU',
    base: 6,
    amount: 0.6,
    confidence: 'needs-verification',
    sourceUrl: 'https://seller-us.tiktok.com/university/essay?knowledge_id=5982454398175018',
  }),
];

function renderTable(fees = FEES) {
  return render(
    <FeeBreakdownTable snapshot={makeSnapshot({ fees, totalPlatformFees: 6.6 })} />
  );
}

describe('FeeBreakdownTable', () => {
  it('lists every engine fee with its rate, base and amount', () => {
    const { container } = renderTable();
    expect(screen.getByText('Referral Fee')).toBeDefined();
    expect(screen.getByText('Refund Admin Fee (modeled)')).toBeDefined();
    expect(screen.getByText('6.0%')).toBeDefined();
    // Base column: 100.00 for the referral fee.
    expect(screen.getByText('$100.00')).toBeDefined();
    // $6.00 legitimately appears twice: as the refund fee's base (20% of a
    // $6.00 referral fee) and as the referral fee's own amount.
    expect(screen.getAllByText('$6.00').length).toBe(2);
    // The refund fee's own amount.
    expect(screen.getByText('$0.60')).toBeDefined();
    // Footnote total: 6.00 + 0.60.
    expect(screen.getByText('$6.60')).toBeDefined();
    expect(container.textContent).toContain('Total platform fees');
  });

  it('sums to the engine total', () => {
    renderTable();
    expect(screen.getByText('Total platform fees')).toBeDefined();
    expect(screen.getByText('$6.60')).toBeDefined();
  });

  it('uses a real table with a caption and column scopes', () => {
    const { container } = renderTable();
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('caption')?.textContent).toContain('Fee breakdown');
    expect(container.querySelectorAll('th[scope="col"]').length).toBe(6);
  });

  it('expands a row to reveal the audit trail and collapses it again', () => {
    const { container } = renderTable();
    const firstToggle = screen.getAllByRole('button', { name: 'Show' })[0];

    expect(firstToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('Official source');

    fireEvent.click(firstToggle);

    const expanded = screen.getAllByRole('button', { name: 'Hide' })[0];
    expect(expanded.getAttribute('aria-expanded')).toBe('true');
    const detail = container.querySelector('#fee-detail-0');
    expect(detail).not.toBeNull();
    expect(detail?.textContent).toContain('Standard referral fee');
    expect(detail?.textContent).toContain('Last verified');
    expect(detail?.textContent).toContain('Effective from');

    fireEvent.click(expanded);
    expect(screen.getAllByRole('button', { name: 'Show' })[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the expanded panel tied to its toggle via aria-controls', () => {
    renderTable();
    const toggle = screen.getAllByRole('button', { name: 'Show' })[0];
    expect(toggle.getAttribute('aria-controls')).toBe('fee-detail-0');
  });

  it('expands rows independently', () => {
    renderTable();
    fireEvent.click(screen.getAllByRole('button', { name: 'Show' })[1]);
    // Only the second fee's detail is present.
    expect(screen.getByText('Official source')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Show' })).toBeDefined();
  });

  it('links every fee to an official source in a new tab', () => {
    renderTable();
    const links = screen.getAllByRole('link', { name: /Official source for/ });
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(links[0].getAttribute('href')).toContain('seller-us.tiktok.com');
  });

  it('shows a confidence badge on every row', () => {
    const { container } = renderTable();
    expect(screen.getByText('High confidence')).toBeDefined();
    expect(screen.getByText('Needs verification')).toBeDefined();
    expect(container.querySelectorAll('[title="Needs verification"]').length).toBeGreaterThan(0);
  });

  it('explains an empty market instead of rendering an empty table', () => {
    const { container } = renderTable([]);
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).toContain('No platform fees apply');
  });
});
