// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API: invite a lawyer of the user's choice to review the draft.
 *
 * POST /api/v1/agent/deals/:id/attorney  { "email": "...", "name": "..." }
 *
 * Free (no credit). Available to any lawyer the user invites, in any
 * jurisdiction. The lawyer receives an e-mail and reviews the draft in
 * the existing attorney review (supervisor portal); signing waits until
 * the lawyer approves or the review is cancelled in Dealroom. The lawyer
 * works for the user and bills the user directly; Dealroom takes no fee,
 * makes no recommendation and keeps no directory. See
 * `src/server/services/attorney/ownLawyer.ts`. Behind
 * `features.startupCoverage`.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { authenticateApiKey, requireScope, ApiScopeError } from "@/server/middleware/apiKeyAuth";
import { unauthorizedResponse } from "@/server/middleware/unauthorized";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";
import { OWN_LAWYER_NOTE, inviteOwnLawyer } from "@/server/services/attorney/ownLawyer";

const Body = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().max(120).optional(),
  lang: z.enum(["en", "es"]).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!features.agentApi || !features.startupCoverage) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }
    const auth = await authenticateApiKey(req);
    if (!auth) return unauthorizedResponse();
    try {
      requireScope(auth, "negotiate");
    } catch (e) {
      if (e instanceof ApiScopeError) return NextResponse.json({ error: e.message }, { status: 403 });
      throw e;
    }

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Send the lawyer's e-mail address in email", code: "INVALID_BODY" }, { status: 400 });
    }

    const { id } = await params;
    const agentDeal = await prisma.agentDealRoom.findUnique({
      where: { id },
      include: { dealRoom: { include: { parties: true } } },
    });
    const side =
      agentDeal?.initiatorCustomerId === auth.customer.id
        ? "INITIATOR"
        : agentDeal?.respondentCustomerId === auth.customer.id
          ? "RESPONDENT"
          : null;
    if (!agentDeal || !side) {
      return NextResponse.json({ error: "Deal not found", code: "NOT_FOUND" }, { status: 404 });
    }
    const party = agentDeal.dealRoom?.parties.find((p) => p.role === side);
    if (!party) {
      return NextResponse.json({ error: "This deal has no contract yet", code: "NOT_READY" }, { status: 409 });
    }

    const lang = parsed.data.lang ?? (agentDeal.contractLanguage === "es" ? "es" : "en");
    const result = await inviteOwnLawyer(prisma, {
      partyId: party.id,
      lawyerEmail: parsed.data.email,
      lawyerName: parsed.data.name,
      via: "agent",
      lang,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    }
    return NextResponse.json(
      {
        dealId: agentDeal.id,
        review: "REQUESTED",
        lawyerEmail: result.lawyerEmail,
        emailSent: result.emailSent,
        note: OWN_LAWYER_NOTE[lang],
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error, "Could not invite the lawyer");
  }
}
