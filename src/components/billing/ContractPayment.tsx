"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Pay per contract, on the deal pages.
 *
 * `<PaidDownloads>` wraps the download links: with Stripe off, or once the
 * deal is paid, it renders them unchanged; otherwise it renders the "Get
 * this contract" action in their place (or nothing, where the page already
 * has that action). `useGetContract` is the same action for the signing
 * page, which shows it as its one primary button. The currency is the
 * server's (the account's billing currency, else the region); there is no
 * switch. Amounts come from `PRICE_DISPLAY_CONTRACT` or the Stripe price
 * (never from code); if neither is known the button shows no number
 * rather than a wrong one. `<CheckoutReturn>` confirms the payment when
 * Stripe sends the person back to the deal.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";
import { features } from "@/config/features";
import { trpc } from "@/lib/trpc";

export function useDealPayment(dealId: string) {
  return trpc.billing.getDealPayment.useQuery(
    { dealRoomId: dealId },
    { enabled: features.stripeEnabled },
  );
}

/** The purchase: its label (with the price when known) and the call that opens the checkout. */
export function useGetContract(dealId: string) {
  const t = useTranslations("contractBilling");
  const { data: pricing } = trpc.billing.getContractPricing.useQuery(undefined, {
    enabled: features.stripeEnabled,
  });
  const [busy, setBusy] = useState(false);

  const price = pricing?.display?.contract[pricing.defaultCurrency] ?? null;
  const label = price ? t("getContractPrice", { price }) : t("getContract");

  const open = async () => {
    setBusy(true);
    try {
      // No currency in the body: the server charges the one it shows.
      const res = await fetch(`/api/deals/${dealId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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

  return { label, busy, open };
}

function GetContractButton({ dealId }: { dealId: string }) {
  const { label, busy, open } = useGetContract(dealId);
  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      data-testid="get-contract"
      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
      {label}
    </button>
  );
}

/**
 * The download links once the contract is paid. Before: the purchase
 * button, or nothing with `unpaid="hide"` (where the page's own primary
 * action already leads to the purchase).
 */
export function PaidDownloads({
  dealId,
  children,
  unpaid = "buy",
}: {
  dealId: string;
  children: ReactNode;
  unpaid?: "buy" | "hide";
}) {
  const { data } = useDealPayment(dealId);
  if (!features.stripeEnabled) return <>{children}</>;
  if (!data) return null;
  if (data.paid) return <>{children}</>;
  return unpaid === "hide" ? null : <GetContractButton dealId={dealId} />;
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
