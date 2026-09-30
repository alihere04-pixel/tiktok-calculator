'use client';

import { Analytics } from '@vercel/analytics/next';
import {
  analyticsPermitted,
  type AnalyticsConsent,
} from '@/lib/consent/consent';
import { monitoringConfig, type AnalyticsProvider } from '@/lib/monitoring/config';

import { useAnalyticsConsent } from './useAnalyticsConsent';

/**
 * Renders the analytics tracker only when the build-time configuration and the
 * visitor's own stored decision both allow it.
 *
 * This component exists because the tracker used to be mounted unconditionally in
 * the root layout. That made the privacy page's claim that no analytics run on
 * this site false while the suite stayed green: the existing test only checked
 * that the sentence was present in the document, not that no tracker was
 * mounted. What this guards is a fact about rendered output, not a string.
 *
 * Two independent gates, kept separate on purpose:
 *
 *   - `analytics.enabled` is the deploy-time configuration. It answers "is a
 *     tracker wired up on this build at all", not "did the visitor agree".
 *   - the visitor's stored choice answers the second question, per browser.
 *
 * `NEXT_PUBLIC_CONSENT_GATE` deliberately does not appear in the second gate. It
 * only records that a consent banner exists in this codebase, so treating it as
 * agreement would load the tracker for every first-time visitor before anyone was
 * asked. The real answer comes from `useAnalyticsConsent`.
 *
 * The consent state comes from an external store that reports `pending` on the
 * server, so this returns `null` during server rendering and on the first client
 * render alike. The tracker therefore cannot appear in the generated HTML of any
 * page at all, whatever the environment says.
 *
 * The script this gate withholds is not harmless. Vercel Web Analytics persists
 * an attribution identifier in localStorage under `__va_attribution` and
 * forwards a cross-origin Referer, so "off until accepted" has to be enforced by
 * the code rather than stated in a comment.
 *
 * `monitoringConfig()` is called during render rather than at module scope, so
 * the gate reflects the environment at the moment it is used and can be driven
 * from a test.
 */
function Tracker({ provider }: { provider: AnalyticsProvider }) {
  if (provider === 'vercel') return <Analytics />;
  // The remaining providers are representable in the config but have no tracker
  // component wired up. Returning null is deliberate: a provider without an
  // implementation must fail closed rather than fall through to something else.
  return null;
}

export function AnalyticsGate() {
  const { analytics } = monitoringConfig();
  const { consent } = useAnalyticsConsent();

  const runtimeConsent: AnalyticsConsent | null =
    consent.status === 'accepted' || consent.status === 'declined' ? consent.status : null;

  if (!analyticsPermitted(analytics.enabled, runtimeConsent)) return null;
  return <Tracker provider={analytics.provider} />;
}
