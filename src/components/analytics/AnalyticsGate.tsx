'use client';

import {
  analyticsPermitted,
  type AnalyticsConsent,
} from '@/lib/consent/consent';
import { createMonitoringConfig, getAnalyticsConfig, type AnalyticsProvider } from '@/lib/monitoring/config';

import { useAnalyticsConsent } from './useAnalyticsConsent';
import { GA4 } from './GA4';
import { VercelAnalytics } from './VercelAnalytics';

function Tracker({ provider }: { provider: AnalyticsProvider }) {
  if (provider === 'vercel') return <VercelAnalytics />;
  // The remaining providers are representable in the config but have no tracker
  // component wired up. Returning null is deliberate: a provider without an
  // implementation must fail closed rather than fall through to something else.
  return null;
}

export function AnalyticsGate() {
  const { analytics } = createMonitoringConfig(getAnalyticsConfig());

  const { consent } = useAnalyticsConsent();

  const runtimeConsent: AnalyticsConsent | null =
    consent.status === 'accepted' || consent.status === 'declined' ? consent.status : null;

  if (!analyticsPermitted(analytics.enabled, runtimeConsent)) return null;
  return (
    <>
      <Tracker provider={analytics.provider} />
      <GA4 />
    </>
  );
}