'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Route-level error boundary.
 *
 * Without this, an unhandled render error in production shows the visitor a
 * blank white page. With it, they get an explanation and a way to recover, and
 * the failure is reported to whatever monitor `@/lib/monitoring` has
 * configured.
 *
 * The boundary never renders the error message itself. A stack trace or an
 * internal message can leak file paths and data shapes, and it is not useful to
 * a seller. The digest is a safe, opaque identifier that can be quoted in a
 * support request.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportErrorToMonitor(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This page failed to load. The numbers on this site are read from static rate files, so a
          failure here is usually temporary.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Go to the calculator
          </Link>
        </div>

        {error.digest ? (
          <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-500">
            If you report this, quote reference{' '}
            <code className="font-mono">{error.digest}</code>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Sends the error to whatever monitor is configured.
 *
 * Deliberately dependency-free and inert by default: it reads an optional
 * `window.onerror`-style sink installed by a monitoring script, and otherwise
 * does nothing. See `@/lib/monitoring`. Logging to `console` is kept because a
 * developer running the site locally needs to see it.
 */
function reportErrorToMonitor(error: Error & { digest?: string }): void {
  if (typeof console !== 'undefined') {
    console.error('route error', error.digest ?? '(no digest)', error);
  }

  const sink = (globalThis as { __errorMonitor?: (e: unknown) => void }).__errorMonitor;
  if (typeof sink === 'function') {
    try {
      sink(error);
    } catch {
      // A failing monitor must never replace the user's error screen.
    }
  }
}
