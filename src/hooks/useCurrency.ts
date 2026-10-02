"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { getCurrency, subscribeCurrency, type Currency } from "@/lib/currency";

/**
 * The visitor's currency: the region guess the middleware wrote. There is
 * no switch. The first render (and the prerendered HTML) uses dollars; the
 * cookie switches a European visitor to euros on load.
 */
export function useCurrency(): Currency {
  return useSyncExternalStore(subscribeCurrency, getCurrency, serverCurrency);
}

const serverCurrency = (): Currency => "USD";

/** Kit premium price, one of the pair `pilot.kitPriceUSD` / `pilot.kitPriceEUR`. */
export function useKitPrice(): string {
  const t = useTranslations("pilot");
  return useCurrency() === "EUR" ? t("kitPriceEUR") : t("kitPriceUSD");
}
