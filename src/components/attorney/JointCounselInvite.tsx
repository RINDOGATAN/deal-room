// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

"use client";

/**
 * Joint closing counsel by invitation (owner's decision, 6 October 2026):
 * the initiator names a lawyer by e-mail, with an optional name and the
 * one plain sentence that the lawyer works for both parties and Dealroom
 * takes no fee. The other party then acknowledges or declines. There is
 * no list of lawyers to choose from.
 */

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function JointCounselInvite({
  dealRoomId,
  onRequested,
  onCancel,
  cancelLabel,
}: {
  dealRoomId: string;
  onRequested: () => void;
  onCancel: () => void;
  cancelLabel: string;
}) {
  const t = useTranslations("jointCounsel");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const request = trpc.jointCounsel.request.useMutation({
    onSuccess: () => {
      toast.success(t("toastMessages.requested"));
      setEmail("");
      setName("");
      onRequested();
    },
    onError: (error) => toast.error(t("toastMessages.requestFailed", { error: error.message })),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return;
        request.mutate({
          dealRoomId,
          email: email.trim(),
          name: name.trim() || undefined,
          lang: locale === "es" ? "es" : "en",
        });
      }}
    >
      <p className="text-sm text-muted-foreground">{t("selectCounselDescription")}</p>
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
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-muted-foreground hover:text-foreground"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          disabled={!email.trim() || request.isPending}
          className="btn-brutal inline-flex items-center gap-2 text-sm disabled:opacity-50"
        >
          <Mail className="w-4 h-4" />
          {request.isPending ? t("requesting") : t("assignCounsel")}
        </button>
      </div>
    </form>
  );
}
