// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import prisma from "@/lib/prisma";
import { PlaybookGuide } from "./PlaybookGuide";

export const dynamic = "force-dynamic";

export default async function PlaybookGuidePage() {
  const templates = await prisma.contractTemplate.findMany({
    where: {
      isActive: true,
      contractType: { startsWith: "A2A_" },
    },
    include: {
      clauses: {
        orderBy: { order: "asc" },
        include: {
          options: {
            orderBy: { order: "asc" },
          },
        },
      },
    },
    orderBy: { displayName: "asc" },
  });

  const skills = templates.map((t) => ({
    contractType: t.contractType,
    displayName: t.displayName,
    displayNameLocalized: t.displayNameLocalized as Record<string, string> | null,
    clauses: t.clauses.map((c) => ({
      clauseId: c.clauseId,
      title: c.title,
      category: c.category,
      order: c.order,
      isRequired: c.isRequired,
      localizedContent: c.localizedContent as Record<string, unknown> | null,
      options: c.options.map((o) => ({
        code: o.code,
        label: o.label,
        order: o.order,
        biasPartyA: o.biasPartyA,
        biasPartyB: o.biasPartyB,
        localizedContent: o.localizedContent as Record<string, unknown> | null,
      })),
    })),
  }));

  return <PlaybookGuide skills={skills} />;
}
