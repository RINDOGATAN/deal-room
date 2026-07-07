// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — Webhook Management
 *
 * POST /api/v1/agent/webhooks — register a webhook endpoint
 * GET /api/v1/agent/webhooks — list webhook endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { withIdempotency } from "@/server/middleware/idempotency";
import { features } from "@/config/features";
import { createLogger } from "@/lib/logger";

const logger = createLogger("agent-api");

const VALID_EVENTS = [
  "negotiation.pending",
  "negotiation.agreed",
  "negotiation.failed",
  "negotiation.suggested",
  "negotiation.counter",
];

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
      requireScope(auth, "webhooks:manage");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    return await withIdempotency(req, auth.customer.id, async () => {
    const body = await req.json();
    const { url, events } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: "events must be a non-empty array", validEvents: VALID_EVENTS },
        { status: 400 }
      );
    }

    const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid events: ${invalidEvents.join(", ")}`, validEvents: VALID_EVENTS },
        { status: 400 }
      );
    }

    const secret = `whsec_${randomBytes(24).toString("hex")}`;

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        customerId: auth.customer.id,
        url,
        secret,
        events,
      },
    });

    return NextResponse.json(
      {
        id: endpoint.id,
        url: endpoint.url,
        events: endpoint.events,
        secret, // Only shown once on creation
        isActive: endpoint.isActive,
        createdAt: endpoint.createdAt,
      },
      { status: 201 }
    );
    });
  } catch (error) {
    logger.error("Error creating webhook", { err: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
      requireScope(auth, "webhooks:manage");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { customerId: auth.customer.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ webhooks: endpoints });
  } catch (error) {
    logger.error("Error listing webhooks", { err: String(error) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
