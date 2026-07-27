// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One-shot admin route — consolidates the legacy "Privacy" category into
 * "Privacy & Data Protection" on the HOSTED (Vercel/Neon) Deal Room database.
 *
 * WHY THIS EXISTS
 * ----------------
 * The source-of-truth fix lives in the skill metadata (skills/dpa and
 * skills/privacy-notice now carry category "Privacy & Data Protection"), but
 * ContractTemplate rows already seeded onto the hosted DB still read the old
 * "Privacy" label. A fresh seed would correct them, but the hosted DB is only
 * reachable over Postgres 5432 from inside the deployed function — operator
 * networks block outbound 5432 — so we let the deployed function retag in
 * place. Same rationale, and same auth model, as the retired seed-baa route.
 *
 * WHAT IT DOES
 * ------------
 * A single idempotent updateMany:
 *   ContractTemplate WHERE category = "Privacy"
 *     -> category          = "Privacy & Data Protection"
 *     -> categoryLocalized = {"en":"Privacy & Data Protection",
 *                             "es":"Privacidad y Protección de Datos"}
 * It NEVER deletes anything. Re-running matches zero rows once complete, so
 * calling it more than once is safe.
 *
 * AUTH
 * ----
 * POST only. Caller must present SEED_BAA_TOKEN as a Bearer token — the SAME
 * env var the seed-baa route used, so the operator sets a single variable.
 *   - SEED_BAA_TOKEN unset            -> 403 (never runs unguarded)
 *   - Authorization missing/mismatch  -> 401
 * The route is inert until called with the correct token and is meant to be
 * removed (and the token unset) after a successful one-shot — see
 * RETAG-PRIVACY-VERCEL.md.
 */

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// This route mutates the database at request time.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FROM_CATEGORY = "Privacy";
const TO_CATEGORY = "Privacy & Data Protection";
const TO_CATEGORY_LOCALIZED = {
  en: "Privacy & Data Protection",
  es: "Privacidad y Protección de Datos",
} as const;

export async function POST(req: NextRequest) {
  const SEED_BAA_TOKEN = process.env.SEED_BAA_TOKEN;

  // 403 when the guard secret is not configured, so the route can never run
  // unguarded even if it is accidentally deployed without the env var.
  if (!SEED_BAA_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "SEED_BAA_TOKEN is not configured on the server." },
      { status: 403 },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.replace(/^Bearer\s+/i, "");
  if (!provided || provided !== SEED_BAA_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    // Count first so the response can report how many rows carried the legacy
    // label, independent of the update result (idempotent: 0 after first run).
    const matched = await prisma.contractTemplate.count({
      where: { category: FROM_CATEGORY },
    });

    const result = await prisma.contractTemplate.updateMany({
      where: { category: FROM_CATEGORY },
      data: {
        category: TO_CATEGORY,
        categoryLocalized:
          TO_CATEGORY_LOCALIZED as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      ok: true,
      matched,
      updated: result.count,
      from: FROM_CATEGORY,
      to: TO_CATEGORY,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `Retag failed: ${message}` },
      { status: 500 },
    );
  }
}
