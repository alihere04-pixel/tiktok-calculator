import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { documentForSlug, LEGAL_DOCUMENTS } from '@/lib/legal/content';

export function generateMetadata(): Metadata {
  const document = documentForSlug('privacy');
  if (!document) return {};
  const title = `${document.title} - TikTok Shop Profit Calculator`;
  const description = document.metaDescription;
  return {
    title,
    description,
    alternates: { canonical: '/tiktok/privacy' },
    openGraph: {
      title,
      description,
      url: 'https://fynza.store/tiktok/privacy',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default function PrivacyPage() {
  const document = documentForSlug('privacy');
  if (!document) return null;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: `${document.title} - TikTok Shop Profit Calculator`,
            url: 'https://fynza.store/tiktok/privacy',
            description: document.metaDescription,
          }),
        }}
      />
      <LegalDocumentView document={document} allDocuments={LEGAL_DOCUMENTS} />
    </>
  );
}
