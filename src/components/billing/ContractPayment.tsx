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
 * from the Stripe prices (never from code); if they cannot be read the
 * button shows no number rather than a wrong one. `<CheckoutReturn>`
 * confirms the payment when Stripe sends the person back to the deal.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";
import { features } from "@/config/features";
import { trpc } from "@/lib/trpc";
import { formatAmount, type BillingCurrency } from "@/lib/contract-billing";
import { cn } from "@/lib/utils";

function useDealPayment(dealId: string) {
  return trpc.billing.getDealPayment.useQuery(
    { dealRoomId: dealId },
    { enabled: features.stripeEnabled },
  );
}

function GetContract({ dealId, variant }: { dealId: string; variant: "inline" | "panel" }) {
  const t = useTranslations("contractBilling");
  const locale = useLocale();
  const { data: pricing } = trpc.billing.getContractPricing.useQuery();
  const [chosen, setChosen] = useState<BillingCurrency | null>(null);
  const [busy, setBusy] = useState<"contract" | "plan" | null>(null);

  const currency = chosen ?? pricing?.defaultCurrency ?? "usd";
  const amountOf = (product: "contract" | "monthly") => {
    const minor = pricing?.prices?.[product]?.[currency];
    return typeof minor === "number" ? formatAmount(minor, currency, locale) : null;
  };
  const contractPrice = amountOf("contract");
  const planPrice = amountOf("monthly");

  const open = async (what: "contract" | "plan") => {
    setBusy(what);
    try {
      const res = await fetch(what === "contract" ? `/api/deals/${dealId}/checkout` : "/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          what === "contract"
            ? { currency }
            : { plan: "unlimited", currency, returnUrl: `/deals/${dealId}` },
        ),
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
    setBusy(null);
  };

  const currencySwitch = (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span>{t("payIn")}</span>
      {(["usd", "eur"] as const).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setChosen(c)}
          aria-pressed={currency === c}
          className={cn(
            "px-1.5 py-0.5 rounded border",
            currency === c ? "border-primary text-foreground" : "border-border hover:text-foreground",
          )}
        >
          {c.toUpperCase()}
        </button>
      ))}
    </span>
  );

  const button = (
    <button
      type="button"
      onClick={() => open("contract")}
      disabled={busy !== null}
      data-testid="get-contract"
      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
    >
      {busy === "contract" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
      {contractPrice ? t("getContractPrice", { price: contractPrice }) : t("getContract")}
    </button>
  );

  const planLink = (
    <button
      type="button"
      onClick={() => open("plan")}
      disabled={busy !== null}
      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-60"
    >
      {planPrice ? t("planOffer", { price: planPrice }) : t("planOfferNoPrice")}
    </button>
  );

  if (variant === "inline") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {button}
        {currencySwitch}
        {planLink}
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
      <div>{planLink}</div>
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
 * On return from Stripe (`?paid=1&session_id=…` or `?plan=active`), record
 * the payment at once and refresh the deal's state. The webhook records the
 * same payment independently; both paths are idempotent.
 */
export function CheckoutReturn({ dealId }: { dealId: string }) {
  const t = useTranslations("contractBilling");
  const utils = trpc.useUtils();
  const done = useRef(false);

  useEffect(() => {
    if (!features.stripeEnabled || done.current) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const planReturn = params.get("plan") === "active";
    if (!sessionId && !planReturn) return;
    done.current = true;

    const clean = () => {
      const url = new URL(window.location.href);
      ["paid", "session_id", "plan", "checkout"].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState(null, "", url.toString());
    };

    if (planReturn && !sessionId) {
      toast.success(t("planActive"));
      clean();
      void utils.billing.invalidate();
      return;
    }

    toast.info(t("confirming"));
    fetch("/api/checkout/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { kind?: string };
        if (res.ok) toast.success(body.kind === "plan" ? t("planActive") : t("paid"));
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
