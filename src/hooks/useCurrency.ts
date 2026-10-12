"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { displayCurrency, getCurrency, subscribeCurrency, type Currency } from "@/lib/currency";

/**
 * The visitor's currency: the region guess the middleware wrote. There is
 * no switch. The first render (and the prerendered HTML) uses dollars; the
 * cookie switches a visitor in the EU to euros on load.
 */
export function useCurrency(): Currency {
  return useSyncExternalStore(subscribeCurrency, getCurrency, serverCurrency);
}

const serverCurrency = (): Currency => "USD";

/**
 * The currency a page in the current language shows: euros on every Spanish
 * page (no Spanish page shows a dollar price), the
 * visitor's region currency otherwise.
 */
export function useDisplayCurrency(): Currency {
  const visitor = useCurrency();
  return displayCurrency(useLocale(), visitor);
}

/** Kit premium price, one of the pair `pilot.kitPriceUSD` / `pilot.kitPriceEUR`. */
export function useKitPrice(): string {
  const t = useTranslations("pilot");
  return useDisplayCurrency() === "EUR" ? t("kitPriceEUR") : t("kitPriceUSD");
}
