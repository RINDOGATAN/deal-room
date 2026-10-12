// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";
import type { PageLocale } from "@/lib/contract-pages-paths";

/**
 * Header, content and footer of the public contract pages and Developers, in
 * the URL's language. The header and footer are the ones every public page
 * shows (PublicHeader, PublicFooter); the current
 * section follows the path.
 */
export function ContractsShell({
  locale,
  alternateHref,
  children,
}: {
  locale: PageLocale;
  /** The same page in the other language. */
  alternateHref: string;
  children: React.ReactNode;
}) {
  return (
    <div lang={locale} className="min-h-screen bg-background flex flex-col">
      {/* The root layout sets <html lang> from the visitor's cookie, which a
          prerendered page does not have; the URL's language wins here. */}
      {locale !== "en" && (
        <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(locale)};` }} />
      )}
      <PublicHeader locale={locale} languageHref={alternateHref} />
      <main className="flex-1">{children}</main>
      <PublicFooter locale={locale} />
    </div>
  );
}
