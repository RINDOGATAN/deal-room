"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { choiceFromCookieHeader, getCurrency, subscribeCurrency, type Currency } from "@/lib/currency";

/**
 * The visitor's currency: their own choice, else the region guess the
 * middleware wrote. The first render (and the prerendered HTML) uses
 * dollars; the cookie switches a European visitor to euros on load.
 */
export function useCurrency(): Currency {
  return useSyncExternalStore(subscribeCurrency, getCurrency, serverCurrency);
}

/** The visitor's own choice from the switch, or null (then the server's default applies). */
export function useCurrencyChoice(): Currency | null {
  return useSyncExternalStore(subscribeCurrency, readChoice, noChoice);
}

const serverCurrency = (): Currency => "USD";
const readChoice = (): Currency | null =>
  typeof document === "undefined" ? null : choiceFromCookieHeader(document.cookie);
const noChoice = (): Currency | null => null;

/** Kit premium price, one of the pair `pilot.kitPriceUSD` / `pilot.kitPriceEUR`. */
export function useKitPrice(): string {
  const t = useTranslations("pilot");
  return useCurrency() === "EUR" ? t("kitPriceEUR") : t("kitPriceUSD");
}
