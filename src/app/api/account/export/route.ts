// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Account export
 *
 * GET /api/account/export
 * Returns, as a JSON download, everything the signed-in account created or
 * joined: its deals (terms, parameters, its own selections, agreed options,
 * and links to the contract documents) and its startup journeys. Always
 * allowed, including after the hosted pilot's edit window has closed: it is
 * one of the two ways out of the pilot. Works the same on the kit.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/api-response";

const SIGNABLE_STATUSES = new Set(["AGREED", "SIGNING", "COMPLETED"]);

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user, deals, journeys] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, company: true, createdAt: true },
      }),
      prisma.dealRoom.findMany({
        where: { parties: { some: { userId } } },
        orderBy: { createdAt: "asc" },
        include: {
          contractTemplate: { select: { contractType: true, displayName: true } },
          parties: {
            select: {
              id: true,
              userId: true,
              role: true,
              status: true,
              email: true,
              name: true,
              company: true,
              signingDetails: true,
            },
          },
          clauses: {
            include: {
              clauseTemplate: { select: { clauseId: true, title: true } },
              selections: {
                include: { option: { select: { optionId: true, code: true, label: true } } },
              },
            },
          },
        },
      }),
      prisma.startupJourney.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        include: { founders: true },
      }),
    ]);

    // Agreed options are stored by id; resolve them in one query.
    const agreedIds = deals.flatMap((d) =>
      d.clauses.map((c) => c.agreedOptionId).filter((id): id is string => !!id),
    );
    const agreedOptions = agreedIds.length
      ? await prisma.clauseOption.findMany({
          where: { id: { in: agreedIds } },
          select: { id: true, optionId: true, code: true, label: true, legalText: true },
        })
      : [];
    const optionById = new Map(agreedOptions.map((o) => [o.id, o]));

    const exportedDeals = deals.map((deal) => {
      const ownPartyIds = new Set(
        deal.parties.filter((p) => p.userId === userId).map((p) => p.id),
      );
      const signable = SIGNABLE_STATUSES.has(deal.status);
      return {
        id: deal.id,
        name: deal.name,
        contractType: deal.contractTemplate.contractType,
        contractName: deal.contractTemplate.displayName,
        mode: deal.dealMode,
        status: deal.status,
        governingLaw: deal.governingLaw,
        contractLanguage: deal.contractLanguage,
        parameters: deal.parameters,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
        parties: deal.parties.map((p) => ({
          role: p.role,
          status: p.status,
          email: p.email,
          name: p.name,
          company: p.company,
          isYou: p.userId === userId,
          // Signing details are only the account's own.
          signingDetails: p.userId === userId ? p.signingDetails : undefined,
        })),
        clauses: deal.clauses.map((c) => {
          const agreed = c.agreedOptionId ? optionById.get(c.agreedOptionId) : undefined;
          // The other party's selections stay private, as in the app.
          const own = c.selections.find((s) => ownPartyIds.has(s.partyId));
          return {
            clauseId: c.clauseTemplate.clauseId,
            title: c.clauseTemplate.title,
            status: c.status,
            agreedOption: agreed
              ? { optionId: agreed.optionId, code: agreed.code, label: agreed.label, legalText: agreed.legalText }
              : null,
            yourSelection: own
              ? {
                  optionId: own.option.optionId,
                  code: own.option.code,
                  label: own.option.label,
                  priority: own.priority,
                  flexibility: own.flexibility,
                  notes: own.notes,
                }
              : null,
          };
        }),
        documents: signable
          ? {
              pdf: `/api/deals/${deal.id}/document`,
              docx: `/api/deals/${deal.id}/document/docx`,
              txt: `/api/deals/${deal.id}/document/txt`,
            }
          : null,
      };
    });

    const body = {
      exportedAt: new Date().toISOString(),
      account: user,
      deals: exportedDeals,
      startupJourneys: journeys,
    };

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="dealroom-export-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error, "Failed to export account data");
  }
}
