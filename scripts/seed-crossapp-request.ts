/**
 * Seed a cross-app assistance request for video screenshots.
 * Creates a lawyer profile (if needed) and a pending request from "DPO Central".
 *
 * Usage: npx tsx scripts/seed-crossapp-request.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LAWYER_EMAIL = "alex@example-firm.test";
const REQUESTER_EMAIL = "maria.garcia@meridianretail.eu";

async function main() {
  // Find or create the lawyer user
  let lawyer = await prisma.user.findUnique({ where: { email: LAWYER_EMAIL } });
  if (!lawyer) {
    lawyer = await prisma.user.create({
      data: {
        email: LAWYER_EMAIL,
        name: "Alex Ferris",
        emailVerified: new Date(),
        role: "LAWYER",
      },
    });
    console.log("Created lawyer user:", lawyer.id);
  } else {
    console.log("Lawyer user exists:", lawyer.id);
    // Ensure LAWYER role
    if (lawyer.role !== "LAWYER") {
      await prisma.user.update({ where: { id: lawyer.id }, data: { role: "LAWYER" } });
    }
  }

  // Ensure lawyer profile is published + accepting
  let profile = await prisma.lawyerProfile.findUnique({ where: { userId: lawyer.id } });
  if (!profile) {
    profile = await prisma.lawyerProfile.create({
      data: {
        userId: lawyer.id,
        isPublished: true,
        acceptingClients: true,
        bio: "Admitted to the State Bar of California (#000000) and the Madrid Bar / ICAM (#00000). Specializing in privacy, data protection, and intellectual property across US and EU jurisdictions.",
        jurisdictions: ["CALIFORNIA", "SPAIN"],
        languages: ["ENGLISH", "SPANISH"],
        specializations: ["GDPR", "CCPA_US_STATE", "DPIA_IMPACT", "DSAR_RIGHTS", "DPA_VENDOR", "VENDOR_RISK", "CROSS_BORDER_TRANSFERS"],
        certifications: ["CIPP_E", "CIPP_US", "CIPM"],
        expertTypes: ["TECHNICAL"],
      },
    });
    console.log("Created lawyer profile:", profile.id);
  } else {
    console.log("Lawyer profile exists:", profile.id);
    if (!profile.isPublished || !profile.acceptingClients) {
      await prisma.lawyerProfile.update({
        where: { id: profile.id },
        data: { isPublished: true, acceptingClients: true },
      });
    }
  }

  // Find or create the requester user
  let requester = await prisma.user.findUnique({ where: { email: REQUESTER_EMAIL } });
  if (!requester) {
    requester = await prisma.user.create({
      data: {
        email: REQUESTER_EMAIL,
        name: "María García",
        emailVerified: new Date(),
      },
    });
    console.log("Created requester:", requester.id);
  }

  // Delete any existing video demo requests for clean state
  await prisma.recommendationRequest.deleteMany({
    where: {
      lawyerId: lawyer.id,
      sourceApp: { not: null },
    },
  });

  // Create the cross-app request from "DPO Central"
  const request = await prisma.recommendationRequest.create({
    data: {
      requesterId: requester.id,
      lawyerId: lawyer.id,
      contractType: "Data Processing Agreement",
      governingLaw: "SPAIN",
      message: "We need help reviewing our processor agreement for GDPR compliance. Our DPO flagged several issues in the sub-processor clauses and cross-border transfer mechanisms.",
      status: "PENDING",
      sourceApp: "dpo-central",
      externalRequesterName: "María García",
      externalRequesterEmail: REQUESTER_EMAIL,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("Created cross-app request:", request.id, "(sourceApp: dpo-central)");

  // Also create one from AI Sentinel for variety
  const request2 = await prisma.recommendationRequest.create({
    data: {
      requesterId: requester.id,
      lawyerId: lawyer.id,
      contractType: "AI System Risk Assessment",
      message: "Our AI Officer needs legal review of the FRIA for our credit scoring model. Potential Art. 6 fundamental rights concerns.",
      status: "PENDING",
      sourceApp: "ai-sentinel",
      externalRequesterName: "María García",
      externalRequesterEmail: REQUESTER_EMAIL,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("Created cross-app request:", request2.id, "(sourceApp: ai-sentinel)");

  console.log("\nDone! Login as", LAWYER_EMAIL, "to see requests in /lawyers/requests");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
