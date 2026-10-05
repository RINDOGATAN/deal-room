"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Settings, API keys: the signed-in person creates, lists and revokes
 * their own agent API keys, and sees and tops up their credit balance.
 * The full key is shown once, right after it is created, and is never
 * kept in the browser beyond this screen. Server side: `apiKeys` router,
 * POST /api/billing/credits.
 */

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { CREDITS_PER_PACK } from "@/lib/contract-billing";
import { StatusNote } from "@/components/ui/status-note";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CreatedKey = { name: string; key: string };

/** `creditsAdded`: back from a credit-pack checkout (`?credits=added`). */
export function ApiKeysView({ creditsAdded }: { creditsAdded: boolean }) {
  const t = useTranslations("apiKeys");
  const locale = useLocale();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const [buying, setBuying] = useState(false);

  const { data, isLoading } = trpc.apiKeys.overview.useQuery();

  const createMutation = trpc.apiKeys.create.useMutation({
    onSuccess: (res) => {
      setCreated({ name: res.name, key: res.key });
      setCopied(false);
      setName("");
      void utils.apiKeys.overview.invalidate();
    },
    onError: (err) => {
      if (err.data?.code === "TOO_MANY_REQUESTS") toast.error(t("errorRateLimit"));
      else if (err.data?.code === "PRECONDITION_FAILED")
        toast.error(t("limitReached", { max: data?.maxActive ?? 5 }));
      else toast.error(t("errorGeneric"));
    },
  });

  const revokeMutation = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      toast.success(t("revokedToast"));
      setRevokeTarget(null);
      void utils.apiKeys.overview.invalidate();
    },
    onError: () => toast.error(t("errorGeneric")),
  });

  const copyKey = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const buyCredits = async () => {
    setBuying(true);
    try {
      const res = await fetch("/api/billing/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string };
      if (res.ok && body.url) {
        window.location.href = body.url;
        return;
      }
      toast.error(t("checkoutFailed"));
    } catch {
      toast.error(t("checkoutFailed"));
    }
    setBuying(false);
  };

  const formatDate = (value: Date | string | null) =>
    value
      ? new Date(value).toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : t("never");

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const atLimit = data.activeCount >= data.maxActive;

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="api-keys-page">
      <div>
        <p className="text-sm text-muted-foreground">{t("breadcrumb")}</p>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("intro")}</p>
        <p className="text-sm text-muted-foreground mt-1">{t("scopesNote")}</p>
        <Link href="/docs/agent-api" className="text-sm text-primary underline underline-offset-2">
          {t("docsLink")}
        </Link>
      </div>

      {creditsAdded && (
        <StatusNote tone="success" compact>
          {t("creditsAdded")}
        </StatusNote>
      )}

      {/* The new key: shown here once, gone when the person dismisses it. */}
      {created && (
        <section className="card-brutal space-y-3" data-testid="api-key-created">
          <h2 className="text-lg font-semibold">{t("newKeyTitle")}</h2>
          <StatusNote tone="warning" compact>
            {t("newKeyWarning")}
          </StatusNote>
          <p className="text-sm font-medium">{created.name}</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <code
              className="flex-1 min-w-0 break-all p-3 border border-border bg-card font-mono text-sm rounded-xl select-all"
              data-testid="api-key-value"
            >
              {created.key}
            </code>
            <button
              type="button"
              onClick={copyKey}
              className="btn-brutal text-sm px-4 py-2 inline-flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {t("done")}
          </button>
        </section>
      )}

      <section className="card-brutal space-y-3">
        <h2 className="text-lg font-semibold">{t("createTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("activeCount", { count: data.activeCount, max: data.maxActive })}
        </p>
        {atLimit ? (
          <StatusNote tone="info" compact>
            {t("limitReached", { max: data.maxActive })}
          </StatusNote>
        ) : (
          <form
            className="flex flex-col sm:flex-row gap-2 sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createMutation.mutate({ name: name.trim() });
            }}
          >
            <label className="flex-1 space-y-1">
              <span className="text-sm font-medium">{t("nameLabel")}</span>
              <input
                type="text"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              className="btn-brutal text-sm px-4 py-2 inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              {t("createButton")}
            </button>
          </form>
        )}
      </section>

      <section className="card-brutal space-y-3">
        <h2 className="text-lg font-semibold">{t("listTitle")}</h2>
        {data.keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="api-keys-table">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-3 font-medium">{t("colName")}</th>
                  <th className="py-2 pr-3 font-medium">{t("colPrefix")}</th>
                  <th className="py-2 pr-3 font-medium">{t("colCreated")}</th>
                  <th className="py-2 pr-3 font-medium">{t("colLastUsed")}</th>
                  <th className="py-2 pr-3 font-medium">{t("colStatus")}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {data.keys.map((k) => {
                  const status = k.status;
                  return (
                    <tr key={k.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3">{k.name}</td>
                      <td className="py-2 pr-3">
                        <code className="font-mono text-xs">{k.keyPrefix}…</code>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(k.createdAt)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(k.lastUsedAt)}</td>
                      <td className="py-2 pr-3">
                        {status === "active"
                          ? t("statusActive")
                          : status === "expired"
                            ? t("statusExpired")
                            : t("statusRevoked")}
                      </td>
                      <td className="py-2 text-right">
                        {status === "active" && (
                          <button
                            type="button"
                            onClick={() => setRevokeTarget({ id: k.id, name: k.name })}
                            className="text-sm underline underline-offset-2 text-danger hover:opacity-80"
                          >
                            {t("revoke")}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card-brutal space-y-3">
        <h2 className="text-lg font-semibold">{t("creditsTitle")}</h2>
        <p className="text-2xl font-semibold" data-testid="api-keys-balance">
          {t("creditsBalance", { count: data.balance })}
        </p>
        <p className="text-sm text-muted-foreground">{t("creditsBody", { size: CREDITS_PER_PACK })}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={buyCredits}
            disabled={buying}
            className="btn-brutal text-sm px-4 py-2 inline-flex items-center gap-2 disabled:opacity-60"
          >
            {buying && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("buyCredits")}
          </button>
          <Link href="/pricing" className="text-sm text-primary underline underline-offset-2">
            {t("pricingLink")}
          </Link>
        </div>
      </section>

      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("revokeTitle")}</DialogTitle>
            <DialogDescription>{t("revokeBody", { name: revokeTarget?.name ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setRevokeTarget(null)}
              className="text-sm px-4 py-2 rounded-full border border-border hover:bg-secondary transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              disabled={revokeMutation.isPending}
              onClick={() => revokeTarget && revokeMutation.mutate({ apiKeyId: revokeTarget.id })}
              className="text-sm px-4 py-2 rounded-full bg-destructive text-destructive-foreground inline-flex items-center gap-2 disabled:opacity-60"
            >
              {revokeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("revokeConfirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
