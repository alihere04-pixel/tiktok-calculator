'use client';

import { useCallback, useSyncExternalStore } from 'react';

import {
  getAnalyticsConsentSnapshot,
  recordAnalyticsConsent,
  subscribeToAnalyticsConsent,
  type AnalyticsConsent,
  type ConsentState,
} from '@/lib/consent/consent';

/**
 * The visitor's analytics decision, for this browser.
 *
 * `consent.status` is `'unknown'` for fresh visitors, `'accepted'` or `'declined'`
 * for returning visitors who have made a choice.
 *
 * `useSyncExternalStore` is the right primitive here rather than reading storage
 * during render or setting state in an effect. Reading during render would let
 * the server and client disagree, which is a hydration mismatch; setting state in
 * an effect is the pattern React's own lint rules flag, because it renders once
 * with the wrong value and then corrects itself. This subscription gives the
 * server a value it can always agree with.
 *
 * If storage is unavailable the store reports `'unknown'` forever. The visitor is
 * therefore asked again on each visit and nothing is ever tracked without an
 * answer, which is the right way round to fail.
 */
export function useAnalyticsConsent(): {
  consent: ConsentState;
  decide: (choice: AnalyticsConsent) => void;
} {
  const consent = useSyncExternalStore(
    subscribeToAnalyticsConsent,
    getAnalyticsConsentSnapshot,
    getAnalyticsConsentSnapshot
  );

  const decide = useCallback((choice: AnalyticsConsent) => {
    recordAnalyticsConsent(choice);
  }, []);

  return { consent, decide };
}
