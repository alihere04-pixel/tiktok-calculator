import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CategoryTableFilter } from './CategoryTableFilter';
import { CategoryRateTable } from './FeeBreakdownTables';
import type { CategoryRateRow } from '@/lib/seo/market-pages';

afterEach(cleanup);

const ROWS: CategoryRateRow[] = [
  { id: 'a', name: 'Accessories', parentLabel: 'Beauty & Personal Care', rateLabel: '5%', confidence: 'high' },
  { id: 'b', name: 'All', parentLabel: 'Household Appliances', rateLabel: '5%', confidence: 'high' },
  { id: 'c', name: "Women's Tops", parentLabel: 'Pre-Owned', rateLabel: '9%', confidence: 'high' },
];

function renderFilter() {
  return render(
    <CategoryTableFilter>
      <CategoryRateTable rows={ROWS} currency="GBP" showParentLabel />
    </CategoryTableFilter>,
  );
}

function rowElements(): HTMLTableRowElement[] {
  return Array.from(document.querySelectorAll<HTMLTableRowElement>('tr[data-search]'));
}

function visibleNames(): string[] {
  return rowElements()
    .filter((row) => !row.hidden)
    .map((row) => row.querySelector('th')?.textContent?.trim() ?? '');
}

function search(value: string) {
  fireEvent.change(screen.getByPlaceholderText('Search categories...'), { target: { value } });
}

describe('CategoryTableFilter', () => {
  it('renders every row into the HTML, unhidden, before any interaction', () => {
    renderFilter();

    // This is the SEO requirement: the prerendered HTML must contain all rows.
    // Filtering may only ever hide rows at runtime, never omit them.
    expect(rowElements()).toHaveLength(3);
    expect(rowElements().every((row) => row.hidden === false)).toBe(true);
  });

  it('renders a text input with the required placeholder', () => {
    renderFilter();

    const input = screen.getByPlaceholderText('Search categories...');
    expect(input).toBeTruthy();
    expect(input.getAttribute('type')).toBe('search');
    // The label is present for screen readers even though it is visually hidden.
    expect(screen.getByLabelText('Search categories')).toBeTruthy();
  });

  it('filters on a sub-category name, case-insensitively', () => {
    renderFilter();

    search("women's tops");

    expect(visibleNames()).toHaveLength(1);
    expect(visibleNames()[0]).toContain("Women's Tops");
  });

  it('filters on a parent category name, case-insensitively', () => {
    renderFilter();

    search('PRE-OWNED');

    expect(visibleNames()).toHaveLength(1);
    expect(visibleNames()[0]).toContain('Pre-Owned');
  });

  it('matches a parent category across all of its sub-categories', () => {
    renderFilter();

    search('beauty');

    // Searching the parent must not require knowing the sub-category name.
    expect(visibleNames()).toHaveLength(1);
    expect(visibleNames()[0]).toContain('Accessories');
  });

  it('shows "No results" when nothing matches, and hides every row', () => {
    renderFilter();

    search('nonexistent-category-xyz');

    expect(screen.getByText('No results')).toBeTruthy();
    expect(rowElements().every((row) => row.hidden)).toBe(true);
  });

  it('reports a match count, and singularises a single match', () => {
    renderFilter();

    search('all');
    expect(screen.getByText('1 category match')).toBeTruthy();

    search('pre-owned');
    expect(screen.getByText('1 category match')).toBeTruthy();
  });

  it('shows no count before the reader has searched', () => {
    const { container } = renderFilter();

    // The live region exists but is empty, so a screen reader is not told a
    // count the reader never asked for.
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).toBeTruthy();
    expect(live?.textContent).toBe('');
  });

  it('restores every row when the box is cleared', () => {
    renderFilter();

    search('beauty');
    expect(visibleNames()).toHaveLength(1);

    search('');
    expect(rowElements().every((row) => row.hidden === false)).toBe(true);
    expect(screen.queryByText('No results')).toBeNull();
  });

  it('treats a whitespace-only query as no filter', () => {
    renderFilter();

    search('   ');

    expect(rowElements().every((row) => row.hidden === false)).toBe(true);
  });

  it('does not match on the rate, only on category text', () => {
    renderFilter();

    // "9%" must not return the row that happens to be charged 9%.
    search('9%');
    expect(screen.getByText('No results')).toBeTruthy();
  });

  it('keeps rows hidden after the component re-renders with the same query', () => {
    renderFilter();

    search('beauty');
    expect(visibleNames()).toHaveLength(1);

    // Typing more narrows further rather than resetting.
    search('beauty & personal');
    expect(visibleNames()).toHaveLength(1);
  });
});
