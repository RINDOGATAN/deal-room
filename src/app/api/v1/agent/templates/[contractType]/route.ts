/**
 * Agent API — Template Detail
 *
 * GET /api/v1/agent/templates/:contractType
 * Returns full template detail with all clauses and options.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  authenticateApiKey,
  requireScope,
  ApiScopeError,
} from "@/server/middleware/apiKeyAuth";
import { checkEntitlement } from "@/server/services/licensing/entitlement";
import { features } from "@/config/features";
import { createLogger } from "@/lib/logger";

const logger = createLogger("agent-api");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractType: string }> }
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
      requireScope(auth, "templates:read");
    } catch (e) {
      if (e instanceof ApiScopeError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }

    const { contractType } = await params;

    const template = await prisma.contractTemplate.findUnique({
      where: { contractType },
      include: {
        skillPackage: true,
        clauses: {
          orderBy: { order: "asc" },
          include: {
            options: {
              orderBy: { order: "asc" },
              select: {
                optionId: true,
                code: true,
                label: true,
                order: true,
                plainDescription: true,
                biasPartyA: true,
                biasPartyB: true,
              },
            },
          },
        },
      },
    });

    if (!template || !template.isActive) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Check entitlement for premium templates
    if (template.skillPackageId && template.skillPackage) {
      const result = await checkEntitlement(
        auth.customer.id,
        template.skillPackage.skillId
      );
      if (!result.entitled) {
        return NextResponse.json(
          { error: "Not entitled to this template" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      contractType: template.contractType,
      displayName: template.displayName,
      description: template.description,
      version: template.version,
      jurisdictions: template.jurisdictions,
      languages: template.languages,
      category: template.category,
      isPremium: !!template.skillPackageId,
      clauses: template.clauses.map((c) => ({
        clauseId: c.clauseId,
        title: c.title,
        category: c.category,
        order: c.order,
        plainDescription: c.plainDescription,
        isRequired: c.isRequired,
        options: c.options.map((o) => ({
          code: o.code,
          label: o.label,
          order: o.order,
          plainDescription: o.plainDescription,
          biasPartyA: o.biasPartyA,
          biasPartyB: o.biasPartyB,
        })),
      })),
    });
  } catch (error) {
    logger.error("Error getting template detail", { err: String(error) });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
