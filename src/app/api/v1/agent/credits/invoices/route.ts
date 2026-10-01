// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — invoices of the credit packs
 *
 * GET /api/v1/agent/credits/invoices
 * The latest pack purchases of the key's customer (whichever key bought
 * them), each with its invoice: number, hosted page and PDF. The links are
 * read from Stripe on demand through the checkout session id; a pack bought
 * before invoices were switched on has `invoice: null`. Contracts paid with
 * credits have no invoice of their own: the pack's invoice covers them.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { features } from "@/config/features";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { apiError } from "@/lib/api-response";
import { getInvoiceLinksForSessions } from "@/lib/stripe";

export async function GET(req: NextRequest) {
  try {
    if (!features.agentApi) {
      return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    const auth = await authenticateApiKey(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      requireScope(auth, "billing:read");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    if (!features.stripeEnabled) {
      return NextResponse.json({ billing: "off", purchases: [] });
    }

    const purchases = await prisma.customerCreditEntry.findMany({
      where: { customerId: auth.customer.id, reason: "PURCHASE", stripeCheckoutSessionId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const invoices = await getInvoiceLinksForSessions(purchases.map((p) => p.stripeCheckoutSessionId));

    return NextResponse.json({
      billing: "per_contract",
      purchases: purchases.map((p, i) => ({
        credits: p.delta,
        apiKeyId: p.apiKeyId,
        createdAt: p.createdAt,
        invoice: invoices[i]
          ? {
              number: invoices[i]!.number,
              hostedInvoiceUrl: invoices[i]!.hostedInvoiceUrl,
              invoicePdf: invoices[i]!.invoicePdf,
            }
          : null,
      })),
    });
  } catch (error) {
    return apiError(error, "Failed to read the invoices");
  }
}
