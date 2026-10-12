// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One-off backfill: encrypt the admin and supervisor TOTP secrets still
 * stored in plain text (src/lib/totp-secret-box.ts).
 *
 *   npx tsx scripts/encrypt-totp-secrets.ts           # preview: counts only
 *   npx tsx scripts/encrypt-totp-secrets.ts --apply   # encrypt in place
 *
 * Needs DATABASE_URL and TOTP_ENCRYPTION_KEY (the same key the deployment
 * uses). Prints counts only, never a secret. Each row is updated only if its
 * value is still the plain value read, so a concurrent setup is not
 * overwritten. Re-running is safe: encrypted rows are skipped. Every row is
 * decrypted after writing and compared before the next one.
 */
import { PrismaClient } from "@prisma/client";
import { isSealed, openTotpSecret, sealTotpSecret } from "../src/lib/totp-secret-box";

const apply = process.argv.includes("--apply");

async function main() {
  if (!process.env.TOTP_ENCRYPTION_KEY) throw new Error("TOTP_ENCRYPTION_KEY is not set");
  const prisma = new PrismaClient();
  try {
    const tables = [
      { name: "admin_two_factor", model: prisma.adminTwoFactor },
      { name: "supervisor_two_factor", model: prisma.supervisorTwoFactor },
    ] as const;
    for (const { name, model } of tables) {
      const rows: { id: string; secret: string }[] = await (model as any).findMany({ select: { id: true, secret: true } });
      const plain = rows.filter((r) => !isSealed(r.secret));
      console.log(`${name}: ${rows.length} rows, ${plain.length} in plain text`);
      if (!apply) continue;
      let done = 0;
      for (const row of plain) {
        const sealed = sealTotpSecret(row.secret);
        if (openTotpSecret(sealed) !== row.secret) throw new Error(`${name}: round trip failed, stopping`);
        const res = await (model as any).updateMany({ where: { id: row.id, secret: row.secret }, data: { secret: sealed } });
        done += res.count;
      }
      console.log(`${name}: encrypted ${done}`);
    }
    if (!apply) console.log("Preview only. Re-run with --apply to encrypt.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
