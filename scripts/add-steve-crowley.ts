/**
 * One-off: add Steve Crowley to the Expert Directory alongside
 * Wences Spiegel as a Deployment consultant. Idempotent — re-running
 * just re-upserts the same row. Mirrors the corresponding section in
 * prisma/seed.ts so future full re-seeds stay consistent.
 *
 * Run against production:
 *   npx vercel env pull .env.prod --environment production
 *   DATABASE_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')" \
 *     npx tsx scripts/add-steve-crowley.ts
 *   rm .env.prod
 *
 * Pre-req: the migration `20260524120000_add_lawyer_profile_notify_emails`
 * must be applied first (`prisma migrate deploy`), otherwise the
 * `notifyEmails` write will fail.
 */

import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  const steveUser = await prisma.user.upsert({
    where: { email: "steve.crowley@spc-consulting.com" },
    create: {
      email: "steve.crowley@spc-consulting.com",
      name: "Steve Crowley",
      company: "SPC Consulting",
      isLawyer: true,
      role: "LAWYER",
    },
    update: {
      name: "Steve Crowley",
      company: "SPC Consulting",
      isLawyer: true,
      role: "LAWYER",
    },
  });

  await prisma.lawyerProfile.upsert({
    where: { userId: steveUser.id },
    create: {
      userId: steveUser.id,
      title: "Deployment Consultant",
      bio: "Self-hosting and deployment specialist covering EU, US, and UK environments.",
      jurisdictions: [],
      languages: ["en", "es"],
      expertTypes: ["DEPLOYMENT"],
      specializations: ["SELF_HOSTING_DEPLOYMENT"],
      certifications: [],
      countryCode: "GB",
      city: "London",
      jurisdictionsCovered: ["EU", "US", "UK"],
      acceptingClients: true,
      isPublished: true,
      notifyEmails: ["wences.spiegel@rindogatan.com"],
    },
    update: {
      title: "Deployment Consultant",
      languages: ["en", "es"],
      expertTypes: ["DEPLOYMENT"],
      specializations: ["SELF_HOSTING_DEPLOYMENT"],
      countryCode: "GB",
      city: "London",
      jurisdictionsCovered: ["EU", "US", "UK"],
      isPublished: true,
      notifyEmails: ["wences.spiegel@rindogatan.com"],
    },
  });

  const verify = await prisma.lawyerProfile.findUnique({
    where: { userId: steveUser.id },
    include: { user: { select: { email: true, name: true } } },
  });

  console.log("\nSteve Crowley directory entry:");
  console.log(`  userId        : ${steveUser.id}`);
  console.log(`  user.email    : ${verify?.user.email}`);
  console.log(`  user.name     : ${verify?.user.name}`);
  console.log(`  title         : ${verify?.title}`);
  console.log(`  expertTypes   : ${verify?.expertTypes.join(", ")}`);
  console.log(`  notifyEmails  : ${verify?.notifyEmails.join(", ")}`);
  console.log(`  isPublished   : ${verify?.isPublished}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
