import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { documentForSlug, LEGAL_DOCUMENTS } from '@/lib/legal/content';

export function generateMetadata(): Metadata {
  const document = documentForSlug('terms');
  if (!document) return {};
  return {
    title: `${document.title} - TikTok Shop Profit Calculator`,
    description: document.metaDescription,
    alternates: { canonical: '/tiktok/terms' },
  };
}

export default function TermsPage() {
  const document = documentForSlug('terms');
  if (!document) return null;
  return <LegalDocumentView document={document} allDocuments={LEGAL_DOCUMENTS} />;
}
