import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { documentForSlug, LEGAL_DOCUMENTS } from '@/lib/legal/content';

export function generateMetadata(): Metadata {
  const document = documentForSlug('privacy');
  if (!document) return {};
  return {
    title: `${document.title} - TikTok Shop Profit Calculator`,
    description: document.metaDescription,
    alternates: { canonical: '/tiktok/privacy' },
  };
}

export default function PrivacyPage() {
  const document = documentForSlug('privacy');
  if (!document) return null;
  return <LegalDocumentView document={document} allDocuments={LEGAL_DOCUMENTS} />;
}
