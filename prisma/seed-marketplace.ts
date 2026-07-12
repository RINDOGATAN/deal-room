// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

// Standalone entry (npm run db:seed-marketplace) that migrate.sh runs on EVERY
// boot — including existing installs where the full seed is skipped to protect
// live data. Idempotent + additive, so re-running is safe. Self-host only:
// hosted seeds real premium content from SKILLS_DIR and must not get stubs.
import { PrismaClient } from "@prisma/client";
import { seedMarketplaceStubs } from "./marketplace-stubs";

async function main() {
  if (process.env.SKILLS_DIR) {
    console.log("[seed-marketplace] SKILLS_DIR set (hosted) — skipping stubs.");
    return;
  }
  const prisma = new PrismaClient();
  try {
    console.log("[seed-marketplace] syncing premium-skill marketplace stubs…");
    await seedMarketplaceStubs(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[seed-marketplace] failed:", e);
  process.exit(1);
});
