import type { FaqItem } from '@/lib/seo/market-pages';

/**
 * FAQ accordion.
 *
 * Built on native `<details>` / `<summary>` rather than a JS accordion. On a
 * statically generated page that matters for two reasons: the answers stay in
 * the HTML (so they are indexable and readable with JavaScript disabled), and
 * the open/close behaviour, the keyboard handling and the ARIA wiring come from
 * the browser instead of from state we would have to get right.
 *
 * Several questions can be open at once, which is what a reader comparing two
 * answers actually wants; a single-open accordion would close the answer they
 * are reading.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {items.map((item) => (
        <details key={item.question} className="group px-3 py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2.5 text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <span
              aria-hidden="true"
              className="shrink-0 text-lg leading-none text-zinc-500 transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="pb-3 text-sm text-zinc-600 dark:text-zinc-400">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
