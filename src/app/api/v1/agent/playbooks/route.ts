// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API — Playbooks (List + Create)
 *
 * GET  /api/v1/agent/playbooks       — List own playbooks
 * POST /api/v1/agent/playbooks       — Create playbook with entries
 */

import { NextRequest, NextResponse } from "next/server";
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
      requireScope(auth, "playbook:read");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const playbooks = await prisma.playbook.findMany({
      where: { customerId: auth.customer.id, isActive: true },
      include: {
        _count: { select: { entries: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      playbooks: playbooks.map((p) => ({
        id: p.id,
        name: p.name,
        contractType: p.contractType,
        governingLaw: p.governingLaw,
        contractLanguage: p.contractLanguage,
        isDefault: p.isDefault,
        entryCount: p._count.entries,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    logger.error("Error listing playbooks", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
      requireScope(auth, "playbook:write");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    return await withIdempotency(req, auth.customer.id, async () => {
    const body = await req.json();
    const { name, contractType, governingLaw, contractLanguage, isDefault, metadata, entries } = body;

    // Validate required fields
    if (!name || !contractType || !governingLaw) {
      return NextResponse.json(
        { error: "name, contractType, and governingLaw are required" },
        { status: 400 }
      );
    }

    // Validate governingLaw enum
    if (!["CALIFORNIA", "ENGLAND_WALES", "SPAIN"].includes(governingLaw)) {
      return NextResponse.json(
        { error: "governingLaw must be CALIFORNIA, ENGLAND_WALES, or SPAIN" },
        { status: 400 }
      );
    }

    // Validate entries
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: "entries array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate the contract template exists and entries reference valid clause/option IDs
    const template = await prisma.contractTemplate.findUnique({
      where: { contractType },
      include: {
        clauses: {
          include: { options: true },
        },
      },
    });

    if (!template || !template.isActive) {
      return NextResponse.json(
        { error: `Contract template not found: ${contractType}` },
        { status: 400 }
      );
    }

    if (template.soloModeOnly) {
      return NextResponse.json(
        { error: "This contract type is solo-mode only and cannot be used for agent negotiation" },
        { status: 400 }
      );
    }

    // Build a lookup of valid clauseId → option codes
    const clauseMap = new Map<string, Set<string>>();
    const requiredClauseIds = new Set<string>();
    for (const clause of template.clauses) {
      const codes = new Set(clause.options.map((o) => o.code));
      clauseMap.set(clause.clauseId, codes);
      if (clause.isRequired) {
        requiredClauseIds.add(clause.clauseId);
      }
    }

    // Validate each entry
    const entryClauseIds = new Set<string>();
    for (const entry of entries) {
      if (!entry.clauseId || !entry.preferredOptionId) {
        return NextResponse.json(
          { error: "Each entry requires clauseId and preferredOptionId" },
          { status: 400 }
        );
      }

      const validOptions = clauseMap.get(entry.clauseId);
      if (!validOptions) {
        return NextResponse.json(
          { error: `Invalid clauseId: ${entry.clauseId}` },
          { status: 400 }
        );
      }

      if (!validOptions.has(entry.preferredOptionId)) {
        return NextResponse.json(
          {
            error: `Invalid preferredOptionId "${entry.preferredOptionId}" for clause "${entry.clauseId}". Valid options: ${[...validOptions].join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Validate acceptableOptions if provided
      if (entry.acceptableOptions && Array.isArray(entry.acceptableOptions)) {
        for (const optCode of entry.acceptableOptions) {
          if (!validOptions.has(optCode)) {
            return NextResponse.json(
              {
                error: `Invalid acceptableOption "${optCode}" for clause "${entry.clauseId}"`,
              },
              { status: 400 }
            );
          }
        }
      }

      entryClauseIds.add(entry.clauseId);
    }

    // Check all required clauses have entries
    for (const requiredId of requiredClauseIds) {
      if (!entryClauseIds.has(requiredId)) {
        return NextResponse.json(
          { error: `Required clause missing entry: ${requiredId}` },
          { status: 400 }
        );
      }
    }

    // Check unique name per customer
    const existing = await prisma.playbook.findUnique({
      where: {
        customerId_name: { customerId: auth.customer.id, name },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Playbook with name "${name}" already exists` },
        { status: 409 }
      );
    }

    // If isDefault, unset other defaults for same contractType
    if (isDefault) {
      await prisma.playbook.updateMany({
        where: {
          customerId: auth.customer.id,
          contractType,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    // Create the playbook with entries
    const playbook = await prisma.playbook.create({
      data: {
        customerId: auth.customer.id,
        name,
        contractType,
        governingLaw,
        contractLanguage: contractLanguage || "en",
        isDefault: isDefault || false,
        metadata: metadata || undefined,
        entries: {
          create: entries.map(
            (e: {
              clauseId: string;
              preferredOptionId: string;
              priority?: number;
              flexibility?: number;
              isRedLine?: boolean;
              acceptableOptions?: string[];
              notes?: string;
            }) => ({
              clauseId: e.clauseId,
              preferredOptionId: e.preferredOptionId,
              priority: Math.max(1, Math.min(5, e.priority ?? 3)),
              flexibility: Math.max(1, Math.min(5, e.flexibility ?? 3)),
              isRedLine: e.isRedLine ?? false,
              acceptableOptions: e.acceptableOptions ?? [],
              notes: e.notes,
            })
          ),
        },
      },
      include: {
        entries: true,
      },
    });

    return NextResponse.json({ playbook }, { status: 201 });
    });
  } catch (error) {
    logger.error("Error creating playbook", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
