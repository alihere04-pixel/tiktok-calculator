'use client';

import { useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import type { ReactNode } from 'react';

/**
 * Client-side filter for the category table.
 *
 * The table arrives as `children` from `CategoryRateTableLazy`, which renders
 * it on the client only, so this component and the table hydrate together. The
 * filter still works by reading the DOM rather than React state: the rows carry
 * their searchable text in a `data-search` attribute and nothing is hidden
 * until the reader actually types.
 *
 * Matching is a case-insensitive substring test against the parent category and
 * the sub-category name together, so "beauty" finds every sub-category under
 * Beauty & Personal Care and not just one whose own name happens to contain it.
 */
export function CategoryTableFilter({ children }: { children: ReactNode }) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function onChange(next: string) {
    setQuery(next);

    const trimmed = next.trim().toLowerCase();
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const rows = wrapper.querySelectorAll<HTMLTableRowElement>('tr[data-search]');

    if (trimmed === '') {
      // An empty box means "no filter". `null` keeps the count hidden so the
      // live region is silent until the reader has actually searched.
      for (const row of rows) row.hidden = false;
      setVisible(null);
      return;
    }

    let count = 0;
    for (const row of rows) {
      const haystack = (row.dataset.search ?? '').toLowerCase();
      const matches = haystack.includes(trimmed);
      row.hidden = !matches;
      if (matches) count += 1;
    }
    setVisible(count);
  }

  return (
    <div>
      <div className="mb-3 max-w-sm">
        <Input
          id={inputId}
          label="Search categories"
          hideLabel
          type="search"
          placeholder="Search categories..."
          value={query}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
        />
      </div>

      <p aria-live="polite" className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
        {visible === null
          ? ''
          : visible === 0
            ? 'No results'
            : `${visible} ${visible === 1 ? 'category' : 'categories'} match`}
      </p>

      <div ref={wrapperRef}>{children}</div>
    </div>
  );
}
