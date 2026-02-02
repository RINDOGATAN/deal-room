#!/usr/bin/env tsx
/**
 * Create a Platform Admin account
 *
 * Usage:
 *   npm run admin:create -- --email=admin@nel.law --name="Platform Admin"
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
    console.error("Usage: npm run admin:create -- --email=admin@nel.law --name=\"Platform Admin\"");
    process.exit(1);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error("Error: Invalid email format");
    process.exit(1);
  }

  try {
    // Check if admin already exists
    const existing = await prisma.platformAdmin.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      console.log(`Platform admin already exists: ${email}`);
      console.log(`  ID: ${existing.id}`);
      console.log(`  Name: ${existing.name || "(not set)"}`);
      console.log(`  Active: ${existing.isActive}`);
      console.log(`  Created: ${existing.createdAt.toISOString()}`);
      return;
    }

    // Create admin
    const admin = await prisma.platformAdmin.create({
      data: {
        email: email.toLowerCase(),
        name: name || null,
      },
    });

    console.log("✓ Platform admin created successfully!");
    console.log(`  ID: ${admin.id}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Name: ${admin.name || "(not set)"}`);
    console.log("");
    console.log("Next steps:");
    console.log("  1. Go to /admin/sign-in");
    console.log("  2. Enter the admin email");
    console.log("  3. Click the magic link in the email");
    console.log("  4. Set up 2FA using an authenticator app");
  } catch (error) {
    console.error("Error creating platform admin:", error);
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
