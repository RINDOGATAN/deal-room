"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrency } from "@/hooks/useCurrency";
import type { PageLocale } from "@/lib/contract-pages-paths";
import { DEVELOPERS_COPY } from "./copy";

type Amounts = { usd: string | null; eur: string | null };
type PriceInfo =
  | { billing: false; contract: null }
  | { billing: true; contract: Amounts; pack?: Amounts; packSize?: number };

/**
 * The price of a contract and of a pack of credits, from the same price
 * configuration /pricing reads (`/api/pricing/contract`), in the visitor's
 * one currency. The page is static; only this part loads in the browser.
 */
export function DeveloperPrices({ locale }: { locale: PageLocale }) {
  const copy = DEVELOPERS_COPY[locale];
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

  const pick = (a?: Amounts) => (a ? (currency === "EUR" ? a.eur : a.usd) : null);
  const lines: string[] = [];
  if (!info) {
    lines.push(copy.priceFree);
  } else if (!info.billing) {
    lines.push(copy.priceSelfHost);
  } else {
    const contract = pick(info.contract);
    lines.push(contract ? copy.pricePaid(contract) : copy.pricePaidNoAmount);
    if (info.packSize) {
      const pack = pick(info.pack);
      lines.push(pack ? copy.pricePack(info.packSize, pack) : copy.pricePackNoAmount(info.packSize));
    }
  }

  return (
    <div className="text-muted-foreground space-y-2">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {info?.billing && (
        <p>
          <Link href="/pricing" className="text-primary hover:underline">
            {copy.pricingLink}
          </Link>
        </p>
      )}
    </div>
  );
}
