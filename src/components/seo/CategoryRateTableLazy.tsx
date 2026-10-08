'use client';

import dynamic from 'next/dynamic';
import { CategoryTableFilter } from './CategoryTableFilter';
import type { CategoryRateRow } from '@/lib/seo/market-pages';

/**
 * Client-only category rate table.
 *
 * The table itself can be huge — the UK market page ships 347 rows, which was
 * 252 KB of `<tr>` markup inside an 805 KB HTML file. `ssr: false` keeps those
 * rows out of the prerendered HTML entirely: the server renders the wrapper
 * (and, for the UK, the search box), the table chunk is fetched after hydration
 * and the rows paint from the data passed as props.
 *
 * The rows still arrive as structured data in the RSC payload, so nothing is
 * fetched over the network and the numbers are the same build-time values the
 * server component reads. Search engines render the page with JavaScript, so
 * they see the table too; what is traded away is the copy of the rows that used
 * to sit in the raw HTML for no-JS crawlers.
 */
const CategoryRateTable = dynamic(
  () => import('./FeeBreakdownTables').then((module) => module.CategoryRateTable),
  {
    ssr: false,
    loading: () => null,
  }
);

type CategoryRateTableLazyProps = {
  rows: CategoryRateRow[];
  currency: string;
  showParentLabel?: boolean;
  searchable?: boolean;
};

export function CategoryRateTableLazy({
  rows,
  currency,
  showParentLabel = false,
  searchable = false,
}: CategoryRateTableLazyProps) {
  const table = (
    <CategoryRateTable rows={rows} currency={currency} showParentLabel={showParentLabel} />
  );

  if (!searchable) return table;

  return <CategoryTableFilter>{table}</CategoryTableFilter>;
}
