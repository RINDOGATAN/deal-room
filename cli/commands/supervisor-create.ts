#!/usr/bin/env tsx
/**
 * Create a Supervisor account
 *
 * Usage:
 *   npm run supervisor:create -- --email=supervisor@lawfirm.com --name="Jane Smith"
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let email = "";
  let name = "";

  for (const arg of args) {
    if (arg.startsWith("--email=")) {
      email = arg.substring("--email=".length);
    } else if (arg.startsWith("--name=")) {
      name = arg.substring("--name=".length);
    }
  }

  if (!email) {
    console.error("Error: --email is required");
    console.error("Usage: npm run supervisor:create -- --email=supervisor@lawfirm.com --name=\"Jane Smith\"");
    process.exit(1);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error("Error: Invalid email format");
    process.exit(1);
  }

  try {
    // Check if supervisor already exists
    const existing = await prisma.supervisor.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      console.log(`Supervisor already exists: ${email}`);
      console.log(`  ID: ${existing.id}`);
      console.log(`  Name: ${existing.name || "(not set)"}`);
      console.log(`  Active: ${existing.isActive}`);
      console.log(`  Created: ${existing.createdAt.toISOString()}`);
      return;
    }

    // Create supervisor
    const supervisor = await prisma.supervisor.create({
      data: {
        email: email.toLowerCase(),
        name: name || null,
      },
    });

    console.log("✓ Supervisor created successfully!");
    console.log(`  ID: ${supervisor.id}`);
    console.log(`  Email: ${supervisor.email}`);
    console.log(`  Name: ${supervisor.name || "(not set)"}`);
    console.log("");
    console.log("Next steps:");
    console.log("  1. The supervisor can sign in at /supervise/sign-in");
    console.log("  2. They will set up 2FA on first login");
    console.log("  3. Assign deals to them via the Platform Admin portal");
  } catch (error) {
    console.error("Error creating supervisor:", error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
