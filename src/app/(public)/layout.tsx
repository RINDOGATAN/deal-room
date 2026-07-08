"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { BookOpen, FileText } from "lucide-react";
import { brand } from "@/config/brand";
import { features } from "@/config/features";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { status } = useSession();
  const tFooter = useTranslations("footer");
  const tAuth = useTranslations("auth");
  const tNav = useTranslations("nav");
  const isDocsActive = pathname.startsWith("/docs");
  const isAuthenticated = status === "authenticated";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Floating Glassmorphism Header — matches dashboard */}
      <header className="sticky top-0 z-20 px-4 pt-3">
        <div className="max-w-7xl mx-auto bg-card/80 backdrop-blur-md border border-border rounded-xl md:rounded-full px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <img src={brand.assets.logo} alt={brand.company} style={{ height: "28px", width: "auto" }} />
              <span className="text-muted-foreground" style={{ fontFamily: "var(--font-display), 'Jost', sans-serif", fontWeight: 600 }}>DEALROOM</span>
            </Link>

            <nav className="flex items-center gap-1">
              {features.publicDocs && (
                <Link
                  href="/docs"
                  className={`
                    flex items-center gap-2 px-4 py-2 text-sm font-medium
                    rounded-full transition-colors
                    ${
                      isDocsActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }
                  `}
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="hidden sm:inline">{tFooter("userGuide")}</span>
                </Link>
              )}
              {isAuthenticated ? (
                <Link
                  href="/deals"
                  className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-primary border border-primary rounded-full hover:bg-secondary transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>{tNav("myDeals")}</span>
                </Link>
              ) : (
                <Link
                  href="/sign-in"
                  className="px-4 py-1.5 text-sm font-medium text-primary border border-primary rounded-full hover:bg-secondary transition-colors"
                >
                  {tAuth("signIn")}
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="py-4 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-2 text-sm text-muted-foreground">
          {/* Brand footer text (northend.law) */}
          {brand.footer && (
            <p className="text-xs">
              {brand.footer.text}{" "}
              &middot;{" "}
              {Object.values(brand.footer.links).map((link, i) => (
                <span key={link.url}>
                  {i > 0 && <span className="mx-1">&middot;</span>}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {link.label}
                  </a>
                </span>
              ))}
            </p>
          )}

          {/* Standard footer links */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {features.publicDocs && (
              <>
                <Link
                  href="/docs"
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {tFooter("userGuide")}
                </Link>
                <span className="text-border">&middot;</span>
              </>
            )}
            <a
              href={brand.links.terms}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              {tFooter("termsOfUse")}
            </a>
            <span className="text-border">&middot;</span>
            <a
              href={brand.links.privacy}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              {tFooter("privacyNotice")}
            </a>
            <span className="text-border">&middot;</span>
            {/* AGPL §13: offer of Corresponding Source to network users */}
            <a
              href={brand.links.sourceCode}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              {tFooter("sourceCode")}
            </a>
            <span className="text-border">&middot;</span>
            <LanguageSwitcher />
          </div>
        </div>
      </footer>
    </div>
  );
}
