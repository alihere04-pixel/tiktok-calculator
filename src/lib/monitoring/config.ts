/**
 * Monitoring and analytics configuration.
 *
 * Everything here is OFF unless the static JSON config turns it on. That is not
 * timidity, it is a legal requirement for part of this audience: the site serves
 * the UK, Singapore, Malaysia, the Philippines and the United States, so loading
 * an analytics or advertising tracker without prior consent engages UK GDPR and
 * the equivalent regimes. A tracker that ships on by default is a compliance
 * bug, not a missing feature.
 *
 * Enabling analytics therefore takes three deliberate steps, in this order:
 *
 *   1. Choose a consent-respecting provider. Do not use a tracker that reads
 *      anything before consent.
 *   2. Add a consent banner and block the script until the visitor opts in.
 *   3. Set the values in `analytics-config.json`.
 *
 * Error monitoring is different and much lighter: it is a first-party request to
 * our own endpoint carrying a digest and a stack, with no cookies, no
 * identifiers and no cross-site tracking. It is still off by default, because
 * even that should be a decision rather than an accident.
 *
 * `monitoringSummary()` is read by the launch checklist and the test suite, so
 * what is on and what is off is never a guess.
 */

/**
 * `vercel` is Vercel Web Analytics, which is the provider actually wired into
 * this app. It is gated, but it is NOT in `CONSENT_HOSTILE_PROVIDERS`: its
 * cookie is opt-in via `window.va("enableCookie")` and is off by default. What
 * it does do unconditionally is persist an attribution identifier in
 * localStorage under `__va_attribution` and forward a cross-origin Referer,
 * which is why it still requires consent and still stays off by default.
 */
export type AnalyticsProvider = 'none' | 'vercel' | 'plausible' | 'umami' | 'ga4';

export interface MonitoringConfig {
  analytics: {
    enabled: boolean;
    provider: AnalyticsProvider;
    domain: string | null;
    /** Set only once a consent banner is actually gating the script. */
    consentGated: boolean;
  };
  errorMonitoring: {
    enabled: boolean;
    dsn: string | null;
  };
}

export interface CreateMonitoringConfigEnv {
  provider: string;
  domain: string | null;
  consentGate: boolean;
  dsn: string | null;
}

interface AnalyticsConfigJson {
  provider: string;
  domain: string;
  consentGate: string;
}

import analyticsConfigJson from './analytics-config.json';

const analyticsConfig: AnalyticsConfigJson = analyticsConfigJson;

/** Providers that set their own cookie before consent. Not for an EU/UK launch. */
const CONSENT_HOSTILE_PROVIDERS: AnalyticsProvider[] = ['ga4'];

function normalizeProvider(raw: string): AnalyticsProvider {
  const lower = raw.toLowerCase();
  return (['none', 'vercel', 'plausible', 'umami', 'ga4'] as const).includes(lower as AnalyticsProvider)
    ? (lower as AnalyticsProvider)
    : 'none';
}

function normalizeDomain(domain: string | null): string | null {
  if (domain === null) return null;
  const trimmed = domain.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeDsn(dsn: string | null): string | null {
  if (dsn === null) return null;
  const trimmed = dsn.trim();
  return trimmed === '' ? null : trimmed;
}

export function createMonitoringConfig(env: CreateMonitoringConfigEnv): MonitoringConfig {
  const provider = normalizeProvider(env.provider);
  const domain = normalizeDomain(env.domain);
  const dsn = normalizeDsn(env.dsn);
  const consentGate = env.consentGate;

  return {
    analytics: {
      // Analytics is opt-in through the provider choice alone, then further
      // gated on a consent banner actually existing.
      enabled: provider !== 'none' && domain !== null && consentGate,
      provider,
      domain,
      consentGated: consentGate,
    },
    errorMonitoring: {
      enabled: dsn !== null,
      dsn,
    },
  };
}

export function getAnalyticsConfig(): CreateMonitoringConfigEnv {
  return {
    provider: analyticsConfig.provider,
    domain: analyticsConfig.domain === '' ? null : analyticsConfig.domain,
    consentGate: analyticsConfig.consentGate === 'true',
    dsn: null,
  };
}

/**
 * Problems that must be resolved before enabling analytics.
 *
 * Returned rather than thrown so a test can assert on the exact list, and so
 * the launch checklist can print it.
 */
export function analyticsBlockers(config: MonitoringConfig): string[] {
  const blockers: string[] = [];
  const { analytics } = config;

  if (analytics.provider === 'none') {
    blockers.push('No analytics provider selected in analytics-config.json.');
  }

  if (analytics.enabled && !analytics.consentGated) {
    blockers.push(
      'Analytics is enabled but consentGate is not true in analytics-config.json. A tracker must not load before consent.'
    );
  }

  if (analytics.enabled && CONSENT_HOSTILE_PROVIDERS.includes(analytics.provider)) {
    blockers.push(
      `${analytics.provider} sets cookies before consent. Do not use it for the UK/EU audience without a consent-management platform.`
    );
  }

  if (analytics.provider !== 'none' && analytics.domain === null) {
    blockers.push('analytics-config.json domain is not set, so events would have no destination.');
  }

  return blockers;
}

/** Human-readable state, for the launch checklist. */
export function monitoringSummary(config: MonitoringConfig): string[] {
  const { analytics, errorMonitoring } = config;
  return [
    `Analytics: ${analytics.enabled ? `ON (${analytics.provider}, consent-gated)` : 'off'}`,
    `Error monitoring: ${errorMonitoring.enabled ? 'on' : 'off'}`,
    ...analyticsBlockers(config).map((blocker) => `  blocker: ${blocker}`),
  ];
}