// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API: what can be asked for.
 *
 * GET /api/v1/agent/contract-types[?lang=es]
 *
 * Public (no key), so an agent can learn what to ask its user before it
 * holds a key. Every contract type the one-call generation accepts, with
 * its guide slug, governing laws, languages, roles and inputs. The full
 * clause and option list stays behind a key at /templates/:contractType.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";
import { listContractTypes } from "@/server/services/agent/contractTypes";

export async function GET(req: NextRequest) {
  try {
    if (!features.agentApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }
    const lang = req.nextUrl.searchParams.get("lang") === "es" ? "es" : "en";
    const contractTypes = await listContractTypes(prisma, { lang });
    return NextResponse.json(
      {
        contractTypes,
        generate: {
          method: "POST",
          url: "/api/v1/agent/contracts",
          note: "Send contractType (the code or the guide slug), party and, where more than one is offered, governingLaw. Inputs marked required go in terms.",
        },
      },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=600" } },
    );
  } catch (error) {
    return apiError(error, "Could not list the contract types");
  }
}
