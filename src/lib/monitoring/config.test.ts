import { describe, it, expect, vi } from 'vitest';

async function getConfig(env: Record<string, string | undefined> = {}) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      vi.stubEnv(key, value);
    }
  }
  vi.resetModules();
  const mod = await import('./config');
  return mod;
}

describe('monitoringConfig defaults', () => {
  it('has analytics off with no provider when nothing is configured', async () => {
    const { monitoringConfig } = await getConfig({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: '',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: '',
      NEXT_PUBLIC_CONSENT_GATE: '',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    const config = monitoringConfig();
    expect(config.analytics.enabled).toBe(false);
    expect(config.analytics.provider).toBe('none');
    expect(config.analytics.domain).toBeNull();
  });

  it('has analytics off when process.env has no NEXT_PUBLIC_* keys (browser)', async () => {
    const { monitoringConfig } = await getConfig({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: undefined,
      NEXT_PUBLIC_ANALYTICS_DOMAIN: undefined,
      NEXT_PUBLIC_CONSENT_GATE: undefined,
      NEXT_PUBLIC_ERROR_DSN: undefined,
    });
    const config = monitoringConfig();
    expect(config.analytics.enabled).toBe(false);
    expect(config.analytics.provider).toBe('none');
    expect(config.analytics.domain).toBeNull();
    expect(config.analytics.consentGated).toBe(false);
  });

  it('has error monitoring off by default', async () => {
    const { monitoringConfig } = await getConfig({
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    expect(monitoringConfig().errorMonitoring.enabled).toBe(false);
    expect(monitoringConfig().errorMonitoring.dsn).toBeNull();
  });

  it('ships nothing on, which is what the UK/EU audience requires', async () => {
    const { monitoringSummary } = await getConfig({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: '',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: '',
      NEXT_PUBLIC_CONSENT_GATE: '',
      NEXT_PUBLIC_ERROR_DSN: '',
    });
    const summary = monitoringSummary();
    expect(summary[0]).toBe('Analytics: off');
    expect(summary[1]).toBe('Error monitoring: off');
  });
});

describe('analytics enablement is consent-gated', () => {
  it('stays off even with a provider set, unless consent gating is on', async () => {
    const { monitoringConfig } = await getConfig({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'umami',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: '',
    });
    expect(monitoringConfig().analytics.enabled).toBe(false);
  });

  it('turns on only when provider, domain and consent gate are all present', async () => {
    const { monitoringConfig } = await getConfig({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'umami',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
    });
    const config = monitoringConfig();
    expect(config.analytics.enabled).toBe(true);
    expect(config.analytics.consentGated).toBe(true);
  });

  it('does not treat whitespace as configuration', async () => {
    const { monitoringConfig } = await getConfig({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: '  umami  ',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: '   ',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
    });
    const config = monitoringConfig();
    expect(config.analytics.domain).toBeNull();
    expect(config.analytics.enabled).toBe(false);
  });

  it('falls back to none for an unrecognised provider', async () => {
    const { monitoringConfig } = await getConfig({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'my-own-script',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
    });
    expect(monitoringConfig().analytics.provider).toBe('none');
  });

  it('recognises vercel as a valid provider, so the wired-in tracker is representable', async () => {
    const { monitoringConfig } = await getConfig({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'fynza.store',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
    });
    const config = monitoringConfig();
    expect(config.analytics.provider).toBe('vercel');
    expect(config.analytics.enabled).toBe(true);
  });

  it('does not treat vercel as a consent-hostile provider, unlike ga4', async () => {
    const { analyticsBlockers } = await getConfig({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'vercel',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'fynza.store',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
    });
    expect(analyticsBlockers()).toEqual([]);
  });
});

describe('analyticsBlockers', () => {
  it('reports a missing provider on a fresh install', async () => {
    const { analyticsBlockers } = await getConfig({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: '',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: '',
      NEXT_PUBLIC_CONSENT_GATE: '',
    });
    expect(analyticsBlockers()).toContain('No analytics provider selected.');
  });

  it('flags GA4 as unsuitable without a consent-management platform', async () => {
    const { analyticsBlockers } = await getConfig({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'ga4',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
    });
    const blockers = analyticsBlockers();
    expect(blockers.some((b) => b.includes('ga4') && b.includes('before consent'))).toBe(true);
  });

  it('flags a missing destination domain', async () => {
    const { analyticsBlockers } = await getConfig({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'plausible',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: '',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
    });
    expect(analyticsBlockers()).toContain(
      'NEXT_PUBLIC_ANALYTICS_DOMAIN is not set, so events would have no destination.'
    );
  });

  it('is silent once analytics is fully and correctly configured', async () => {
    const { analyticsBlockers } = await getConfig({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'plausible',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: 'analytics.example.com',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
    });
    expect(analyticsBlockers()).toEqual([]);
  });
});

describe('error monitoring', () => {
  it('enables when a DSN is present', async () => {
    const { monitoringConfig } = await getConfig({
      NEXT_PUBLIC_ERROR_DSN: 'https://errors.example.com/1',
    });
    const config = monitoringConfig();
    expect(config.errorMonitoring.enabled).toBe(true);
    expect(config.errorMonitoring.dsn).toBe('https://errors.example.com/1');
  });

  it('stays off for a blank DSN', async () => {
    const { monitoringConfig } = await getConfig({
      NEXT_PUBLIC_ERROR_DSN: '  ',
    });
    expect(monitoringConfig().errorMonitoring.enabled).toBe(false);
  });
});

describe('monitoringSummary', () => {
  it('lists blockers as indented lines under the status', async () => {
    const { monitoringSummary } = await getConfig({
      NEXT_PUBLIC_ANALYTICS_PROVIDER: 'ga4',
      NEXT_PUBLIC_ANALYTICS_DOMAIN: '',
      NEXT_PUBLIC_CONSENT_GATE: 'true',
    });
    const summary = monitoringSummary();
    expect(summary.some((line) => line.trimStart().startsWith('blocker:'))).toBe(true);
  });
});