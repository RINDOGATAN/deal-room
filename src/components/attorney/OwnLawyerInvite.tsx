// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

"use client";

/**
 * "Invite your own lawyer" inside the attorney review dialog (owner's
 * decision E1, step 1, 6 October 2026): an e-mail field, an optional
 * name, and the one plain sentence that the lawyer works for the client
 * and Dealroom takes no fee. Shown only while `features.startupCoverage`
 * is on (the caller checks).
 */

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function OwnLawyerInvite({ dealRoomId, onInvited }: { dealRoomId: string; onInvited: () => void }) {
  const t = useTranslations("review.ownLawyer");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const invite = trpc.attorneyReview.inviteOwnLawyer.useMutation({
    onSuccess: () => {
      toast.success(t("sent"));
      setEmail("");
      setName("");
      onInvited();
    },
    onError: (error) => toast.error(t("failed", { error: error.message })),
  });

  return (
    <form
      className="border-t border-border pt-5 mt-6 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return;
        invite.mutate({
          dealRoomId,
          email: email.trim(),
          name: name.trim() || undefined,
          lang: locale === "es" ? "es" : "en",
        });
      }}
    >
      <h3 className="font-semibold">{t("title")}</h3>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <label className="block text-sm">
        <span className="block mb-1">{t("emailLabel")}</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 bg-background border border-border rounded-md"
        />
      </label>
      <label className="block text-sm">
        <span className="block mb-1">{t("nameLabel")}</span>
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-background border border-border rounded-md"
        />
      </label>
      <p className="text-xs text-muted-foreground">{t("note")}</p>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!email.trim() || invite.isPending}
          className="btn-brutal-outline inline-flex items-center gap-2 text-sm disabled:opacity-50"
        >
          <Mail className="w-4 h-4" />
          {invite.isPending ? t("sending") : t("send")}
        </button>
      </div>
    </form>
  );
}
