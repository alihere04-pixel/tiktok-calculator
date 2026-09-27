import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { documentForSlug, LEGAL_DOCUMENTS } from '@/lib/legal/content';

/**
 * Static legal pages, generated from `@/lib/legal/content`.
 *
 * The three pages share one implementation and differ only in which document
 * they look up, so the wording, structure and navigation cannot drift apart.
 * There is no dynamic segment here on purpose: three fixed paths are easier to
 * link to, easier to keep in a sitemap, and impossible to enumerate by accident.
 */

export function generateMetadata(): Metadata {
  const document = documentForSlug('disclaimer');
  if (!document) return {};
  return {
    title: `${document.title} - TikTok Shop Profit Calculator`,
    description: document.metaDescription,
    alternates: { canonical: '/disclaimer' },
  };
}

export default function DisclaimerPage() {
  const document = documentForSlug('disclaimer');
  if (!document) return null;
  return <LegalDocumentView document={document} allDocuments={LEGAL_DOCUMENTS} />;
}
