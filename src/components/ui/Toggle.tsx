'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * Boolean switch built on a native checkbox with role="switch", so it is
 * reachable by Tab and toggled by Space without extra key handling.
 */
export function Toggle({
  label,
  checked,
  onChange,
  description,
  disabled,
  className,
}: ToggleProps) {
  const id = useId();
  const descriptionId = `${id}-description`;

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        ) : null}
      </div>

      <span className="relative inline-flex shrink-0 items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={description ? descriptionId : undefined}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            'block h-6 w-11 cursor-pointer rounded-full transition-colors',
            'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-900 peer-focus-visible:ring-offset-2',
            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            'bg-zinc-300 peer-checked:bg-zinc-900 dark:bg-zinc-700 dark:peer-checked:bg-zinc-50 dark:peer-focus-visible:ring-zinc-50 dark:peer-focus-visible:ring-offset-zinc-900',
            checked && 'bg-zinc-900 dark:bg-zinc-50'
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            'dark:bg-zinc-900',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </span>
    </div>
  );
}
