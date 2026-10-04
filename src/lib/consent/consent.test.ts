import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  ANALYTICS_CONSENT_KEY,
  analyticsPermitted,
  getAnalyticsConsentServerSnapshot,
  getAnalyticsConsentSnapshot,
  markHydrated,
  readAnalyticsConsent,
  recordAnalyticsConsent,
  subscribeToAnalyticsConsent,
  writeAnalyticsConsent,
} from './consent';

/**
 * A Storage that always throws, standing in for Safari in private mode and for
 * browsers with site data blocked. Both raise rather than returning null, which
 * is why every function here is wrapped in try/catch instead of null-checking.
 */
function hostileStorage(): Storage {
  return {
    getItem: () => {
      throw new Error('SecurityError: access denied');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage;
}

describe('reading the stored decision', () => {
  beforeEach(() => localStorage.clear());

  it('reports no decision when nothing has been stored', () => {
    expect(readAnalyticsConsent(localStorage)).toBeNull();
  });

  it('round-trips a decline', () => {
    writeAnalyticsConsent('declined', localStorage);
    expect(readAnalyticsConsent(localStorage)).toBe('declined');
  });

  it('round-trips an acceptance', () => {
    writeAnalyticsConsent('accepted', localStorage);
    expect(readAnalyticsConsent(localStorage)).toBe('accepted');
  });

  it('stores under a namespaced key, so it cannot collide with anything else', () => {
    writeAnalyticsConsent('accepted', localStorage);
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('accepted');
  });

  it('treats an unrecognised value as no decision rather than as consent', () => {
    // A stale or tampered value must never be able to switch the tracker on.
    for (const junk of ['true', 'yes', '1', 'accepted ', 'ACCEPTED', '{"a":1}']) {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, junk);
      expect(readAnalyticsConsent(localStorage)).toBeNull();
    }
  });

  it('treats unreadable storage as no decision instead of throwing', () => {
    expect(readAnalyticsConsent(hostileStorage())).toBeNull();
  });

  it('treats absent storage as no decision', () => {
    expect(readAnalyticsConsent(null)).toBeNull();
  });
});

describe('writing the decision', () => {
  beforeEach(() => localStorage.clear());

  it('reports success when the write lands', () => {
    expect(writeAnalyticsConsent('declined', localStorage)).toBe(true);
  });

  it('reports failure when storage refuses, instead of pretending it saved', () => {
    // The caller keeps the choice in memory either way, so a false here costs a
    // repeat question rather than a lost answer.
    expect(writeAnalyticsConsent('accepted', hostileStorage())).toBe(false);
  });

  it('reports failure when there is no storage at all', () => {
    expect(writeAnalyticsConsent('accepted', null)).toBe(false);
  });
});

describe('permission needs build-time configuration and a real acceptance', () => {
  it('refuses when analytics is not configured, whatever the visitor chose', () => {
    expect(analyticsPermitted(false, 'accepted')).toBe(false);
    expect(analyticsPermitted(false, null)).toBe(false);
  });

  it('refuses when nobody has chosen yet', () => {
    expect(analyticsPermitted(true, null)).toBe(false);
  });

  it('refuses after a decline', () => {
    expect(analyticsPermitted(true, 'declined')).toBe(false);
  });

  it('permits only after an acceptance, with analytics configured', () => {
    expect(analyticsPermitted(true, 'accepted')).toBe(true);
  });
});

describe('the store React subscribes to', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset module state for each test
    vi.resetModules();
  });

  it('reports pending on the server, so no decision is ever assumed', () => {
    expect(getAnalyticsConsentServerSnapshot().status).toBe('pending');
  });

  it('returns a stable server snapshot, which useSyncExternalStore requires', () => {
    // A fresh object each call would compare unequal by Object.is and re-render
    // forever.
    expect(getAnalyticsConsentServerSnapshot()).toBe(getAnalyticsConsentServerSnapshot());
  });

  it('reports unknown when nothing is stored', () => {
    markHydrated();
    expect(getAnalyticsConsentSnapshot().status).toBe('unknown');
  });

  it('returns a stable snapshot while the answer does not change', () => {
    markHydrated();
    const first = getAnalyticsConsentSnapshot();
    expect(getAnalyticsConsentSnapshot()).toBe(first);
  });

  it('returns a new snapshot once the answer changes', () => {
    markHydrated();
    const before = getAnalyticsConsentSnapshot();
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'accepted');
    expect(getAnalyticsConsentSnapshot()).not.toBe(before);
    expect(getAnalyticsConsentSnapshot().status).toBe('accepted');
  });

  it('ignores a corrupted record rather than treating it as unknown forever', () => {
    markHydrated();
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'nonsense');
    expect(getAnalyticsConsentSnapshot().status).toBe('unknown');
  });

  it('notifies subscribers when a decision is recorded', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAnalyticsConsent(listener);

    recordAnalyticsConsent('declined');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('declined');

    unsubscribe();
    recordAnalyticsConsent('accepted');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('records into hostile storage without throwing', () => {
    // Nothing can be stored, so the visitor keeps being asked. What must not
    // happen is a crash or a silent claim of success.
    expect(() => recordAnalyticsConsent('accepted')).not.toThrow();
  });
});
