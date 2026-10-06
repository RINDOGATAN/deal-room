"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { useSession } from "next-auth/react";
import { BookOpen, Code, FileText, Globe, Library } from "lucide-react";
import { brand } from "@/config/brand";
import { features } from "@/config/features";
import { writeLocaleCookie } from "@/lib/locale-cookie";
import { contractPath, developersPath, type PageLocale } from "@/lib/contract-pages-paths";
import { CONTRACT_COPY } from "./copy";

/**
 * Header of the public contract pages: the same shape as the docs and
 * pricing header, in the language of the URL. Signed-in visitors see
 * "My deals" instead of "Sign in".
 */
export function ContractsHeader({
  locale,
  alternateHref,
  active = "contracts",
}: {
  locale: PageLocale;
  /** The same page in the other language. */
  alternateHref: string;
  /** The link shown as the current section. */
  active?: "contracts" | "developers";
}) {
  const copy = CONTRACT_COPY[locale];
  const { status } = useSession();
  const other: PageLocale = locale === "en" ? "es" : "en";

  const pill =
    "flex items-center gap-2 px-2 sm:px-4 py-2 text-sm font-medium rounded-full transition-colors text-muted-foreground hover:text-foreground hover:bg-secondary";
  const current = `${pill} bg-primary/10 text-primary hover:text-primary`;

  return (
    <header className="sticky top-0 z-20 px-4 pt-3">
      <div className="max-w-7xl mx-auto bg-card/80 backdrop-blur-md border border-border rounded-xl md:rounded-full px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img src={brand.assets.logo} alt={brand.company} style={{ height: "28px", width: "auto" }} />
            <span
              className="text-muted-foreground hidden sm:inline"
              style={{ fontFamily: "var(--font-display), 'Jost', sans-serif", fontWeight: 600 }}
            >
              DEALROOM
            </span>
          </Link>

          <nav className="flex items-center gap-0.5 sm:gap-1">
            <Link href={contractPath(locale)} className={active === "contracts" ? current : pill}>
              <Library className="w-4 h-4" />
              <span className="hidden sm:inline">{copy.navContracts}</span>
            </Link>
            <Link href={developersPath(locale)} className={active === "developers" ? current : pill}>
              <Code className="w-4 h-4" />
              <span className="hidden sm:inline">{copy.navDevelopers}</span>
            </Link>
            {features.publicDocs && (
              <Link href="/docs" className={pill}>
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">{copy.navDocs}</span>
              </Link>
            )}
            <Link
              href={alternateHref}
              hrefLang={other}
              onClick={() => writeLocaleCookie(other)}
              className={pill}
              title={copy.otherLanguage}
            >
              <Globe className="w-4 h-4" />
              <span className="font-medium">{other.toUpperCase()}</span>
            </Link>
            {status === "authenticated" ? (
              <Link
                href="/deals"
                className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-primary border border-primary rounded-full hover:bg-secondary transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">{copy.myDeals}</span>
              </Link>
            ) : (
              <Link
                href="/sign-in"
                className="px-2 sm:px-4 py-1.5 text-sm font-medium whitespace-nowrap text-primary border border-primary rounded-full hover:bg-secondary transition-colors"
              >
                {copy.signIn}
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
