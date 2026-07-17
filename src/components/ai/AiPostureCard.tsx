"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * AiPostureCard — the install-level AI switch (platform-admin area).
 *
 * Ported from dpocentral-todo/src/components/ai/AiPostureCard.tsx and
 * adapted for Dealroom: the posture is a singleton (no organizationId), it
 * is mounted ONLY behind the platform-admin session (so there is no isAdmin
 * prop), and the acknowledgment uses a native checkbox (this repo's UI kit
 * has no Checkbox component).
 *
 * Posture defaults to off: no AI calls ever happen until a platform admin
 * picks a posture AND ticks the acknowledgment sentence. The acknowledgment
 * is recorded as acknowledgedByAdminId/At.
 */

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { features } from "@/config/features";

type Posture = "off" | "local_gateway" | "cloud_eu" | "cloud_us";

// Product decision (2026-07-17): the picker offers a SIMPLE choice — Off,
// Cloud LLM, or Local gateway (the latter only meaningful on self-host).
// "Cloud LLM" is stored as `cloud_us` (the enum keeps all four values —
// append-only DB discipline and canonical-door parity — and with a single
// base engine every lane routes identically, so the recorded posture and
// the physical traffic stay the same fact). `cloud_eu` remains valid for
// any install that already saved it and is shown only in that legacy case.
const OFFERED_POSTURES: readonly Posture[] = ["off", "cloud_us", "local_gateway"];

export function AiPostureCard() {
  const t = useTranslations("ai");
  const utils = trpc.useUtils();

  const { data: status } = trpc.ai.getStatus.useQuery(undefined, {
    enabled: features.aiAssist,
  });

  const [posture, setPosture] = useState<Posture>("off");
  const [dirty, setDirty] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (status && !dirty) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates the posture selector from the fetched status; the selector is user-editable afterwards (dirty guard) so it cannot be derived during render
      setPosture(status.posture as Posture);
    }
  }, [status, dirty]);

  const setPostureMutation = trpc.ai.setPosture.useMutation({
    onSuccess: () => {
      toast.success(t("postureCard.saved"));
      utils.ai.getStatus.invalidate();
      setDirty(false);
      setAcknowledged(false);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!features.aiAssist || !status) return null;

  // Lane-aware: warn about the lane the admin is ABOUT to save (the selector
  // value), not the one already saved — each posture may have its own engine.
  const selectedLaneStatus = posture === "off" ? null : status.lanes[posture];
  const showNotConfiguredWarning = posture !== "off" && !selectedLaneStatus?.configured;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> {t("postureCard.title")}
        </CardTitle>
        <CardDescription>{t("postureCard.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t("postureCard.postureLabel")}</Label>
          <Select
            value={posture}
            onValueChange={(v) => {
              setPosture(v as Posture);
              setDirty(true);
            }}
            disabled={setPostureMutation.isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(OFFERED_POSTURES.includes(posture)
                ? OFFERED_POSTURES
                : [...OFFERED_POSTURES, posture]
              ).map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`posture.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {status.configured
              ? t("postureCard.engineConfigured", { provider: status.providerName ?? "—" })
              : t("postureCard.engineNotConfigured")}
          </p>
          {/* Engine availability for the two offered lanes (suffixed env
              triples fall back to the base one) */}
          <div className="flex flex-wrap gap-1.5">
            {(["cloud_us", "local_gateway"] as const).map((lane) => {
              const laneStatus = status.lanes[lane];
              return (
                <span
                  key={lane}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                    laneStatus.configured
                      ? "border-primary/40 text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {t(`postureCard.laneNames.${lane}`)}
                  {": "}
                  {laneStatus.configured
                    ? laneStatus.providerName ?? "—"
                    : t("postureCard.laneNoEngine")}
                </span>
              );
            })}
          </div>
        </div>

        {showNotConfiguredWarning && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/10 text-sm">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
            <span>{t("postureCard.notConfiguredWarning")}</span>
          </div>
        )}

        {status.acknowledgedAt && status.acknowledgedBy && (
          <p className="text-xs text-muted-foreground">
            {t("postureCard.acknowledgedBy", {
              name: status.acknowledgedBy.name || status.acknowledgedBy.email || "—",
              date: new Date(status.acknowledgedAt).toLocaleDateString(),
            })}
          </p>
        )}

        {dirty && (
          <>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="ai-posture-ack"
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              <Label
                htmlFor="ai-posture-ack"
                className="text-xs font-normal leading-relaxed cursor-pointer"
              >
                {t("postureCard.acknowledgment")}
              </Label>
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!acknowledged || setPostureMutation.isPending}
                onClick={() =>
                  setPostureMutation.mutate({
                    posture,
                    acknowledged: true,
                  })
                }
              >
                {setPostureMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {t("postureCard.save")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
