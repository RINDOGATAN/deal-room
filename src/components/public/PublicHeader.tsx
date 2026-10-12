"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The one header of Dealroom's public pages: the home,
 * the contract guides, Developers, Docs (Agents is its agent API section) and
 * Pricing show the same links in the same order, so the navigation never
 * changes as the visitor moves between them. Dealroom is not instance-based
 * (everyone works on the same service, each with their own contracts), so
 * besides the core links it carries the product links for developers and
 * agents.
 *
 * The language control depends on the page: a page whose URL carries the
 * language links to its twin (`languageHref`); the home switches in place
 * (`onLanguageToggle`); the cookie-based pages (Docs, Pricing) write the
 * cookie and refresh.
 *
 * Whether the visitor is signed in comes from one request to the session
 * endpoint, not from the next-auth client: the public pages do not download
 * that client (page speed).
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Globe, Menu, X } from "lucide-react";
import { brand } from "@/config/brand";
import { features } from "@/config/features";
import { writeLocaleCookie } from "@/lib/locale-cookie";
import { contractPath, developersPath, type PageLocale } from "@/lib/contract-pages-paths";
import { AGENTS_PATH, NAV_COPY, navSectionFor, type NavSection } from "./nav-copy";
import { useSignedIn } from "./use-signed-in";

interface PublicHeaderProps {
  locale: PageLocale;
  /** The same page in the other language, for pages whose URL carries the language. */
  languageHref?: string;
  /** Switches the language in place (the home). */
  onLanguageToggle?: () => void;
}

export function PublicHeader({ locale, languageHref, onLanguageToggle }: PublicHeaderProps) {
  const copy = NAV_COPY[locale];
  const other: PageLocale = locale === "en" ? "es" : "en";
  const pathname = usePathname();
  const current = navSectionFor(pathname);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const signedIn = useSignedIn();
  const [open, setOpen] = useState(false);

  // Docs, Agents and Pricing take their language from the cookie: links to
  // them from a page in the other language set it first.
  const keepLanguage = () => writeLocaleCookie(locale);

  type NavLink = { id: Exclude<NavSection, null>; href: string; label: string; cookie?: boolean };
  // One link per line, each with its own feature guard.
  const links = [
    { id: "contracts", href: contractPath(locale), label: copy.contracts },
    { id: "developers", href: developersPath(locale), label: copy.developers },
    features.publicDocs && { id: "agents", href: AGENTS_PATH, label: copy.agents, cookie: true },
    features.publicDocs && { id: "docs", href: "/docs", label: copy.docs, cookie: true },
    features.stripeEnabled && { id: "pricing", href: "/pricing", label: copy.pricing, cookie: true },
  ].filter(Boolean) as NavLink[];

  const switchLanguage = () => {
    setOpen(false);
    writeLocaleCookie(other);
    if (onLanguageToggle) onLanguageToggle();
    else startTransition(() => router.refresh());
  };

  const pill = "px-3 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap";
  const idle = `${pill} text-muted-foreground hover:text-foreground hover:bg-secondary`;
  const on = `${pill} bg-primary/10 text-primary`;

  const language = languageHref ? (
    <Link
      href={languageHref}
      hrefLang={other}
      onClick={() => {
        setOpen(false);
        writeLocaleCookie(other);
      }}
      className={`${idle} inline-flex items-center gap-1.5`}
      title={copy.otherLanguage}
      data-testid="nav-language"
    >
      <Globe className="w-4 h-4" aria-hidden />
      {other.toUpperCase()}
    </Link>
  ) : (
    <button
      type="button"
      onClick={switchLanguage}
      className={`${idle} inline-flex items-center gap-1.5`}
      title={copy.otherLanguage}
      data-testid="nav-language"
    >
      <Globe className="w-4 h-4" aria-hidden />
      {other.toUpperCase()}
    </button>
  );

  const account =
    signedIn ? (
      <Link
        href="/deals"
        className="px-4 py-1.5 text-sm font-medium whitespace-nowrap text-primary border border-primary rounded-full hover:bg-secondary transition-colors"
      >
        {copy.myDeals}
      </Link>
    ) : (
      <Link
        href="/sign-in"
        className="px-4 py-1.5 text-sm font-medium whitespace-nowrap text-primary border border-primary rounded-full hover:bg-secondary transition-colors"
      >
        {copy.signIn}
      </Link>
    );

  return (
    <header className="sticky top-0 z-30 bg-background px-4 pt-3 pb-2" data-testid="public-header">
      <div className="max-w-7xl mx-auto bg-card/80 backdrop-blur-md border border-border rounded-2xl lg:rounded-full px-4 lg:px-6 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <a href={brand.links.website} className="shrink-0" aria-label={brand.company}>
              <img src="/logo-negative.svg" alt={brand.company} style={{ height: "28px", width: "auto" }} />
            </a>
            <Link
              href="/"
              className="inline-flex items-center px-2.5 py-0.5 bg-accent/10 text-accent rounded-full text-xs font-medium uppercase tracking-wider font-body"
            >
              Dealroom
            </Link>
          </div>

          <nav aria-label="Dealroom" className="hidden lg:flex items-center gap-1" data-testid="nav-links">
            {links.map((l) => (
              <Link
                key={l.id}
                href={l.href}
                onClick={l.cookie ? keepLanguage : undefined}
                aria-current={current === l.id ? "page" : undefined}
                className={current === l.id ? on : idle}
              >
                {l.label}
              </Link>
            ))}
            {language}
            <span className="ml-1">{account}</span>
          </nav>

          <button
            type="button"
            className="lg:hidden p-2"
            aria-expanded={open}
            aria-controls="public-menu"
            aria-label={open ? copy.closeMenu : copy.menu}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="w-6 h-6" aria-hidden /> : <Menu className="w-6 h-6" aria-hidden />}
          </button>
        </div>

        {open && (
          <nav id="public-menu" aria-label="Dealroom" className="lg:hidden pt-3 pb-2 border-t border-border mt-2.5 flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.id}
                href={l.href}
                onClick={() => {
                  setOpen(false);
                  if (l.cookie) keepLanguage();
                }}
                aria-current={current === l.id ? "page" : undefined}
                className={current === l.id ? on : idle}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex items-center justify-between gap-3 pt-2">
              {language}
              {account}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
