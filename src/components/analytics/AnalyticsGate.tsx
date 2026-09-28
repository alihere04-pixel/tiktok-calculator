'use client';

import { Analytics } from '@vercel/analytics/next';
import { monitoringConfig, type AnalyticsProvider } from '@/lib/monitoring/config';

/**
 * Renders the analytics tracker only when the consent gate in
 * `lib/monitoring/config.ts` says it is allowed to.
 *
 * This component exists because the tracker used to be mounted unconditionally in
 * the root layout. That made the privacy page's claim that no analytics run on
 * this site false while the suite stayed green: the existing test only checked
 * that the sentence was present in the document, not that no tracker was
 * mounted. What this guards is a fact about rendered output, not a string.
 *
 * The script this gate withholds is not harmless. Vercel Web Analytics persists
 * an attribution identifier in localStorage under `__va_attribution` and
 * forwards a cross-origin Referer, so "off by default" has to be enforced by
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
  if (!analytics.enabled) return null;
  return <Tracker provider={analytics.provider} />;
}
