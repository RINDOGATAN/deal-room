// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { defaultLocale, type Locale } from "./config";
import { resolveChosenLocale } from "@/lib/locale-cookie";

/**
 * The visitor's chosen locale: the LAST `locale` value in the Cookie header
 * (legacy `NEXT_LOCALE` as fallback), else English. Read from the raw header
 * so duplicate cookies resolve by the shared rule, not by parser order.
 */
export function localeFromCookieHeader(cookieHeader: string | null | undefined): Locale {
  return resolveChosenLocale(cookieHeader) ?? defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = localeFromCookieHeader((await headers()).get("cookie"));

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
