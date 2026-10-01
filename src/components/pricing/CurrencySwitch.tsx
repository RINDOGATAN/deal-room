"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useTranslations } from "next-intl";
import { otherCurrency, setCurrencyChoice, type Currency } from "@/lib/currency";
import { cn } from "@/lib/utils";

/**
 * The quiet "Prices in USD" / "Precios en EUR" text link: it names the
 * other currency and switches to it for the rest of the browser session.
 * `reload` re-renders a server-rendered page (the pricing page) with the
 * new choice; client components follow the change without it.
 */
export function CurrencySwitch({
  current,
  reload = false,
  className,
}: {
  current: Currency;
  reload?: boolean;
  className?: string;
}) {
  const t = useTranslations("currency");
  const other = otherCurrency(current);
  return (
    <button
      type="button"
      data-testid="currency-switch"
      onClick={() => {
        setCurrencyChoice(other);
        if (reload) window.location.reload();
      }}
      className={cn(
        "text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground",
        className,
      )}
    >
      {t("pricesIn", { currency: other })}
    </button>
  );
}
