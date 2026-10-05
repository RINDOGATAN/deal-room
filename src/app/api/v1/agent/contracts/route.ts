// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API: make a contract in one call.
 *
 * POST /api/v1/agent/contracts
 *   { contractType, governingLaw?, language?, title?, party, counterparty?,
 *     role?, terms?, clauses?, includeText? }
 *
 * Creates an agreed single-party contract (every clause left out takes the
 * skill's baseline option), pays for it with one of the customer's credits
 * exactly as the first document download does, and returns the deal, the
 * links to its documents and, with includeText, its text. HTTP 402 with no
 * credit (nothing is created). The logic lives in
 * `src/server/services/agent/generateContract.ts`; the MCP tool
 * `generate_contract` calls this route.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  checkRateLimit,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { features } from "@/config/features";
import { apiError } from "@/lib/api-response";
import { createLogger } from "@/lib/logger";
import { withIdempotency } from "@/server/middleware/idempotency";
import { generateContract, generateContractSchema } from "@/server/services/agent/generateContract";

const logger = createLogger("agent-api");

export async function POST(req: NextRequest) {
  try {
    if (!features.agentApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    const auth = await authenticateApiKey(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      // Creating the deal and fetching its document: the scopes of the two
      // calls this one replaces.
      requireScope(auth, "negotiate");
      requireScope(auth, "deals:read");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    return await withIdempotency(req, auth.customer.id, async () => {
      // The hourly limit of the other deal-creating agent calls.
      const rateLimit = await checkRateLimit(auth.customer.id, "negotiate");
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
        );
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "The body must be JSON" }, { status: 400 });
      }
      const parsed = generateContractSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid request body", details: parsed.error.flatten() },
          { status: 400 },
        );
      }

      const result = await generateContract(prisma, auth, parsed.data);
      if (result.ok) {
        logger.info("Agent one-call contract created", {
          customerId: auth.customer.id,
          dealId: result.body.dealId,
        });
      }
      return NextResponse.json(result.body, { status: result.status });
    });
  } catch (error) {
    logger.error("Agent one-call contract failed", { err: String(error) });
    return apiError(error, "Failed to create the contract");
  }
}
