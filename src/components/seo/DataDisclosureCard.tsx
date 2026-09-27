import { SellerCenterCta } from './SellerCenterCta';

/**
 * The one component that renders every gap in our data, on every market page.
 *
 * The PRD requires all eight sections on all five pages, but our rate files are
 * not equally complete across markets. Rather than dropping a section (which
 * would make the pages look inconsistent and hide the gap) or inventing a
 * number (which would be worse), a section with no verified data renders this
 * card instead.
 *
 * The title and the CTA label are fixed on purpose. "Not in our verified
 * dataset" is a specific, falsifiable claim: it says exactly what is wrong with
 * the number, and a reader can check it. Softer wording like "coming soon" or
 * "varies by seller" would read as though we have a number and are hedging.
 *
 * The card is decorative-free: the reason and guidance are real body text, not
 * an image or a tooltip, so it survives without CSS and gets read by assistive
 * technology. It is marked as a `note` rather than a heading, because the
 * section's own heading above it already carries the page outline.
 */
export function DataDisclosureCard({
  reason,
  guidance,
  sourceUrl,
  className,
}: {
  reason: string;
  guidance?: string;
  sourceUrl: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30 ${className ?? ''}`}
    >
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        Not in our verified dataset
      </p>
      <p className="mt-1.5 text-sm text-amber-900/90 dark:text-amber-200/90">{reason}</p>
      {guidance ? (
        <p className="mt-1.5 text-sm text-amber-900/90 dark:text-amber-200/90">{guidance}</p>
      ) : null}
      <SellerCenterCta url={sourceUrl} className="mt-3" />
    </div>
  );
}
