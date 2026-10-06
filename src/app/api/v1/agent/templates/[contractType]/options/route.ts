// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API: the options of one clause, explained from both sides.
 *
 * GET /api/v1/agent/templates/:contractType/options?clause=<clause id or title>[&lang=es]
 *
 * Free (no credit). Each option's description and its pros and cons for
 * each party, and the clause's trade-off text, exactly as the template
 * holds them; when the template has no such text, the answer says so.
 * Nothing is ranked or recommended. Same key, scope and entitlement as
 * GET /templates/:contractType. Behind `features.startupCoverage`.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateApiKey, requireScope, ApiScopeError } from "@/server/middleware/apiKeyAuth";
import { unauthorizedResponse } from "@/server/middleware/unauthorized";
import { checkEntitlement } from "@/server/services/licensing/entitlement";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";
import { explainOptions } from "@/server/services/agent/coverage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ contractType: string }> }) {
  try {
    if (!features.agentApi || !features.startupCoverage) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }
    const auth = await authenticateApiKey(req);
    if (!auth) return unauthorizedResponse();
    try {
      requireScope(auth, "templates:read");
    } catch (e) {
      if (e instanceof ApiScopeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    const { contractType } = await params;
    const clause = (req.nextUrl.searchParams.get("clause") ?? "").trim();
    const lang = req.nextUrl.searchParams.get("lang") === "es" ? "es" : "en";
    if (!clause) {
      return NextResponse.json({ error: "Send the clause id (from get_template) in clause" }, { status: 400 });
    }

    const result = await explainOptions(prisma, { contractType, clause, lang });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, ...(result.clauses ? { clauses: result.clauses } : {}) },
        { status: result.status },
      );
    }
    if (result.premiumSkillId) {
      const entitled = await checkEntitlement(auth.customer.id, result.premiumSkillId);
      if (!entitled.entitled) {
        return NextResponse.json({ error: "Not entitled to this template" }, { status: 403 });
      }
    }
    return NextResponse.json(result.body);
  } catch (error) {
    return apiError(error, "Could not explain the options");
  }
}
