/**
 * Agent API — Playbook Detail (Get / Update / Delete)
 *
 * GET    /api/v1/agent/playbooks/:id  — Get playbook detail
 * PUT    /api/v1/agent/playbooks/:id  — Update playbook + entries
 * DELETE /api/v1/agent/playbooks/:id  — Delete playbook
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { features } from "@/config/features";
import { createLogger } from "@/lib/logger";

const logger = createLogger("agent-api");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const playbook = await prisma.playbook.findUnique({
      where: { id },
      include: { entries: true },
    });

    if (!playbook || playbook.customerId !== auth.customer.id) {
      return NextResponse.json(
        { error: "Playbook not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ playbook });
  } catch (error) {
    logger.error("Error getting playbook", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.playbook.findUnique({
      where: { id },
    });

    if (!existing || existing.customerId !== auth.customer.id) {
      return NextResponse.json(
        { error: "Playbook not found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.governingLaw !== undefined) updateData.governingLaw = body.governingLaw;
    if (body.contractLanguage !== undefined) updateData.contractLanguage = body.contractLanguage;
    if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    // If setting as default, unset others
    if (body.isDefault) {
      await prisma.playbook.updateMany({
        where: {
          customerId: auth.customer.id,
          contractType: existing.contractType,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    // If entries are provided, validate and replace
    if (body.entries && Array.isArray(body.entries)) {
      const template = await prisma.contractTemplate.findUnique({
        where: { contractType: existing.contractType },
        include: {
          clauses: { include: { options: true } },
        },
      });

      if (!template) {
        return NextResponse.json(
          { error: "Contract template not found" },
          { status: 400 }
        );
      }

      const clauseMap = new Map<string, Set<string>>();
      for (const clause of template.clauses) {
        clauseMap.set(clause.clauseId, new Set(clause.options.map((o) => o.code)));
      }

      for (const entry of body.entries) {
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
            { error: `Invalid preferredOptionId "${entry.preferredOptionId}" for clause "${entry.clauseId}"` },
            { status: 400 }
          );
        }
      }

      // Delete old entries and create new ones
      await prisma.playbookEntry.deleteMany({
        where: { playbookId: id },
      });

      await prisma.playbookEntry.createMany({
        data: body.entries.map(
          (e: {
            clauseId: string;
            preferredOptionId: string;
            priority?: number;
            flexibility?: number;
            isRedLine?: boolean;
            acceptableOptions?: string[];
            notes?: string;
          }) => ({
            playbookId: id,
            clauseId: e.clauseId,
            preferredOptionId: e.preferredOptionId,
            priority: Math.max(1, Math.min(5, e.priority ?? 3)),
            flexibility: Math.max(1, Math.min(5, e.flexibility ?? 3)),
            isRedLine: e.isRedLine ?? false,
            acceptableOptions: e.acceptableOptions ?? [],
            notes: e.notes,
          })
        ),
      });
    }

    const playbook = await prisma.playbook.update({
      where: { id },
      data: updateData,
      include: { entries: true },
    });

    return NextResponse.json({ playbook });
  } catch (error) {
    logger.error("Error updating playbook", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const playbook = await prisma.playbook.findUnique({
      where: { id },
    });

    if (!playbook || playbook.customerId !== auth.customer.id) {
      return NextResponse.json(
        { error: "Playbook not found" },
        { status: 404 }
      );
    }

    await prisma.playbook.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error deleting playbook", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
