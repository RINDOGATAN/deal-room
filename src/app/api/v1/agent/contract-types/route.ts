// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API: what can be asked for.
 *
 * GET /api/v1/agent/contract-types[?lang=es][&contractType=DPA][&summary=1]
 *
 * Public (no key), so an agent can learn what to ask its user before it
 * holds a key. Every contract type the one-call generation accepts, with
 * its guide slug, governing laws, languages, roles and inputs. The full
 * clause and option list stays behind a key at /templates/:contractType.
 *
 * `contractType` (a code or a guide slug) returns that one type with its
 * inputs; `summary=1` leaves the inputs out (each type then carries
 * `inputCount`). Without either, the full list, as before.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";
import { listContractTypes, selectContractTypes } from "@/server/services/agent/contractTypes";
import { REQUIRED_INPUTS_RULE } from "@/lib/agent-inputs";

export async function GET(req: NextRequest) {
  try {
    if (!features.agentApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }
    const sp = req.nextUrl.searchParams;
    const lang = sp.get("lang") === "es" ? "es" : "en";
    const summary = ["1", "true"].includes((sp.get("summary") ?? "").toLowerCase());
    const selected = selectContractTypes(await listContractTypes(prisma, { lang }), {
      contractType: sp.get("contractType"),
      summary,
    });
    if ("unknown" in selected) {
      return NextResponse.json(
        {
          error: `Unknown contract type: ${selected.unknown}`,
          code: "NOT_FOUND",
          hint: "Call without contractType (or with summary=1) to see every code and guide slug.",
        },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        contractTypes: selected.contractTypes,
        generate: {
          method: "POST",
          url: "/api/v1/agent/contracts",
          note: `Send contractType (the code or the guide slug), party and, where more than one is offered, governingLaw. ${REQUIRED_INPUTS_RULE.en} mustSend marks the required inputs without a default.`,
        },
      },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=600" } },
    );
  } catch (error) {
    return apiError(error, "Could not list the contract types");
  }
}
