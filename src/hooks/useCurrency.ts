"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { getCurrency, type Currency } from "@/lib/currency";

/**
 * The visitor's currency. The first render (and the prerendered HTML) uses
 * dollars, as the storefront rule does for an unknown visitor; the cookie
 * set by the middleware switches a known non-US visitor to euros on load.
 */
export function useCurrency(): Currency {
  // The cookie does not change while the page is open, so nothing to subscribe to.
  return useSyncExternalStore(noSubscription, getCurrency, serverCurrency);
}

const noSubscription = () => () => {};
const serverCurrency = (): Currency => "USD";

/** Kit premium price, one of the pair `pilot.kitPriceUSD` / `pilot.kitPriceEUR`. */
export function useKitPrice(): string {
  const t = useTranslations("pilot");
  return useCurrency() === "EUR" ? t("kitPriceEUR") : t("kitPriceUSD");
}
