"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrency } from "@/hooks/useCurrency";
import { CONTRACT_COPY } from "./copy";
import type { PageLocale } from "@/lib/contract-pages-paths";

type PriceInfo = { billing: false; contract: null } | { billing: true; contract: { usd: string | null; eur: string | null } };

/**
 * The one price line of a contract page. The page itself is static; the
 * price comes from the price configuration (`/api/pricing/contract`) and
 * shows in the visitor's one currency, as on /pricing.
 */
export function PriceLine({ locale }: { locale: PageLocale }) {
  const copy = CONTRACT_COPY[locale];
  const currency = useCurrency();
  const [info, setInfo] = useState<PriceInfo | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/pricing/contract?locale=${locale}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PriceInfo | null) => {
        if (live && data) setInfo(data);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [locale]);

  let text: string = copy.priceFree;
  if (info && !info.billing) text = copy.priceSelfHost;
  if (info?.billing) {
    const price = currency === "EUR" ? info.contract.eur : info.contract.usd;
    text = price ? copy.pricePaid(price) : copy.pricePaidNoAmount;
  }

  return (
    <p className="text-sm text-muted-foreground">
      {text}{" "}
      {info?.billing && (
        <Link href="/pricing" className="text-primary hover:underline">
          {copy.pricingLink}
        </Link>
      )}
    </p>
  );
}
