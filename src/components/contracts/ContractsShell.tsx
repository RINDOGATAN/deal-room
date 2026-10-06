// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { brand } from "@/config/brand";
import { contractPath, developersPath, type PageLocale } from "@/lib/contract-pages-paths";
import { CONTRACT_COPY } from "./copy";
import { ContractsHeader } from "./ContractsHeader";

/** Header, content and footer of the public contract pages, in the URL's language. */
export function ContractsShell({
  locale,
  alternateHref,
  active = "contracts",
  children,
}: {
  locale: PageLocale;
  alternateHref: string;
  /** The header link shown as the current section. */
  active?: "contracts" | "developers";
  children: React.ReactNode;
}) {
  const copy = CONTRACT_COPY[locale];
  return (
    <div lang={locale} className="min-h-screen bg-background flex flex-col">
      {/* The root layout sets <html lang> from the visitor's cookie, which a
          prerendered page does not have; the URL's language wins here. */}
      {locale !== "en" && (
        <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(locale)};` }} />
      )}
      <ContractsHeader locale={locale} alternateHref={alternateHref} active={active} />
      <main className="flex-1">{children}</main>
      <footer className="py-4 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <Link href={contractPath(locale)} className="hover:text-foreground">
            {copy.navContracts}
          </Link>
          <span className="text-border">&middot;</span>
          <Link href="/pricing" className="hover:text-foreground">
            {copy.navPricing}
          </Link>
          <span className="text-border">&middot;</span>
          <Link href={developersPath(locale)} className="hover:text-foreground">
            {copy.navDevelopers}
          </Link>
          <span className="text-border">&middot;</span>
          <a href={brand.links.terms} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
            {locale === "es" ? "Términos de Uso" : "Terms of Service"}
          </a>
          <span className="text-border">&middot;</span>
          <a href={brand.links.privacy} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
            {locale === "es" ? "Política de Privacidad" : "Privacy Policy"}
          </a>
          <span className="text-border">&middot;</span>
          <Link href="/licenses" className="hover:text-foreground">
            {locale === "es" ? "Licencias" : "Licences"}
          </Link>
        </div>
      </footer>
    </div>
  );
}
