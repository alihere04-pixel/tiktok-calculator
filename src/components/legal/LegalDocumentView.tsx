import Link from 'next/link';
import type { LegalDocument, LegalSlug } from '@/lib/legal/content';
import { formatIsoDate } from '@/lib/seo/format';

/**
 * Shared shell for the three legal pages.
 *
 * One component rather than three near-identical pages, so the heading
 * structure, the table of contents and the "these are drafts" notice cannot
 * drift apart between them.
 *
 * The documents are rendered from a plain data structure, which means the whole
 * page is static HTML: the text is present with JavaScript disabled, which is
 * the only way a policy page is worth anything to a regulator or a user's
 * browser extension.
 */
export function LegalDocumentView({
  document,
  allDocuments,
}: {
  document: LegalDocument;
  allDocuments: LegalDocument[];
}) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-semibold text-zinc-900 sm:text-3xl dark:text-zinc-50">
            {document.title}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{document.summary}</p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
            Last reviewed: {formatIsoDate(document.updated)}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8 sm:px-6">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Draft for review.</strong> This page was written by a developer, not by a
          lawyer, and has not been reviewed by one. Values that identify the operating entity
          are still placeholders. Do not treat this as a final legal document.
        </p>

        <nav aria-label="Legal pages">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Legal pages</h2>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {allDocuments.map((doc) => (
              <li key={doc.slug}>
                <Link href={`/${doc.slug}`} className="underline underline-offset-2">
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {document.sections.map((section) => (
          <section key={section.id} aria-labelledby={section.id}>
            <h2
              id={section.id}
              className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {section.heading}
            </h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul className="list-disc space-y-1 pl-5">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </main>

      <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 text-sm sm:px-6">
          <p className="text-zinc-600 dark:text-zinc-400">
            An independent tool. Not affiliated with TikTok.
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/" className="underline underline-offset-2 dark:text-zinc-200">
              Profit calculator
            </Link>
            {allDocuments.map((doc) => (
              <Link
                key={doc.slug}
                href={`/${doc.slug}` as `/${LegalSlug}`}
                className="underline underline-offset-2 dark:text-zinc-200"
              >
                {doc.title}
              </Link>
            ))}
          </p>
        </div>
      </footer>
    </div>
  );
}
