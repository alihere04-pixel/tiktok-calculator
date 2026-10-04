/**
 * Runtime analytics consent.
 *
 * There are two separate questions here, and conflating them is exactly how a
 * tracker ends up loading without permission:
 *
 *   1. "Is analytics configured on this build?" Answered at build time by
 *      `NEXT_PUBLIC_ANALYTICS_PROVIDER`, `NEXT_PUBLIC_ANALYTICS_DOMAIN` and
 *      `NEXT_PUBLIC_CONSENT_GATE` in `@/lib/monitoring/config`. This is a
 *      deploy-time decision the operator makes. A visitor cannot influence it.
 *   2. "Has this visitor agreed?" Answered at runtime, per browser, by the
 *      choice stored here.
 *
 * `NEXT_PUBLIC_CONSENT_GATE` is NOT user consent. It only records that a consent
 * mechanism exists in this codebase. Reading it as consent is the specific bug
 * this module exists to prevent: it would load a tracker for every first-time
 * visitor before anyone was asked, which is the outcome UK GDPR exists to stop.
 *
 * The default is unknown, and unknown always resolves to "no". A tracker that
 * loads on "maybe" has no consent behind it.
 */

/** The only two answers a visitor can give. Anything else is treated as unknown. */
export type AnalyticsConsent = 'accepted' | 'declined';

/**
 * Namespaced so it cannot collide with anything else on the origin, and so it is
 * obvious in DevTools that this is a consent record rather than a session token.
 */
export const ANALYTICS_CONSENT_KEY = 'fynza.analytics-consent';

function isAnalyticsConsent(value: unknown): value is AnalyticsConsent {
  return value === 'accepted' || value === 'declined';
}

/**
 * `localStorage` access can throw, not just return null: Safari in private mode
 * and browsers with site data blocked both raise on access or on write. Anything
 * that throws is treated as "no storage available", which degrades to asking
 * again on the next visit rather than to tracking without permission.
 */
export function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Returns the stored choice, or `null` for never-asked, unreadable or invalid. */
export function readAnalyticsConsent(storage: Storage | null = browserStorage()): AnalyticsConsent | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ANALYTICS_CONSENT_KEY);
    // A tampered or stale value is not a choice we can honour. Failing closed to
    // unknown means the banner returns rather than a stranger's value deciding
    // whether this visitor is tracked.
    return isAnalyticsConsent(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Persists the choice. Returns whether it was actually stored, so a caller can
 * tell "saved" from "kept in memory only" rather than assuming it worked.
 */
export function writeAnalyticsConsent(
  consent: AnalyticsConsent,
  storage: Storage | null = browserStorage()
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(ANALYTICS_CONSENT_KEY, consent);
    return true;
  } catch {
    return false;
  }
}

/**
 * The single place the two questions above are combined into permission.
 *
 * Both must pass, and neither can substitute for the other:
 *
 *   - Build-time configuration off means there is no tracker to load, whatever
 *     the visitor clicked.
 *   - No stored answer, or a decline, means no load, whatever is configured.
 *
 * Exported as a function rather than inlined into a component so the rule is
 * tested directly instead of being inferred from rendered output.
 */
export function analyticsPermitted(
  buildTimeEnabled: boolean,
  runtimeConsent: AnalyticsConsent | null
): boolean {
  return buildTimeEnabled && runtimeConsent === 'accepted';
}

/**
 * The consent state as React sees it.
 *
 * `unknown` means no decision stored yet (fresh visitor). The banner shows.
 * `accepted` / `declined` means the visitor has answered. The banner hides.
 */
export type ConsentStatus = 'unknown' | AnalyticsConsent;

export interface ConsentState {
  readonly status: ConsentStatus;
}

/**
 * `useSyncExternalStore` compares snapshots with `Object.is`, so a freshly built
 * object on every call would re-render forever. The last state is cached and only
 * replaced when the underlying answer actually changes.
 */
let cached: ConsentState | null = null;

function toConsentState(status: ConsentStatus): ConsentState {
  if (cached !== null && cached.status === status) return cached;
  cached = Object.freeze({ status });
  return cached;
}

const listeners = new Set<() => void>();

/**
 * `localStorage` has no change event, so the store notifies explicitly from
 * `recordAnalyticsConsent`. That is enough: the only writer is this module.
 */
export function subscribeToAnalyticsConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The real answer from this browser. */
export function getAnalyticsConsentSnapshot(): ConsentState {
  const stored = readAnalyticsConsent();
  return toConsentState(stored ?? 'unknown');
}

/** Records the visitor's answer and tells every mounted component about it. */
export function recordAnalyticsConsent(consent: AnalyticsConsent): void {
  writeAnalyticsConsent(consent);
  // State is forced to a fresh snapshot rather than patched in place, because the
  // stored value is the source of truth and React must be told to re-read it.
  cached = null;
  for (const listener of listeners) listener();
}
