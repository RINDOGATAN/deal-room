// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — subscriptions, retired (HTTP 410)
 *
 * POST /api/v1/agent/subscribe
 * This route sold per-skill subscriptions, and an earlier design of pay
 * per contract had it sell a monthly plan. Both are gone: every template is included and each contract is
 * paid with one prepaid credit of the customer when its document is first
 * fetched. Credits: POST /api/v1/agent/credits/checkout.
 *
 * The answer is the same in every posture (where the agent API itself is
 * on), because the thing it sold no longer exists anywhere. Existing
 * per-skill subscribers are untouched; the webhook keeps serving them.
 */

import { NextResponse } from "next/server";
import { features } from "@/config/features";
import { AGENT_SUBSCRIBE_GONE_MESSAGE } from "@/lib/contract-billing";

export async function POST() {
  if (!features.agentApi) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  return NextResponse.json(
    {
      error: AGENT_SUBSCRIBE_GONE_MESSAGE,
      code: "GONE",
      buyCredits: { method: "POST", url: "/api/v1/agent/credits/checkout" },
    },
    { status: 410 },
  );
}
