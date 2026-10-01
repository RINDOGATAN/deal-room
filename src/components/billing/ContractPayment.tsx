"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Pay per contract, on the deal pages.
 *
 * `<PaidDownloads>` wraps the download links: with Stripe off, or once the
 * deal is paid, it renders them unchanged; otherwise it renders the "Get
 * this contract" action in their place. `<ContractPaymentPanel>` is the
 * same action with its explanation, for the signing page. Amounts come
 * from `PRICE_DISPLAY_CONTRACT` or the Stripe price (never from code); if
 * neither is known the button shows no number rather than a wrong one.
 * `<CheckoutReturn>`
 * confirms the payment when Stripe sends the person back to the deal.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";
import { features } from "@/config/features";
import { trpc } from "@/lib/trpc";
import type { BillingCurrency } from "@/lib/contract-billing";
import { toBillingCurrency } from "@/lib/currency";
import { useCurrencyChoice } from "@/hooks/useCurrency";
import { CurrencySwitch } from "@/components/pricing/CurrencySwitch";

function useDealPayment(dealId: string) {
  return trpc.billing.getDealPayment.useQuery(
    { dealRoomId: dealId },
    { enabled: features.stripeEnabled },
  );
}

function GetContract({ dealId, variant }: { dealId: string; variant: "inline" | "panel" }) {
  const t = useTranslations("contractBilling");
  const { data: pricing } = trpc.billing.getContractPricing.useQuery();
  const choice = useCurrencyChoice();
  const [busy, setBusy] = useState(false);

  // One currency: the visitor's switch choice, else the server's default
  // (the account's billing currency, else the region guess).
  const currency: BillingCurrency = choice ? toBillingCurrency(choice) : pricing?.defaultCurrency ?? "usd";
  const contractPrice = pricing?.display?.contract[currency] ?? null;

  const open = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && body.url) {
        toast.info(t("opening"));
        window.location.href = body.url;
        return;
      }
      toast.error(body.error || t("failed"));
    } catch {
      toast.error(t("failed"));
    }
    setBusy(false);
  };

  const currencySwitch = <CurrencySwitch current={currency === "eur" ? "EUR" : "USD"} />;

  const button = (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      data-testid="get-contract"
      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
      {contractPrice ? t("getContractPrice", { price: contractPrice }) : t("getContract")}
    </button>
  );

  if (variant === "inline") {
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {button}
          {currencySwitch}
        </div>
        <p className="text-xs text-muted-foreground">{t("businessOnly")}</p>
      </div>
    );
  }

  return (
    <div data-testid="contract-payment-panel" className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm text-foreground">{t("explain")}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {button}
        {currencySwitch}
      </div>
      <p className="text-xs text-muted-foreground">{t("businessOnly")}</p>
    </div>
  );
}

/** The download links once the contract is paid; the purchase action before. */
export function PaidDownloads({ dealId, children }: { dealId: string; children: ReactNode }) {
  const { data } = useDealPayment(dealId);
  if (!features.stripeEnabled) return <>{children}</>;
  if (!data) return null;
  if (data.paid) return <>{children}</>;
  return <GetContract dealId={dealId} variant="inline" />;
}

/** The purchase action with its explanation; nothing once the contract is paid. */
export function ContractPaymentPanel({ dealId, className }: { dealId: string; className?: string }) {
  const { data } = useDealPayment(dealId);
  if (!features.stripeEnabled || !data || data.paid) return null;
  return (
    <div className={className}>
      <GetContract dealId={dealId} variant="panel" />
    </div>
  );
}

/**
 * On return from Stripe (`?paid=1&session_id=…`), record the payment at
 * once and refresh the deal's state. The webhook records the same payment
 * independently; both paths are idempotent.
 */
export function CheckoutReturn({ dealId }: { dealId: string }) {
  const t = useTranslations("contractBilling");
  const utils = trpc.useUtils();
  const done = useRef(false);

  useEffect(() => {
    if (!features.stripeEnabled || done.current) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (!sessionId) return;
    done.current = true;

    const clean = () => {
      const url = new URL(window.location.href);
      ["paid", "session_id", "checkout"].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState(null, "", url.toString());
    };

    toast.info(t("confirming"));
    fetch("/api/checkout/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => {
        if (res.ok) toast.success(t("paid"));
        else toast.info(t("notConfirmed"));
      })
      .catch(() => toast.info(t("notConfirmed")))
      .finally(() => {
        clean();
        void utils.billing.getDealPayment.invalidate({ dealRoomId: dealId });
        void utils.billing.getContractPricing.invalidate();
      });
  }, [dealId, t, utils]);

  return null;
}
