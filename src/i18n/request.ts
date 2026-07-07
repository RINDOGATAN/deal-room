// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { defaultLocale, locales, type Locale } from "./config";

function isLocale(v: string | undefined): v is Locale {
  return locales.includes(v as Locale);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();

  // 1. Dashboard cookie (set by LanguageSwitcher)
  const nextLocale = cookieStore.get("NEXT_LOCALE")?.value;
  // 2. Landing page cookie (set by setLocaleCookie on landing pages)
  const landingLocale = cookieStore.get("locale")?.value;
  // 3. Browser Accept-Language header
  const acceptLang = (await headers()).get("accept-language");
  const browserLocale = acceptLang?.match(/\b(es)\b/) ? "es" : undefined;

  const locale: Locale = isLocale(nextLocale)
    ? nextLocale
    : isLocale(landingLocale)
      ? landingLocale
      : isLocale(browserLocale)
        ? browserLocale
        : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
