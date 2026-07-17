"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { useTranslations } from "next-intl";
import { brand } from "@/config/brand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("authFooter");
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src={brand.assets.logo} alt={brand.company} style={{ height: "28px", width: "auto" }} />
            <span className="text-muted-foreground hidden sm:inline whitespace-nowrap" style={{ fontFamily: "var(--font-display), 'Jost', sans-serif", fontWeight: 600 }}>DEALROOM</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 space-y-3">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
          <a
            href={brand.links.privacy}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            {t("privacy")}
          </a>
          <span className="hidden sm:inline">&middot;</span>
          <a
            href={brand.links.terms}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            {t("terms")}
          </a>
          <span className="hidden sm:inline">&middot;</span>
          <Link
            href="/docs/how-it-works"
            className="hover:text-foreground transition-colors"
          >
            {t("howItWorks")}
          </Link>
          <span className="hidden sm:inline">&middot;</span>
          {/* AGPL §13: offer of Corresponding Source to network users */}
          <a
            href={brand.links.sourceCode}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            {t("sourceCode")}
          </a>
        </div>
        {/* Quiet operator hint: self-hosted installs need a way to find /admin */}
        <div className="container mx-auto px-6 text-center text-xs text-muted-foreground/70">
          <Link href="/admin" className="hover:text-foreground transition-colors">
            {t("platformAdmin")} → /admin
          </Link>
        </div>
      </footer>
    </div>
  );
}
