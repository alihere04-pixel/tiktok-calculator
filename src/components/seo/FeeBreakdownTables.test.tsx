import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import {
  CategoryExceptionList,
  CategoryRateTable,
  FeeLineTable,
  KnownRangeList,
  TierNotes,
} from './FeeBreakdownTables';
import type { FeeLine } from '@/lib/seo/format';
import type { CategoryRateRow, CategoryExceptionRow } from '@/lib/seo/market-pages';

afterEach(cleanup);

const ROWS: CategoryRateRow[] = [
  { id: 'a', name: 'Fashion Accessories', rateLabel: '7%', secondaryRateLabel: 'Mall 8.1%', tier: 'Marketplace', confidence: 'high' },
  { id: 'b', name: 'Jewellery', rateLabel: '6.9%', confidence: 'medium' },
];

describe('CategoryRateTable', () => {
  it('renders a real table with a caption and header cells', () => {
    render(<CategoryRateTable rows={ROWS} currency="PHP" />);
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText(/Commission rate by category, in PHP/)).toBeTruthy();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Category',
      'Rate',
      'Confidence',
    ]);
  });

  it('uses row headers so each rate is associated with its category', () => {
    render(<CategoryRateTable rows={ROWS} currency="PHP" />);
    const row = screen.getByRole('row', { name: /Fashion Accessories/ });
    expect(within(row).getByRole('rowheader')).toBeTruthy();
    expect(within(row).getByText('7%')).toBeTruthy();
  });

  it('shows the secondary Mall rate inline rather than as a separate exception', () => {
    render(<CategoryRateTable rows={ROWS} currency="PHP" />);
    expect(screen.getByText('Mall 8.1%')).toBeTruthy();
  });

  it('shows the seller tier under the category name', () => {
    render(<CategoryRateTable rows={ROWS} currency="PHP" />);
    expect(screen.getByText('Marketplace')).toBeTruthy();
  });

  it('exposes confidence as text, not colour alone', () => {
    render(<CategoryRateTable rows={ROWS} currency="PHP" />);
    // The badge is visually empty on purpose, so the level is announced.
    expect(screen.getByText('high')).toBeTruthy();
    expect(screen.getByText('medium')).toBeTruthy();
  });

  it('handles an empty rate list without rendering a broken table', () => {
    render(<CategoryRateTable rows={[]} currency="USD" />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('No category rates published.')).toBeTruthy();
  });

  it('gives every row its searchable text, for the UK search box', () => {
    render(
      <CategoryRateTable
        rows={[
          {
            id: 'uk-beauty-and-personal-care-accessories',
            name: 'Accessories',
            parentLabel: 'Beauty & Personal Care',
            rateLabel: '5%',
            confidence: 'high',
          },
        ]}
        currency="GBP"
        showParentLabel
      />
    );

    const row = screen.getByRole('row', { name: /Accessories/ });
    // Parent and sub-category together, so a search for either one finds it.
    expect(row.getAttribute('data-search')).toBe('beauty & personal care accessories');
  });

  it('prints the parent category above the sub-category only when asked', () => {
    // ROWS[0] is the PH fixture, whose name is already the full category. This
    // uses a UK-shaped row, where the name is only a sub-category.
    const ukRow: CategoryRateRow = {
      id: 'uk-beauty-and-personal-care-accessories',
      name: 'Accessories',
      parentLabel: 'Beauty & Personal Care',
      rateLabel: '5%',
      confidence: 'high',
    };

    const { unmount } = render(<CategoryRateTable rows={[ukRow]} currency="GBP" />);
    // Off by default, so the four smaller market tables are unchanged.
    expect(screen.getByRole('row', { name: /Accessories/ }).textContent).not.toContain(
      'Beauty & Personal Care'
    );
    unmount();

    render(<CategoryRateTable rows={[ukRow]} currency="GBP" showParentLabel />);
    expect(screen.getByRole('row', { name: /Accessories/ }).textContent).toContain(
      'Beauty & Personal Care'
    );
  });
});

const LINES: FeeLine[] = [
  {
    label: 'Platform Support Fee',
    value: { kind: 'perOrderAmount', amount: 0.54, currency: 'MYR' },
    confidence: 'high',
    effectiveFrom: '2026-02-15',
  },
  {
    label: 'Dynamic Commission',
    value: { kind: 'range', rateRange: '4.00% - 6.00%' },
    details: ['Capped at RM 650,000.00 per item'],
    confidence: 'medium',
  },
  {
    label: 'Transaction fee',
    value: { kind: 'percentage', rate: 0.0378 },
    base: 'Customer Payment',
    taxInclusive: true,
    confidence: 'high',
  },
];

describe('FeeLineTable', () => {
  it('renders each fee in the right shape rather than flattening them to percentages', () => {
    render(<FeeLineTable lines={LINES} caption="Fees in MYR." />);
    expect(screen.getByText('RM 0.54 per order')).toBeTruthy();
    expect(screen.getByText('4.00% - 6.00%')).toBeTruthy();
    expect(screen.getByText('3.780%')).toBeTruthy();
    // Nothing here should read as "54%".
    expect(screen.queryByText('54%')).toBeNull();
  });

  it('shows the per-item cap as a detail', () => {
    render(<FeeLineTable lines={LINES} caption="Fees in MYR." />);
    expect(screen.getByText('Capped at RM 650,000.00 per item')).toBeTruthy();
  });

  it('shows the fee base and whether tax is included', () => {
    render(<FeeLineTable lines={LINES} caption="Fees in MYR." />);
    expect(screen.getByText(/Base: Customer Payment \(tax inclusive\)/)).toBeTruthy();
  });

  it('formats the effective date and dashes when absent', () => {
    render(<FeeLineTable lines={LINES} caption="Fees in MYR." />);
    expect(screen.getByText('February 15, 2026')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBe(2);
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(<FeeLineTable lines={[]} caption="Fees." />);
    expect(container.firstChild).toBeNull();
  });
});

const EXCEPTIONS: CategoryExceptionRow[] = [
  { category: 'Cultural Items', detail: 'Any portion of the sale over $10K, 3%', confidence: 'high' },
];

describe('CategoryExceptionList', () => {
  it('pairs each exception with its category', () => {
    render(<CategoryExceptionList rows={EXCEPTIONS} />);
    expect(screen.getByText('Cultural Items')).toBeTruthy();
    expect(screen.getByText('Any portion of the sale over $10K, 3%')).toBeTruthy();
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(<CategoryExceptionList rows={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('TierNotes', () => {
  it('renders each note as a list item', () => {
    const { container } = render(<TierNotes notes={['BXP: 5.45%', 'Standard: 8.175%']} />);
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(<TierNotes notes={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('KnownRangeList', () => {
  it('shows the key and the published range', () => {
    render(<KnownRangeList ranges={[{ key: 'bxpMarketplace', label: '4.86% - 9.18%' }]} />);
    expect(screen.getByText('bxpMarketplace')).toBeTruthy();
    expect(screen.getByText(/4\.86% - 9\.18%/)).toBeTruthy();
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(<KnownRangeList ranges={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
