import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'needs-verification';

const LEVEL_STYLES: Record<ConfidenceLevel, string> = {
  high: 'bg-green-100 text-green-800 ring-green-600/20',
  medium: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  low: 'bg-red-100 text-red-800 ring-red-600/20',
  'needs-verification': 'bg-zinc-200 text-zinc-700 ring-zinc-500/20',
};

const LEVEL_LABELS: Record<ConfidenceLevel, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
  'needs-verification': 'Needs verification',
};

/**
 * Renders a rate-source confidence level. Colour is never the only signal: the
 * badge always carries a text label, and exposes it via title for hover.
 */
export function Badge({
  level,
  label,
  className,
}: {
  level: ConfidenceLevel;
  label?: string;
  className?: string;
}) {
  return (
    <span
      title={LEVEL_LABELS[level]}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        LEVEL_STYLES[level],
        className
      )}
    >
      {label ?? LEVEL_LABELS[level]}
    </span>
  );
}

/** Small neutral tag for category tiers and similar metadata. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-700',
        className
      )}
    >
      {children}
    </span>
  );
}
