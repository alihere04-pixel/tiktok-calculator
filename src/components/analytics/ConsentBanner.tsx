'use client';

import { useEffect, useState } from 'react';
import { createMonitoringConfig, getAnalyticsConfig } from '@/lib/monitoring/config';

import { useAnalyticsConsent } from './useAnalyticsConsent';

/**
 * Real user consent for analytics.
 *
 * This is the banner `NEXT_PUBLIC_CONSENT_GATE` was only ever a proxy for. That
 * flag is a deploy-time setting that says "a consent mechanism exists in this
 * codebase"; this component is the mechanism itself, and the answer it records is
 * per browser, per visitor.
 *
 * Two rules the markup has to keep:
 *
 *   1. Nothing is asked unless analytics is actually capable of loading. Prompting
 *      someone to accept a tracker that is switched off is asking for consent
 *      that cannot be used, which trains people to click through banners.
 *   2. Nothing is remembered until the visitor answers, so the default state is
 *      always "no decision", which the gate treats as "no".
 *
 * The buttons are native `<button>` elements on purpose. That is what makes them
 * reachable by Tab and activatable by Enter and Space without any key handling of
 * our own, and it is why the keyboard tests can assert on the element type rather
 * than on a simulated keypress.
 *
 * This is a page region, not a modal: it does not trap focus and does not block
 * the calculator, so `role="region"` with a label is honest. It renders at the
 * top of `<body>` so it comes early in the tab order.
 */
export function ConsentBanner() {
  const { analytics } = createMonitoringConfig(getAnalyticsConfig());
  const { consent, decide } = useAnalyticsConsent();

  // Track client-side mount to avoid SSR mismatch.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!analytics.enabled) return null;
  // Only show for fresh visitors who have not made a decision.
  // When consent is accepted or declined, don't render anything (not even placeholder).
  if (consent.status === 'accepted' || consent.status === 'declined') return null;

  // Always render the same DOM structure to avoid hydration mismatch.
  // Server: hidden=true, buttons disabled
  // Client before mount: hidden=true, buttons disabled
  // Client after mount: hidden=false, buttons enabled
  const isHidden = !mounted;
  const isDisabled = !mounted;

  return (
    <section
      role="region"
      aria-labelledby="analytics-consent-heading"
      aria-describedby="analytics-consent-description"
      className={`rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${isHidden ? 'hidden' : ''}`}
    >
      <h2
        id="analytics-consent-heading"
        className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
      >
        Can we use analytics and advertising?
      </h2>

      <p
        id="analytics-consent-description"
        className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400"
      >
        We would like to use Vercel Web Analytics to count visits and see which
        pages are useful. It does not sell your data, and it does not change the
        numbers on this site. Nothing is loaded until you choose, and declining
        will not be asked again.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={isDisabled ? undefined : () => decide('accepted')}
          className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:outline-zinc-50"
          disabled={isDisabled}
        >
          Accept analytics
        </button>
        <button
          type="button"
          onClick={isDisabled ? undefined : () => decide('declined')}
          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-50"
          disabled={isDisabled}
        >
          Decline
        </button>
      </div>
    </section>
  );
}