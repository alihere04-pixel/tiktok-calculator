'use client';

import { createMonitoringConfig, type CreateMonitoringConfigEnv } from '@/lib/monitoring/config';
import {
  RUNTIME_ANALYTICS_PROVIDER,
  RUNTIME_ANALYTICS_DOMAIN,
  RUNTIME_CONSENT_GATE,
  RUNTIME_ERROR_DSN,
} from '@/lib/monitoring/runtime-config';

import { useAnalyticsConsent } from './useAnalyticsConsent';

const PROVIDER = RUNTIME_ANALYTICS_PROVIDER;
const DOMAIN = RUNTIME_ANALYTICS_DOMAIN?.trim() || null;
const CONSENT_GATE = RUNTIME_CONSENT_GATE === 'true';
const DSN = RUNTIME_ERROR_DSN?.trim() || null;

const env: CreateMonitoringConfigEnv = { provider: PROVIDER, domain: DOMAIN, consentGate: CONSENT_GATE, dsn: DSN };

const { analytics } = createMonitoringConfig(env);

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
 * the calculator, so `role="region"` with a label is honest. It is also rendered
 * as the first thing in `<body>` so it comes early in the tab order rather than
 * after the whole calculator.
 */
export function ConsentBanner() {
  const { consent, decide } = useAnalyticsConsent();

  if (!analytics.enabled) return null;
  // `pending` means this is the server-rendered or pre-hydration render.
  // `unknown` means no decision stored yet. We show the banner for both
  // so the question appears on first paint and after hydration.
  // Only hide after an explicit accept/decline.
  if (consent.status === 'accepted' || consent.status === 'declined') return null;

  return (
    <section
      role="region"
      aria-labelledby="analytics-consent-heading"
      aria-describedby="analytics-consent-description"
      className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2
        id="analytics-consent-heading"
        className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
      >
        Can we use analytics?
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
          onClick={() => decide('accepted')}
          className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:outline-zinc-50"
        >
          Accept analytics
        </button>
        <button
          type="button"
          onClick={() => decide('declined')}
          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-50"
        >
          Decline
        </button>
      </div>
    </section>
  );
}
