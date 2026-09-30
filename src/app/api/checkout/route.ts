// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * POST /api/checkout — retired (HTTP 410).
 *
 * This route sold skills one by one, and in round 1 of pay per contract it
 * was going to sell a monthly plan. Both are gone (owner decision
 * 2026-09-29): every template is included and each contract is paid on its
 * deal page (`POST /api/deals/:id/checkout`). The answer is the same in
 * every posture, because the thing it sold no longer exists anywhere.
 * Existing per-skill subscribers are untouched: the webhook keeps serving
 * them, and they cancel from /billing.
 */

import { NextResponse } from "next/server";
import { CHECKOUT_GONE_MESSAGE } from "@/lib/contract-billing";

export async function POST() {
  return NextResponse.json({ error: CHECKOUT_GONE_MESSAGE, code: "GONE" }, { status: 410 });
}
