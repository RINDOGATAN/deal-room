// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One-off: mint a Firmas test link against the production DB so the
 * Firmas integration team can curl /api/signing/firmas-bundle/<token>
 * before any phone tap.
 *
 * What it does:
 *   1. Finds tester-business@todo.law (allowlisted tester persona).
 *   2. Creates a fresh DealRoom in SIGNING state — SOLO mode, NDA,
 *      English/California, all clauses auto-agreed with the first
 *      option. Named "Firmas Phase B Test {timestamp}" so it's
 *      identifiable in admin views and easy to clean up.
 *   3. Creates a SigningRequest in PENDING.
 *   4. Mints a UUID v4 initiatorFirmasToken (the tester is the
 *      INITIATOR of the deal). Mirrors signing.requestFirmasHandoff.
 *   5. Prints the firmas.io/sign/<token> URL and the bundle curl
 *      command for preflighting.
 *
 * Run:
 *   DATABASE_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')" \
 *     npx tsx scripts/mint-firmas-test-link.ts
 *
 * Cleanup: the tester user's TesterBar "Reset my data" button wipes
 * deals + signing artifacts, so resetting via the UI removes this
 * deal too. Or `prisma.dealRoom.delete({ where: { id } })` directly.
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const TESTER_EMAIL = "tester-business@todo.law";
const FIRMAS_BASE_URL = process.env.FIRMAS_BASE_URL ?? "https://www.firmas.io";
const DEALROOM_BASE_URL = "https://dealroom.todo.law";

async function main() {
  const tester = await prisma.user.findUnique({
    where: { email: TESTER_EMAIL },
  });
  if (!tester) {
    throw new Error(
      `Tester user ${TESTER_EMAIL} not found — TESTER_MODE bootstrap may not have run yet`,
    );
  }

  // NDA is the simplest free contract template (3 clauses, all bilingual).
  const template = await prisma.contractTemplate.findFirst({
    where: { contractType: "NDA" },
    include: {
      clauses: {
        include: { options: { orderBy: { order: "asc" } } },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!template) throw new Error("NDA contract template not found");

  const dealName = `Firmas Phase B Test ${new Date().toISOString()}`;
  console.log(`Creating deal: ${dealName}`);

  // Single transaction so a half-built deal can't leak if anything fails.
  const result = await prisma.$transaction(async (tx) => {
    const deal = await tx.dealRoom.create({
      data: {
        name: dealName,
        contractTemplateId: template.id,
        governingLaw: "CALIFORNIA",
        contractLanguage: "en",
        dealMode: "SOLO",
        status: "SIGNING",
        parties: {
          create: {
            role: "INITIATOR",
            status: "SUBMITTED",
            email: tester.email!,
            name: tester.name ?? "Tester Business",
            company: "Firmas Test Co.",
            userId: tester.id,
            submittedAt: new Date(),
            signingDetails: {
              legalName: "Firmas Test Co.",
              address: "100 Market Street, San Francisco, CA 94105",
              taxId: "94-1234567",
              signatoryName: tester.name ?? "Tester Business",
              signatoryTitle: "Chief Executive Officer",
            },
          },
        },
        clauses: {
          create: template.clauses.map((c) => ({
            clauseTemplateId: c.id,
            status: "AGREED",
            // Pick the first option for each clause so the bundle has
            // real legalText to surface. This mirrors what
            // autoAgreeSingleOption does for genuine single-option flows.
            agreedOptionId: c.options[0]?.id ?? null,
          })),
        },
      },
      include: { parties: true, clauses: true },
    });

    // The tester is the INITIATOR of this deal (SOLO mode has no
    // respondent), so the token is minted into initiatorFirmasToken.
    // The callback / bundle endpoints both look up by either token
    // and route the signing to the matching role.
    const token = randomUUID();
    const signingRequest = await tx.signingRequest.create({
      data: {
        dealRoomId: deal.id,
        provider: "firmas",
        status: "SENT",
        externalId: `sign_${Date.now()}`,
        documentUrl: null,
        initiatorFirmasToken: token,
        initiatorFirmasSentAt: new Date(),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    return { dealId: deal.id, token, signingRequestId: signingRequest.id };
  });

  const signUrl = `${FIRMAS_BASE_URL}/sign/${result.token}`;
  const bundleUrl = `${DEALROOM_BASE_URL}/api/signing/firmas-bundle/${result.token}`;

  console.log("");
  console.log("─".repeat(72));
  console.log("✅ Firmas test link minted");
  console.log("─".repeat(72));
  console.log(`DealRoom ID:        ${result.dealId}`);
  console.log(`SigningRequest ID:  ${result.signingRequestId}`);
  console.log(`Firmas token:       ${result.token}`);
  console.log("");
  console.log(`Universal Link:     ${signUrl}`);
  console.log(`Bundle preflight:   curl ${bundleUrl}`);
  console.log("─".repeat(72));
  console.log("");
  console.log(
    "Cleanup: sign in as the tester and click 'Reset my data', or run",
  );
  console.log(`  await prisma.dealRoom.delete({ where: { id: "${result.dealId}" } })`);
}

main()
  .catch((err) => {
    console.error("✗ Failed to mint Firmas test link:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
