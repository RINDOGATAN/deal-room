"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Circle, XCircle, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EnableFeatureModal } from "@/components/premium/enable-feature-modal";
import { EnableMultipleFeaturesModal } from "@/components/premium/enable-multiple-features-modal";
import { formatPrice } from "@/lib/currency";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function BillingPage() {
  const t = useTranslations("billing");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [enableSkill, setEnableSkill] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [enableSkills, setEnableSkills] = useState<
    { id: string; name: string }[] | null
  >(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cancelTarget, setCancelTarget] = useState<{
    entitlementId: string;
    name: string;
  } | null>(null);

  const utils = trpc.useUtils();

  const { data: status, isLoading: statusLoading } =
    trpc.billing.getSubscriptionStatus.useQuery();

  const { data: plans, isLoading: plansLoading } =
    trpc.billing.getAvailablePlans.useQuery();

  const cancelMutation = trpc.billing.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success(t("cancelSuccess"));
      setCancelTarget(null);
      utils.billing.getSubscriptionStatus.invalidate();
      utils.billing.getAvailablePlans.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Show toast on checkout redirect and auto-redirect back if returnUrl present
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      const returnUrl = searchParams.get("returnUrl");
      if (returnUrl) {
        toast.success(t("checkoutSuccess"));
        const timer = setTimeout(() => router.push(returnUrl), 1500);
        return () => clearTimeout(timer);
      }
      toast.success(t("checkoutSuccess"));
    } else if (searchParams.get("cancelled") === "true") {
      toast(t("checkoutCancelled"));
    }
  }, [searchParams, t, router]);

  if (statusLoading || plansLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const entitlements = status?.entitlements ?? [];
  const entitlementsBySkill = new Map(
    entitlements.map((e) => [e.skillId, e])
  );

  const addOnRows = (plans ?? []).map((pkg) => {
    const entitlement = entitlementsBySkill.get(pkg.skillId);
    const isActive = entitlement?.status === "ACTIVE" || pkg.isEntitled;
    return {
      id: pkg.id,
      skillId: pkg.skillId,
      name: pkg.name,
      description: pkg.description,
      isActive,
      entitlementId: entitlement?.id ?? null,
      hasStripeSubscription: !!entitlement?.stripeSubscriptionId,
      renewsAt: entitlement?.expiresAt
        ? new Date(entitlement.expiresAt).toLocaleDateString()
        : null,
      downloadUrl: `/api/skills/${pkg.skillId}/download`,
    };
  });

  const inactiveRows = addOnRows.filter((r) => !r.isActive);
  const activeCount = addOnRows.filter((r) => r.isActive).length;
  const monthlyTotal = activeCount * 9;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleEnableSelected = () => {
    const selected = inactiveRows
      .filter((r) => selectedIds.has(r.id))
      .map((r) => ({ id: r.id, name: r.name }));
    if (selected.length === 1) {
      setEnableSkill(selected[0]);
    } else if (selected.length > 1) {
      setEnableSkills(selected);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Add-on Features */}
      <div className="card-brutal p-6">
        <h2 className="text-lg font-semibold mb-4">{t("addOnFeatures")}</h2>
        <div className="divide-y divide-border">
          {addOnRows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                {/* Checkbox for inactive items */}
                {!row.isActive ? (
                  <button
                    onClick={() => toggleSelect(row.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {selectedIds.has(row.id) ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                <div>
                  <span className="font-medium">{row.name}</span>
                  {row.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {row.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {row.isActive ? (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-600 rounded-full">
                        {t("active")}
                      </span>
                      {row.renewsAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("renews")} {row.renewsAt}
                        </p>
                      )}
                    </div>
                    {row.isActive && (
                      <a
                        href={row.downloadUrl}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t("download")}
                      </a>
                    )}
                    {row.entitlementId && row.hasStripeSubscription && (
                      <button
                        onClick={() =>
                          setCancelTarget({
                            entitlementId: row.entitlementId!,
                            name: row.name,
                          })
                        }
                        className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {t("cancel")}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {t("pricePerMonth", { price: formatPrice(9) })}
                    </span>
                    <button
                      onClick={() =>
                        setEnableSkill({ id: row.id, name: row.name })
                      }
                      className="btn-brutal text-xs px-3 py-1.5"
                    >
                      {t("enable")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Selection summary */}
        {selectedIds.size > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border p-3">
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} {t("featuresSelected")} — {formatPrice(selectedIds.size * 9)}/{t("month")}
            </p>
            <button
              className="btn-brutal text-xs px-3 py-1.5"
              onClick={handleEnableSelected}
            >
              {t("enableSelected")} ({selectedIds.size})
            </button>
          </div>
        )}
      </div>

      {/* Monthly total */}
      {activeCount > 0 && (
        <div className="text-sm text-muted-foreground">
          <p>
            {t("monthlyTotal")}:{" "}
            <span className="font-semibold text-foreground">{formatPrice(monthlyTotal)}</span>
          </p>
          <p>
            {t("monthlyTotalDescription", { count: activeCount, price: formatPrice(9) })}
          </p>
        </div>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("cancelTitle", { name: cancelTarget?.name ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("cancelDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setCancelTarget(null)}
              className="btn-brutal text-xs px-4 py-2"
            >
              {t("keepSubscription")}
            </button>
            <button
              onClick={() => {
                if (cancelTarget) {
                  cancelMutation.mutate({
                    entitlementId: cancelTarget.entitlementId,
                  });
                }
              }}
              disabled={cancelMutation.isPending}
              className="text-xs px-4 py-2 rounded-full bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
            >
              {cancelMutation.isPending
                ? t("cancelling")
                : t("cancelConfirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enable single feature modal */}
      {enableSkill && (
        <EnableFeatureModal
          open={!!enableSkill}
          onClose={() => setEnableSkill(null)}
          skillPackageId={enableSkill.id}
          skillName={enableSkill.name}
        />
      )}

      {/* Enable multiple features modal */}
      {enableSkills && (
        <EnableMultipleFeaturesModal
          open={!!enableSkills}
          onClose={() => {
            setEnableSkills(null);
            setSelectedIds(new Set());
          }}
          skills={enableSkills}
        />
      )}
    </div>
  );
}
