'use client';

import { Analytics } from '@vercel/analytics/next';
import {
  analyticsPermitted,
  type AnalyticsConsent,
} from '@/lib/consent/consent';
import { createMonitoringConfig, type CreateMonitoringConfigEnv, type AnalyticsProvider } from '@/lib/monitoring/config';

import { useAnalyticsConsent } from './useAnalyticsConsent';

interface AnalyticsGateProps {
  config?: {
    provider?: string;
    domain?: string;
    consentGate?: string;
  };
}

function Tracker({ provider }: { provider: AnalyticsProvider }) {
  if (provider === 'vercel') return <Analytics />;
  // The remaining providers are representable in the config but have no tracker
  // component wired up. Returning null is deliberate: a provider without an
  // implementation must fail closed rather than fall through to something else.
  return null;
}

export function AnalyticsGate({ config }: AnalyticsGateProps) {
  const PROVIDER = config?.provider ?? 'none';
  const DOMAIN = (config?.domain ?? '').trim() || null;
  const CONSENT_GATE = config?.consentGate === 'true';

  const env: CreateMonitoringConfigEnv = { provider: PROVIDER, domain: DOMAIN, consentGate: CONSENT_GATE, dsn: null };

  const { analytics } = createMonitoringConfig(env);

  const { consent } = useAnalyticsConsent();

  const runtimeConsent: AnalyticsConsent | null =
    consent.status === 'accepted' || consent.status === 'declined' ? consent.status : null;

  if (!analyticsPermitted(analytics.enabled, runtimeConsent)) return null;
  return <Tracker provider={analytics.provider} />;
}
