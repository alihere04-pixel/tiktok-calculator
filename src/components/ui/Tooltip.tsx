'use client';

import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TooltipProps {
  /** Tooltip body. Keep it short - it is announced verbatim. */
  content: ReactNode;
  /** Accessible name for the trigger icon. Defaults to "More information". */
  label?: string;
  className?: string;
}

/**
 * Info-icon tooltip shown on hover and on keyboard focus.
 *
 * Visibility is driven by :hover, :focus-within and :focus-visible on the
 * wrapper, so no JavaScript is needed to open it. Escape dismissal needs
 * script, which is why this is a client component.
 */
export function Tooltip({ content, label = 'More information', className }: TooltipProps) {
  const generatedId = useId();
  const tooltipId = `${generatedId}-tooltip`;
  const [dismissed, setDismissed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <span
      className={cn('group relative inline-flex', className)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setDismissed(true);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        onBlur={() => setDismissed(false)}
        onClick={(event) => event.preventDefault()}
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded-full text-zinc-500',
          'hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900',
          'dark:text-zinc-400 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-50'
        )}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm1-11.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a1 1 0 0 1 2 0v3a1 1 0 1 1-2 0V9Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/*
        aria-hidden tracks the `dismissed` state so the tooltip is removed from
        the accessibility tree once dismissed, while CSS still controls when it
        is painted.
      */}
      <span
        role="tooltip"
        id={tooltipId}
        aria-hidden={dismissed}
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-56 -translate-x-1/2',
          'rounded-lg bg-zinc-900 px-3 py-2 text-xs font-normal text-white shadow-lg',
          'invisible opacity-0 transition-opacity',
          'group-hover:visible group-hover:opacity-100',
          'group-focus-within:visible group-focus-within:opacity-100'
        )}
      >
        {content}
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900"
        />
      </span>
    </span>
  );
}
