'use client';

import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

const CONTROL_STYLES =
  'w-full rounded-lg border bg-white px-3 text-zinc-900 transition-colors placeholder:text-zinc-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-zinc-50 ' +
  'dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:disabled:bg-zinc-800/50';

const SIZE_STYLES = {
  sm: 'h-9 text-sm',
  md: 'h-10 text-base sm:text-sm',
  lg: 'h-12 text-base',
};

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  /** Visual label can be hidden for screen-reader-only use, but keep `label` set. */
  hideLabel?: boolean;
  error?: string;
  helperText?: ReactNode;
  size?: keyof typeof SIZE_STYLES;
  prefix?: string;
  suffix?: string;
  /** Rendered after the label text, e.g. an info Tooltip. */
  labelSuffix?: ReactNode;
}

export function Input({
  label,
  hideLabel = false,
  error,
  helperText,
  size = 'md',
  prefix,
  suffix,
  labelSuffix,
  id,
  className,
  required,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  // Point aria-describedby at whichever helper actually exists, so screen
  // readers do not announce an empty region.
  const describedBy = [error ? errorId : null, helperText ? helperId : null].filter(Boolean).join(' ');

  return (
    <div className="w-full">
      <div className={cn('mb-1.5 flex items-center gap-1.5', hideLabel && 'sr-only')}>
        <label htmlFor={inputId} className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {label}
          {required ? (
            <span className="ml-0.5 text-red-600 dark:text-red-400" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {labelSuffix}
      </div>

      <div className="relative flex items-center">
        {prefix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 text-sm text-zinc-500 dark:text-zinc-400"
          >
            {prefix}
          </span>
        ) : null}

        <input
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            CONTROL_STYLES,
            SIZE_STYLES[size],
            error
              ? 'border-red-500 focus:ring-red-500 dark:border-red-500'
              : 'border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-50 dark:focus:ring-zinc-50',
            prefix && 'pl-7',
            suffix && 'pr-10',
            className
          )}
          {...rest}
        />

        {suffix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 text-sm text-zinc-500 dark:text-zinc-400"
          >
            {suffix}
          </span>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {helperText ? (
        <p id={helperId} className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
