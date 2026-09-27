'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type CollapsibleHeadingLevel = 'h2' | 'h3' | 'h4';

export interface CollapsibleProps {
  title: ReactNode;
  children: ReactNode;
  /** Controlled open state. Omit for uncontrolled behaviour. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  description?: ReactNode;
  /** Badge or metadata rendered opposite the title. */
  meta?: ReactNode;
  className?: string;
  /**
   * Heading level for the title.
   *
   * Defaults to `h3` because most collapsibles here sit inside a `Card`, whose
   * header is an `h2`. Pass `h2` for a collapsible that is a direct child of the
   * page `h1`, otherwise the document outline skips a level and screen-reader
   * users navigating by heading lose the structure.
   */
  headingLevel?: CollapsibleHeadingLevel;
}

const HEADING_TAGS: Record<CollapsibleHeadingLevel, 'h2' | 'h3' | 'h4'> = {
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
};

export function Collapsible({
  title,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  description,
  meta,
  className,
  headingLevel = 'h3',
}: CollapsibleProps) {
  const Heading = HEADING_TAGS[headingLevel];
  const generatedId = useId();
  const contentId = `${generatedId}-content`;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const toggle = () => {
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
        className
      )}
    >
      <Heading className="m-0">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-controls={contentId}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900',
            'dark:focus-visible:ring-zinc-50'
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-zinc-900 sm:text-base dark:text-zinc-50">
              {title}
            </span>
            {description ? (
              <span className="mt-0.5 block text-xs text-zinc-600 sm:text-sm dark:text-zinc-400">
                {description}
              </span>
            ) : null}
          </span>

          {meta ? <span className="shrink-0">{meta}</span> : null}

          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={cn('shrink-0 text-zinc-500 transition-transform', isOpen && 'rotate-180')}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </Heading>

      {/*
        Hidden rather than unmounted so descendant form state (and any in-flight
        calculation) survives a collapse/expand cycle.
      */}
      <div id={contentId} hidden={!isOpen} className="border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
        {children}
      </div>
    </div>
  );
}
