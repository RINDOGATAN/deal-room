// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API: which template fits a matter.
 *
 * GET /api/v1/agent/find-template?q=<description>[&lang=es]
 *
 * Public (no key) and free. The words of the description are matched
 * with the contract search every other surface uses; no AI model reads
 * them. Returns the matching contract codes with their titles and guide
 * links, or "No template covers this. Such matters are usually handled by
 * a lawyer." Time-sensitive matters (a lawsuit or claim received, a
 * subpoena, a data breach, a letter from a regulator) are flagged as
 * outside the templates. See `src/lib/find-template.ts`. Behind
 * `features.startupCoverage`.
 */

import { NextRequest, NextResponse } from "next/server";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";
import { findTemplateAnswer } from "@/server/services/agent/coverage";

const MAX_QUERY_LENGTH = 500;

export async function GET(req: NextRequest) {
  try {
    if (!features.agentApi || !features.startupCoverage) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const lang = req.nextUrl.searchParams.get("lang") === "es" ? "es" : "en";
    if (!q) {
      return NextResponse.json({ error: "Send the description of the matter in q" }, { status: 400 });
    }
    if (q.length > MAX_QUERY_LENGTH) {
      return NextResponse.json({ error: `The description is longer than ${MAX_QUERY_LENGTH} characters` }, { status: 400 });
    }
    return NextResponse.json(findTemplateAnswer(q, lang), {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    return apiError(error, "Could not search the templates");
  }
}
