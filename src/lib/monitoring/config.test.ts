import { describe, it, expect } from 'vitest';
import { analyticsBlockers, createMonitoringConfig, monitoringSummary, type CreateMonitoringConfigEnv } from './config';

function makeEnv(overrides: Partial<CreateMonitoringConfigEnv> = {}): CreateMonitoringConfigEnv {
  return {
    provider: '',
    domain: null,
    consentGate: false,
    dsn: null,
    ...overrides,
  };
}

describe('createMonitoringConfig', () => {
  it('has analytics off with no provider when nothing is configured', () => {
    const config = createMonitoringConfig(makeEnv());
    expect(config.analytics.enabled).toBe(false);
    expect(config.analytics.provider).toBe('none');
    expect(config.analytics.domain).toBeNull();
  });

  it('has analytics off when provider is empty and no domain', () => {
    const config = createMonitoringConfig(makeEnv({ provider: '', domain: null, consentGate: true }));
    expect(config.analytics.enabled).toBe(false);
    expect(config.analytics.provider).toBe('none');
    expect(config.analytics.domain).toBeNull();
    expect(config.analytics.consentGated).toBe(true);
  });

  it('has error monitoring off by default', () => {
    expect(createMonitoringConfig(makeEnv({ dsn: null })).errorMonitoring.enabled).toBe(false);
    expect(createMonitoringConfig(makeEnv({ dsn: '' })).errorMonitoring.dsn).toBeNull();
  });

  it('ships nothing on, which is what the UK/EU audience requires', () => {
    const summary = monitoringSummary(createMonitoringConfig(makeEnv()));
    expect(summary[0]).toBe('Analytics: off');
    expect(summary[1]).toBe('Error monitoring: off');
  });
});

describe('analytics enablement is consent-gated', () => {
  it('stays off even with a provider set, unless consent gating is on', () => {
    // The trap this prevents: setting the provider and a domain and assuming
    // analytics is live. Without a real consent banner it must not load.
    expect(createMonitoringConfig(makeEnv({
      provider: 'umami',
      domain: 'analytics.example.com',
      consentGate: false,
    })).analytics.enabled).toBe(false);
  });

  it('turns on only when provider, domain and consent gate are all present', () => {
    const config = createMonitoringConfig(makeEnv({
      provider: 'umami',
      domain: 'analytics.example.com',
      consentGate: true,
    }));
    expect(config.analytics.enabled).toBe(true);
    expect(config.analytics.consentGated).toBe(true);
  });

  it('does not treat whitespace as configuration', () => {
    const config = createMonitoringConfig(makeEnv({
      provider: '  umami  ',
      domain: '   ',
      consentGate: true,
    }));
    expect(config.analytics.domain).toBeNull();
    expect(config.analytics.enabled).toBe(false);
  });

  it('falls back to none for an unrecognised provider', () => {
    expect(createMonitoringConfig(makeEnv({
      provider: 'my-own-script',
      domain: 'analytics.example.com',
      consentGate: true,
    })).analytics.provider).toBe('none');
  });

  it('recognises vercel as a valid provider, so the wired-in tracker is representable', () => {
    // Vercel Web Analytics is the provider actually used by AnalyticsGate. It
    // has to be a member of the union, or the gate could only ever be configured
    // to 'none' and the "no analytics" claim would be true for the wrong reason.
    const config = createMonitoringConfig(makeEnv({
      provider: 'vercel',
      domain: 'fynza.store',
      consentGate: true,
    }));
    expect(config.analytics.provider).toBe('vercel');
    expect(config.analytics.enabled).toBe(true);
  });

  it('does not treat vercel as a consent-hostile provider, unlike ga4', () => {
    // The distinction: GA4 writes its own cookie before any banner can ask.
    // Vercel's cookie is opt-in via `window.va("enableCookie")` and off by
    // default, so it is gated rather than banned. What it does do is persist
    // `__va_attribution` in localStorage, which is why it still needs consent
    // and still ships off.
    expect(analyticsBlockers(createMonitoringConfig(makeEnv({
      provider: 'vercel',
      domain: 'fynza.store',
      consentGate: true,
    })))).toEqual([]);
  });
});

describe('analyticsBlockers', () => {
  it('reports a missing provider on a fresh install', () => {
    expect(analyticsBlockers(createMonitoringConfig(makeEnv()))).toContain('No analytics provider selected.');
  });

  it('flags GA4 as unsuitable without a consent-management platform', () => {
    // GA4 writes its cookies before any banner can ask, so it cannot be the
    // default for this audience.
    const blockers = analyticsBlockers(createMonitoringConfig(makeEnv({
      provider: 'ga4',
      domain: 'analytics.example.com',
      consentGate: true,
    })));
    expect(blockers.some((b) => b.includes('ga4') && b.includes('before consent'))).toBe(true);
  });

  it('flags a missing destination domain', () => {
    expect(analyticsBlockers(createMonitoringConfig(makeEnv({
      provider: 'plausible',
      domain: null,
      consentGate: true,
    })))).toContain(
      'NEXT_PUBLIC_ANALYTICS_DOMAIN is not set, so events would have no destination.'
    );
  });

  it('is silent once analytics is fully and correctly configured', () => {
    expect(analyticsBlockers(createMonitoringConfig(makeEnv({
      provider: 'plausible',
      domain: 'analytics.example.com',
      consentGate: true,
    })))).toEqual([]);
  });
});

describe('error monitoring', () => {
  it('enables when a DSN is present', () => {
    const config = createMonitoringConfig(makeEnv({
      dsn: 'https://errors.example.com/1',
    }));
    expect(config.errorMonitoring.enabled).toBe(true);
    expect(config.errorMonitoring.dsn).toBe('https://errors.example.com/1');
  });

  it('stays off for a blank DSN', () => {
    expect(createMonitoringConfig(makeEnv({ dsn: '  ' })).errorMonitoring.enabled).toBe(false);
  });
});

describe('monitoringSummary', () => {
  it('lists blockers as indented lines under the status', () => {
    const summary = monitoringSummary(createMonitoringConfig(makeEnv({
      provider: 'ga4',
      domain: null,
      consentGate: true,
    })));
    expect(summary.some((line) => line.trimStart().startsWith('blocker:'))).toBe(true);
  });
});