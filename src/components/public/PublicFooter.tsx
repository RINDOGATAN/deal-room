"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one footer of Dealroom's public pages (owner, 10 Oct 2026), the
 * companion of PublicHeader: the same links on the home, the contract
 * guides, Developers, Docs and Pricing. No prices. The GitHub icon is the
 * footer's only link to the repository.
 */

import Link from "next/link";
import { brand } from "@/config/brand";
import { features } from "@/config/features";
import { writeLocaleCookie } from "@/lib/locale-cookie";
import { contractPath, developersPath, type PageLocale } from "@/lib/contract-pages-paths";
import { AGENTS_PATH, NAV_COPY } from "./nav-copy";

export function PublicFooter({ locale }: { locale: PageLocale }) {
  const copy = NAV_COPY[locale];
  const keepLanguage = () => writeLocaleCookie(locale);
  const link = "hover:text-foreground transition-colors";
  const dot = <span className="text-border" aria-hidden>&middot;</span>;

  return (
    <footer className="py-10 px-6 border-t border-border" data-testid="public-footer">
      <div className="max-w-7xl mx-auto flex flex-col items-center gap-4 text-sm text-muted-foreground">
        <a href={brand.links.website} className="flex items-center gap-2">
          <img src="/logo-negative.svg" alt={brand.company} style={{ height: "26px", width: "auto" }} />
          <span className="text-xs font-body">{copy.tagline}</span>
        </a>

        {brand.footer && (
          <p className="text-xs text-center">
            {brand.footer.text}{" "}
            {Object.values(brand.footer.links).map((l, i) => (
              <span key={l.url}>
                {i > 0 && <span className="mx-1">&middot;</span>}
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {l.label}
                </a>
              </span>
            ))}
          </p>
        )}

        <nav aria-label={copy.menu} className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
          <Link href={contractPath(locale)} className={link}>
            {copy.contracts}
          </Link>
          {dot}
          <Link href={developersPath(locale)} className={link}>
            {copy.developers}
          </Link>
          {features.publicDocs && (
            <>
              {dot}
              <Link href={AGENTS_PATH} onClick={keepLanguage} className={link}>
                {copy.agents}
              </Link>
            </>
          )}
          {features.publicDocs && (
            <>
              {dot}
              <Link href="/docs" onClick={keepLanguage} className={link}>
                {copy.docs}
              </Link>
            </>
          )}
          {features.stripeEnabled && (
            <>
              {dot}
              <Link href="/pricing" onClick={keepLanguage} className={link}>
                {copy.pricing}
              </Link>
            </>
          )}
          {dot}
          <a href={brand.links.terms} target="_blank" rel="noopener noreferrer" className={link}>
            {copy.terms}
          </a>
          {dot}
          <a href={brand.links.privacy} target="_blank" rel="noopener noreferrer" className={link}>
            {copy.privacy}
          </a>
          {dot}
          <Link href="/licenses" className={link}>
            {copy.licences}
          </Link>
          {dot}
          <a
            href="https://github.com/RINDOGATAN"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className={link}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
        </nav>
      </div>
    </footer>
  );
}
