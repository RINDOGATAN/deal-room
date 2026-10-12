"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useLocale } from "next-intl";
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";

/**
 * Docs and Pricing: the header and footer every public page shows
 * (PublicHeader, PublicFooter), in the cookie's
 * language. The language control writes the cookie and refreshes.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = useLocale() === "es" ? "es" : "en";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader locale={locale} />
      <main className="flex-1">{children}</main>
      <PublicFooter locale={locale} />
    </div>
  );
}
