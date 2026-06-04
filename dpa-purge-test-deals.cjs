/**
 * One-off: purge DPA test-fixture deals from production.
 *
 * Dry-run by default (prints what WOULD be deleted). Add --execute to delete.
 * Run from the project dir so @prisma/client resolves:
 *   node dpa-purge-test-deals.cjs            # dry-run, review the list
 *   node dpa-purge-test-deals.cjs --execute  # actually delete (after backup)
 *
 * Deletes only deals whose names match clear test-fixture patterns; everything
 * else (your real deals) is kept. A full backup is written before any delete.
 * Delete this file when you're done.
 */
const fs = require("fs");
const path = require("path");

// Load the production UNPOOLED URL from .env.local (no need to export anything).
const envLocal = fs.readFileSync(path.join(__dirname, ".env.local"), "utf8");
const m = envLocal.match(/^DATABASE_URL_UNPOOLED\s*=\s*"?([^"\n]+)/m);
if (!m) { console.error("DATABASE_URL_UNPOOLED not found in .env.local"); process.exit(1); }
process.env.DATABASE_URL = m[1];

const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const EXECUTE = process.argv.includes("--execute");
const JUNK = new Set(["Me","af","asdf","Ns","aS","adf","adg","Super Deal","Idnd","DPA Test","spc1","DPA en castellano prueba"]);
const isTestFixture = (name) => /^(Smoke DPA|Scale DPA|Lifecycle DPA|Demo:|smoke-)/.test(name) || JUNK.has(name);

(async () => {
  const host = process.env.DATABASE_URL.replace(/.*@([^/]+)\/.*/, "$1");
  console.log(`Target DB host: ${host}\nMode: ${EXECUTE ? "EXECUTE (will delete)" : "DRY-RUN (no changes)"}\n`);

  const t = await p.contractTemplate.findUnique({ where: { contractType: "DPA" } });
  const deals = await p.dealRoom.findMany({
    where: { contractTemplateId: t.id },
    include: { parties: true, clauses: { include: { selections: true } }, signingRequest: true },
    orderBy: { createdAt: "asc" },
  });
  const purge = deals.filter((d) => isTestFixture(d.name));
  const keep = deals.filter((d) => !isTestFixture(d.name));

  console.log(`PURGE ${purge.length} test-fixture deals; KEEP ${keep.length}.`);
  console.log("\nKEEP (these survive):");
  keep.forEach((d) => console.log(`   • ${d.name} [${d.status}/${d.dealMode}]`));

  if (!EXECUTE) {
    console.log(`\nDRY-RUN — nothing deleted. Re-run with --execute to delete the ${purge.length} fixtures.`);
    await p.$disconnect();
    return;
  }

  const backup = path.join(__dirname, "..", "dpa-purge-backup.json");
  fs.writeFileSync(backup, JSON.stringify({ purged: purge }, null, 2));
  console.log(`\nBackup of purged deals written: ${backup}`);
  const r = await p.dealRoom.deleteMany({ where: { id: { in: purge.map((d) => d.id) } } });
  console.log(`Deleted ${r.count} test-fixture deals (cascaded parties/clauses/selections).`);
  const remaining = await p.dealRoom.count({ where: { contractTemplateId: t.id } });
  console.log(`DPA deals remaining: ${remaining}`);
  await p.$disconnect();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
