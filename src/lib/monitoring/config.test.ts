import { describe, it, expect, afterEach, vi } from 'vitest';
import { analyticsBlockers, monitoringConfig, monitoringSummary } from './config';

afterEach(() => {
  vi.unstubAllEnvs();
});

function clearEnv() {
  for (const key of [
    'NEXT_PUBLIC_ANALYTICS_PROVIDER',
    'NEXT_PUBLIC_ANALYTICS_DOMAIN',
    'NEXT_PUBLIC_CONSENT_GATE',
    'NEXT_PUBLIC_ERROR_DSN',
  ]) {
    vi.stubEnv(key, '');
  }
}

describe('monitoringConfig defaults', () => {
  it('has analytics off with no provider when nothing is configured', () => {
    clearEnv();
    const config = monitoringConfig();
    expect(config.analytics.enabled).toBe(false);
    expect(config.analytics.provider).toBe('none');
    expect(config.analytics.domain).toBeNull();
  });

  it('has analytics off when process.env has no NEXT_PUBLIC_* keys (browser)', () => {
    // Simulate browser where process.env is an empty object - no stubs at all
    vi.unstubAllEnvs();
    const config = monitoringConfig();
    expect(config.analytics.enabled).toBe(false);
    expect(config.analytics.provider).toBe('none');
    expect(config.analytics.domain).toBeNull();
    expect(config.analytics.consentGated).toBe(false);
  });

  it('has error monitoring off by default', () => {
    clearEnv();
    expect(monitoringConfig().errorMonitoring.enabled).toBe(false);
    expect(monitoringConfig().errorMonitoring.dsn).toBeNull();
  });

  it('ships nothing on, which is what the UK/EU audience requires', () => {
    clearEnv();
    const summary = monitoringSummary();
    expect(summary[0]).toBe('Analytics: off');
    expect(summary[1]).toBe('Error monitoring: off');
  });
});

describe('analytics enablement is consent-gated', () => {
  it('stays off even with a provider set, unless consent gating is on', () => {
    // The trap this prevents: setting the provider and a domain and assuming
    // analytics is live. Without a real consent banner, it must not load.
    clearEnv();
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', 'umami');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_DOMAIN', 'analytics.example.com');
    expect(monitoringConfig().analytics.enabled).toBe(false);
  });

  it('turns on only when provider, domain and consent gate are all present', () => {
    clearEnv();
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', 'umami');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_DOMAIN', 'analytics.example.com');
    vi.stubEnv('NEXT_PUBLIC_CONSENT_GATE', 'true');
    const config = monitoringConfig();
    expect(config.analytics.enabled).toBe(true);
    expect(config.analytics.consentGated).toBe(true);
  });

  it('does not treat whitespace as configuration', () => {
    clearEnv();
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', '  umami  ');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_DOMAIN', '   ');
    const config = monitoringConfig();
    expect(config.analytics.domain).toBeNull();
    expect(config.analytics.enabled).toBe(false);
  });

  it('falls back to none for an unrecognised provider', () => {
    clearEnv();
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', 'my-own-script');
    expect(monitoringConfig().analytics.provider).toBe('none');
  });

  it('recognises vercel as a valid provider, so the wired-in tracker is representable', () => {
    // Vercel Web Analytics is the provider actually used by AnalyticsGate. It
    // has to be a member of the union, or the gate could only ever be configured
    // to 'none' and the "no analytics" claim would be true for the wrong reason.
    clearEnv();
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', 'vercel');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_DOMAIN', 'fynza.store');
    vi.stubEnv('NEXT_PUBLIC_CONSENT_GATE', 'true');
    const config = monitoringConfig();
    expect(config.analytics.provider).toBe('vercel');
    expect(config.analytics.enabled).toBe(true);
  });

  it('does not treat vercel as a consent-hostile provider, unlike ga4', () => {
    // The distinction: GA4 writes its own cookie before any banner can ask.
    // Vercel's cookie is opt-in via `window.va("enableCookie")` and off by
    // default, so it is gated rather than banned. What it does do is persist
    // `__va_attribution` in localStorage, which is why it still needs consent
    // and still ships off.
    clearEnv();
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', 'vercel');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_DOMAIN', 'fynza.store');
    vi.stubEnv('NEXT_PUBLIC_CONSENT_GATE', 'true');
    expect(analyticsBlockers()).toEqual([]);
  });
});

describe('analyticsBlockers', () => {
  it('reports a missing provider on a fresh install', () => {
    clearEnv();
    expect(analyticsBlockers()).toContain('No analytics provider selected.');
  });

  it('flags GA4 as unsuitable without a consent-management platform', () => {
    // GA4 writes its cookies before any banner can ask, so it cannot be the
    // default for this audience.
    clearEnv();
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', 'ga4');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_DOMAIN', 'analytics.example.com');
    vi.stubEnv('NEXT_PUBLIC_CONSENT_GATE', 'true');
    const blockers = analyticsBlockers();
    expect(blockers.some((b) => b.includes('ga4') && b.includes('before consent'))).toBe(true);
  });

  it('flags a missing destination domain', () => {
    clearEnv();
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', 'plausible');
    expect(analyticsBlockers()).toContain(
      'NEXT_PUBLIC_ANALYTICS_DOMAIN is not set, so events would have no destination.'
    );
  });

  it('is silent once analytics is fully and correctly configured', () => {
    clearEnv();
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', 'plausible');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_DOMAIN', 'analytics.example.com');
    vi.stubEnv('NEXT_PUBLIC_CONSENT_GATE', 'true');
    expect(analyticsBlockers()).toEqual([]);
  });
});

describe('error monitoring', () => {
  it('enables when a DSN is present', () => {
    clearEnv();
    vi.stubEnv('NEXT_PUBLIC_ERROR_DSN', 'https://errors.example.com/1');
    const config = monitoringConfig();
    expect(config.errorMonitoring.enabled).toBe(true);
    expect(config.errorMonitoring.dsn).toBe('https://errors.example.com/1');
  });

  it('stays off for a blank DSN', () => {
    clearEnv();
    vi.stubEnv('NEXT_PUBLIC_ERROR_DSN', '  ');
    expect(monitoringConfig().errorMonitoring.enabled).toBe(false);
  });
});

describe('monitoringSummary', () => {
  it('lists blockers as indented lines under the status', () => {
    clearEnv();
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_PROVIDER', 'ga4');
    const summary = monitoringSummary();
    expect(summary.some((line) => line.trimStart().startsWith('blocker:'))).toBe(true);
  });
});
