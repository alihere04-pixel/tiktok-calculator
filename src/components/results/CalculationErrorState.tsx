'use client';

import { Button } from '@/components/ui/Button';

/**
 * Shown instead of the results panel when validation fails.
 *
 * The list comes straight from `validateInputs`, so each line names the field
 * that needs fixing rather than saying "invalid input" - the user needs to know
 * *which* box to correct.
 */
export function CalculationErrorState({
  errors,
  onDismiss,
}: {
  errors: string[];
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-300 bg-red-50 p-4 sm:p-5 dark:border-red-800 dark:bg-red-950/40"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-red-900 sm:text-base dark:text-red-200">
            Cannot calculate yet
          </h2>
          <p className="mt-1 text-sm text-red-800 dark:text-red-300">
            Fix {errors.length === 1 ? 'this' : `these ${errors.length} things`} and calculate
            again:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800 dark:text-red-300">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
        {onDismiss ? (
          <Button variant="secondary" size="sm" onClick={onDismiss} className="shrink-0">
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}
