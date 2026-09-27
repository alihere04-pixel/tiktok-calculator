'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

export interface RadioGroupProps {
  label: string;
  value: string;
  options: RadioOption[];
  onChange: (value: string) => void;
  /** Lay options out in a row rather than a column. */
  orientation?: 'vertical' | 'horizontal';
  error?: string;
  helperText?: React.ReactNode;
  name?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Radio group built on native <input type="radio">, which gives arrow-key
 * navigation, grouping and screen-reader semantics for free. A custom widget
 * would have to reimplement all of it.
 */
export function RadioGroup({
  label,
  value,
  options,
  onChange,
  orientation = 'vertical',
  error,
  helperText,
  name,
  disabled,
  className,
}: RadioGroupProps) {
  const generatedId = useId();
  const groupName = name ?? generatedId;
  const errorId = `${groupName}-error`;
  const helperId = `${groupName}-helper`;
  const describedBy = [error ? errorId : null, helperText ? helperId : null].filter(Boolean).join(' ');

  return (
    <fieldset className={cn('w-full', className)} disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</legend>

      <div
        className={cn(
          orientation === 'horizontal' ? 'flex flex-wrap gap-3' : 'space-y-2'
        )}
      >
        {options.map((option) => {
          const optionId = `${groupName}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                'flex cursor-pointer items-start gap-2.5',
                orientation === 'horizontal'
                  ? 'rounded-lg border border-zinc-300 px-3 py-2 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50 dark:border-zinc-700 dark:has-[:checked]:border-zinc-50 dark:has-[:checked]:bg-zinc-800/50'
                  : '',
                disabled && 'cursor-not-allowed opacity-60'
              )}
            >
              <input
                id={optionId}
                type="radio"
                name={groupName}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                aria-describedby={describedBy || undefined}
                className="mt-0.5 h-4 w-4 shrink-0 border-zinc-300 text-zinc-900 focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:text-zinc-50 dark:focus:ring-zinc-50"
              />
              <span className="min-w-0">
                <span className="block text-sm text-zinc-900 dark:text-zinc-100">{option.label}</span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-400">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
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
    </fieldset>
  );
}
