import Link from 'next/link';
import { CONTACT_EMAIL } from '@/lib/site/config';

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 text-sm sm:px-6">
        <p className="text-zinc-600 dark:text-zinc-400">
          An independent tool. Not affiliated with TikTok.
        </p>
        <nav aria-label="Site navigation" className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/" className="underline underline-offset-2 dark:text-zinc-200">
            Profit Calculator
          </Link>
          <Link href="/blog" className="underline underline-offset-2 dark:text-zinc-200">
            Blog
          </Link>
          <Link href="/privacy" className="underline underline-offset-2 dark:text-zinc-200">
            Privacy Policy
          </Link>
          <Link href="/terms" className="underline underline-offset-2 dark:text-zinc-200">
            Terms of Use
          </Link>
          <Link href="/disclaimer" className="underline underline-offset-2 dark:text-zinc-200">
            Disclaimer
          </Link>
        </nav>
        {/* Public contact address. The footer is the one place rendered on every
            page, so this is where a visitor can always find a way to reach us.
            A plain `mailto:` link is deliberate: it hands the message to the
            visitor's own mail client, so the site adds no service, no script and
            no third party to the page. */}
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Questions, corrections, or a rate that looks wrong? Email{' '}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="underline underline-offset-2 dark:text-zinc-200"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </footer>
  );
}