"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

/**
 * The /launch journey is the Delaware C-Corp formation flow — US-only.
 * Spanish-locale users have no business here, so we redirect them to
 * /deals instead. The dashboard nav and empty-state card already hide
 * the entry point on the Spanish UI; this layout closes the URL gap
 * (bookmarks, shared links, locale switches mid-flow).
 */
export default function LaunchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    if (locale === "es") {
      router.replace("/deals");
    }
  }, [locale, router]);

  if (locale === "es") {
    return null;
  }

  return <>{children}</>;
}
