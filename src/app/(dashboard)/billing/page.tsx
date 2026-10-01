"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Billing (Stripe on only; the layout 404s otherwise).
 *
 * Pay per contract (2026-09-29): each contract is paid on its deal page,
 * when it is downloaded or signed. This page explains the price, opens the
 * Stripe billing portal for receipts, lists the paid contracts and credit
 * packs with their invoice links, and lists any earlier per-skill
 * subscriptions so their holders can cancel them. There is no plan (the
 * monthly plan was discarded before launch). Amounts come from
 * `PRICE_DISPLAY_CONTRACT` or the Stripe price, never from code.
 */

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatAmount } from "@/lib/contract-billing";
import { toBillingCurrency } from "@/lib/currency";
import { useCurrencyChoice } from "@/hooks/useCurrency";
import { CurrencySwitch } from "@/components/pricing/CurrencySwitch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function BillingPage() {
  const t = useTranslations("contractBilling");
  const tLegacy = useTranslations("billing");
  const utils = trpc.useUtils();
  const [busy, setBusy] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ entitlementId: string; name: string } | null>(null);

  const { data: pricing, isLoading } = trpc.billing.getContractPricing.useQuery();
  const choice = useCurrencyChoice();
  const { data: status } = trpc.billing.getSubscriptionStatus.useQuery();
  const { data: payments } = trpc.billing.listPayments.useQuery();
  const locale = useLocale();

  const cancelMutation = trpc.billing.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success(tLegacy("cancelSuccess"));
      setCancelTarget(null);
      void utils.billing.getSubscriptionStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const openPortal = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      toast.error(data.error || t("failed"));
    } catch {
      toast.error(t("failed"));
    }
    setBusy(false);
  };

  if (isLoading || !pricing) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currency = choice ? toBillingCurrency(choice) : pricing.defaultCurrency;
  const contractPrice = pricing.display?.contract[currency] ?? null;
  const legacy = (status?.entitlements ?? []).filter((e) => e.status === "ACTIVE");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("billingTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("billingSubtitle")}</p>
      </div>

      <section className="card-brutal space-y-3">
        <h2 className="text-lg font-semibold">{t("perContractTitle")}</h2>
        <p className="text-sm text-foreground">
          {contractPrice ? t("perContractBody", { price: contractPrice }) : t("perContractBodyNoPrice")}
        </p>
        {contractPrice && <CurrencySwitch current={currency === "eur" ? "EUR" : "USD"} className="block" />}
        <Link href="/pricing" className="text-sm text-primary underline underline-offset-2 block">
          {t("pricingLink")}
        </Link>
        {pricing.hasBillingAccount && (
          <button
            type="button"
            onClick={openPortal}
            disabled={busy}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground inline-flex items-center gap-2 disabled:opacity-60"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("receipts")}
          </button>
        )}
      </section>

      {payments && (
        <section className="card-brutal space-y-3">
          <h2 className="text-lg font-semibold">{t("paymentsTitle")}</h2>
          {payments.contracts.length === 0 && payments.packs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("paymentsEmpty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {[
                ...payments.contracts.map((c) => ({
                  id: c.id,
                  paidAt: c.paidAt,
                  label: t("paymentContract", { name: c.dealName }),
                  amount: c.amount != null && c.currency ? formatAmount(c.amount, c.currency, locale) : null,
                  refunded: c.refunded,
                  invoice: c.invoice,
                })),
                ...payments.packs.map((p) => ({
                  id: p.id,
                  paidAt: p.paidAt,
                  label: t("paymentPack", { credits: p.credits }),
                  amount: null,
                  refunded: false,
                  invoice: p.invoice,
                })),
              ]
                .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
                .map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {row.label}
                      <span className="text-muted-foreground">
                        {" · "}
                        {new Date(row.paidAt).toLocaleDateString(locale === "es" ? "es-ES" : "en-US")}
                        {row.amount && ` · ${row.amount}`}
                        {row.refunded && ` · ${t("paymentRefunded")}`}
                      </span>
                    </span>
                    {row.invoice?.hostedInvoiceUrl || row.invoice?.invoicePdf ? (
                      <span className="flex gap-3">
                        {row.invoice.hostedInvoiceUrl && (
                          <a
                            href={row.invoice.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2"
                          >
                            {t("invoiceView")}
                            {row.invoice.number && ` ${row.invoice.number}`}
                          </a>
                        )}
                        {row.invoice.invoicePdf && (
                          <a
                            href={row.invoice.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2"
                          >
                            {t("invoicePdf")}
                          </a>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{t("invoiceNone")}</span>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      {legacy.length > 0 && (
        <section className="card-brutal space-y-3">
          <h2 className="text-lg font-semibold">{t("legacyTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("legacyBody")}</p>
          <ul className="divide-y divide-border">
            {legacy.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span>{e.name}</span>
                {e.stripeSubscriptionId && (
                  <button
                    type="button"
                    onClick={() => setCancelTarget({ entitlementId: e.id, name: e.name })}
                    className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    {tLegacy("cancel")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tLegacy("cancelTitle", { name: cancelTarget?.name ?? "" })}</DialogTitle>
            <DialogDescription>{tLegacy("cancelDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" onClick={() => setCancelTarget(null)} className="btn-brutal-outline">
              {tLegacy("keepSubscription")}
            </button>
            <button
              type="button"
              disabled={cancelMutation.isPending}
              onClick={() =>
                cancelTarget && cancelMutation.mutate({ entitlementId: cancelTarget.entitlementId })
              }
              className="btn-brutal inline-flex items-center gap-2"
            >
              {cancelMutation.isPending ? tLegacy("cancelling") : tLegacy("cancelConfirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
