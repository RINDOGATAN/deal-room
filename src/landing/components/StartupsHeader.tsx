// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { Globe, Menu, X } from "lucide-react";
import { useState } from "react";
import { brand } from "@/config/brand";
import { features } from "@/config/features";
import { contractPath } from "@/lib/contract-pages-paths";

interface StartupsHeaderProps {
  t: (key: string) => string;
  locale: "en" | "es";
  onLocaleToggle: () => void;
  onSignup: () => void;
}

const StartupsHeader = ({ t, locale, onLocaleToggle, onSignup }: StartupsHeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = () => setIsMenuOpen(false);
  const contractsHref = contractPath(locale);

  return (
    // Sticky, not fixed: the header keeps its place in the page, so the content
    // always starts below it whatever the text size (a fixed header covered the
    // top of the page on phones with larger text). The opaque band behind it
    // keeps scrolled content from showing through the gap above the bar.
    <header className="sticky top-0 z-50 bg-background px-4 pt-4 pb-2">
      <div className="nav-header px-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between h-14">
          <a href={brand.links.website} className="flex items-center gap-3">
            <img src="/logo-negative.svg" alt={brand.company} style={{ height: "28px", width: "auto" }} />
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 bg-accent/10 text-accent rounded-full text-xs font-medium uppercase tracking-wider font-body">
              {t("header.badge")}
            </span>
          </a>

          <div className="hidden md:flex items-center gap-3">
            <a href={contractsHref} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("header.contracts")}
            </a>
            {features.stripeEnabled && (
              <a href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {t("header.pricing")}
              </a>
            )}
            <button
              onClick={onLocaleToggle}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Globe className="w-4 h-4" />
              {locale === "en" ? "ES" : "EN"}
            </button>
            <button onClick={onSignup} className="btn-primary text-sm py-2 px-4">
              {t("header.cta")}
            </button>
          </div>

          <button className="md:hidden p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 px-2 border-t border-border">
            <div className="flex flex-col gap-3">
              <a href={contractsHref} onClick={closeMenu} className="text-sm text-muted-foreground px-2 py-1">
                {t("header.contracts")}
              </a>
              {features.stripeEnabled && (
                <a href="/pricing" onClick={closeMenu} className="text-sm text-muted-foreground px-2 py-1">
                  {t("header.pricing")}
                </a>
              )}
              <button
                onClick={() => { onLocaleToggle(); closeMenu(); }}
                className="flex items-center gap-2 text-sm text-muted-foreground px-2 py-1"
              >
                <Globe className="w-4 h-4" />
                {locale === "en" ? "Espa\u00f1ol" : "English"}
              </button>
              <button
                onClick={() => { onSignup(); closeMenu(); }}
                className="btn-primary text-sm py-2 px-4"
              >
                {t("header.cta")}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default StartupsHeader;
