"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Platform-admin AI page: the install-level posture switch (AiPostureCard)
 * plus the metadata-only generation audit. While the posture is Off (the
 * default), Dealroom makes zero AI calls.
 */

import { trpc } from "@/lib/trpc";
import { AiPostureCard } from "@/components/ai/AiPostureCard";
import { features } from "@/config/features";
import { Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AdminAiPage() {
  const { data: generations, isLoading } = trpc.ai.listGenerations.useQuery(
    { limit: 50 },
    { enabled: features.aiAssist }
  );

  if (!features.aiAssist) {
    return (
      <div className="card-brutal">
        <p className="text-muted-foreground text-sm">
          AI assists are disabled on this deployment (NEXT_PUBLIC_AI_ASSIST_ENABLED=false).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            AI Assistance
          </h1>
          <p className="text-muted-foreground mt-1">
            Install-level posture for the optional embedded-AI assists. Off by
            default — while it is off, this product makes no AI calls at all.
          </p>
        </div>
      </div>

      <AiPostureCard />

      {/* Generation audit (metadata only — no prompt/output text is stored) */}
      <div className="card-brutal">
        <h2 className="font-semibold mb-1">Generation audit</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Who generated what, when, with which model. Prompt and output text
          are never stored. This log also drives the hourly rate limit.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !generations || generations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No AI generations yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Feature</th>
                  <th className="py-2 pr-4">Deal</th>
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Model</th>
                  <th className="py-2 pr-4">Tokens</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {generations.map((g) => (
                  <tr key={g.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Date(g.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">{g.feature}</td>
                    <td className="py-2 pr-4">{g.dealRoom?.name || "—"}</td>
                    <td className="py-2 pr-4">{g.user?.email || "—"}</td>
                    <td className="py-2 pr-4">{g.model || "—"}</td>
                    <td className="py-2 pr-4">{g.totalTokens ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {g.durationMs != null ? `${g.durationMs} ms` : "—"}
                    </td>
                    <td className="py-2">
                      <Badge
                        className={
                          g.status === "ok"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }
                      >
                        {g.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
