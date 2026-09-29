"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Billing (Stripe on only; the layout 404s otherwise).
 *
 * Pay per contract (2026-09-29): each contract is paid on its deal page,
 * when it is downloaded or signed. This page explains the price, sells and
 * manages the monthly plan (unlimited contracts), and lists any earlier
 * per-skill subscriptions so their holders can cancel them. Amounts come
 * from the Stripe prices, never from code.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatAmount } from "@/lib/contract-billing";
import { formatDate } from "@/lib/date";
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
  const locale = useLocale();
  const utils = trpc.useUtils();
  const [busy, setBusy] = useState<"plan" | "portal" | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ entitlementId: string; name: string } | null>(null);
  const returned = useRef(false);

  const { data: pricing, isLoading } = trpc.billing.getContractPricing.useQuery();
  const { data: status } = trpc.billing.getSubscriptionStatus.useQuery();

  const cancelMutation = trpc.billing.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success(tLegacy("cancelSuccess"));
      setCancelTarget(null);
      void utils.billing.getSubscriptionStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Back from the plan checkout: record the plan at once (the webhook
  // records it too), then clean the address bar.
  useEffect(() => {
    if (returned.current) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("plan") !== "active") return;
    returned.current = true;
    const done = () => {
      window.history.replaceState(null, "", "/billing");
      void utils.billing.getContractPricing.invalidate();
    };
    if (!sessionId) {
      done();
      return;
    }
    fetch("/api/checkout/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => (res.ok ? toast.success(t("planActive")) : toast.info(t("notConfirmed"))))
      .catch(() => toast.info(t("notConfirmed")))
      .finally(done);
  }, [t, utils]);

  const post = async (url: string, body: unknown, which: "plan" | "portal") => {
    setBusy(which);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    setBusy(null);
  };

  if (isLoading || !pricing) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currency = pricing.defaultCurrency;
  const amount = (product: "contract" | "monthly") => {
    const minor = pricing.prices?.[product]?.[currency];
    return typeof minor === "number" ? formatAmount(minor, currency, locale) : null;
  };
  const contractPrice = amount("contract");
  const planPrice = amount("monthly");
  const legacy = (status?.entitlements ?? []).filter((e) => e.status === "ACTIVE");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("billingTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("billingSubtitle")}</p>
      </div>

      <section className="card-brutal space-y-2">
        <h2 className="text-lg font-semibold">{t("perContractTitle")}</h2>
        <p className="text-sm text-foreground">
          {contractPrice ? t("perContractBody", { price: contractPrice }) : t("perContractBodyNoPrice")}
        </p>
      </section>

      <section className="card-brutal space-y-3" data-testid="monthly-plan">
        <h2 className="text-lg font-semibold">{t("planTitle")}</h2>
        <p className="text-sm text-foreground">
          {planPrice ? t("planBody", { price: planPrice }) : t("planBodyNoPrice")}
        </p>
        {pricing.plan?.active ? (
          <div className="space-y-2">
            <p className="text-sm text-success">
              {pricing.plan.currentPeriodEnd
                ? t("planRenews", { date: formatDate(new Date(pricing.plan.currentPeriodEnd), { locale }) })
                : t("planActive")}
            </p>
            <button
              type="button"
              onClick={() => post("/api/billing/portal", {}, "portal")}
              disabled={busy !== null}
              className="btn-brutal inline-flex items-center gap-2 disabled:opacity-60"
            >
              {busy === "portal" && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("planManage")}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => post("/api/checkout", { plan: "unlimited", currency }, "plan")}
              disabled={busy !== null}
              className="btn-brutal inline-flex items-center gap-2 disabled:opacity-60"
            >
              {busy === "plan" && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("planSubscribe")}
            </button>
            {pricing.hasBillingAccount && (
              <button
                type="button"
                onClick={() => post("/api/billing/portal", {}, "portal")}
                disabled={busy !== null}
                className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {t("planManage")}
              </button>
            )}
          </div>
        )}
      </section>

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
