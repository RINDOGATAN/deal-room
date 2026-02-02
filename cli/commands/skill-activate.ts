#!/usr/bin/env npx tsx
/**
 * CLI Command: skill:activate
 *
 * Activate a skill with a license key.
 *
 * Usage:
 *   npx deal-room skill:activate --license-key=LIC-XXXX-XXXX-XXXX-XXXX
 *   npx deal-room skill:activate --license-file=./license.json
 */

import { prisma } from "../../src/lib/prisma";
import {
  activateLicense,
  activateOffline,
  getDisplayFingerprint,
} from "../../src/server/services/licensing";
import { LicenseFile } from "../../src/lib/crypto";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: npx deal-room skill:activate [options]

Activate a skill license on this machine.

Options:
  --license-key=KEY    Activate using a license key (LIC-XXXX-XXXX-XXXX-XXXX)
  --license-file=PATH  Activate using an offline license file
  --customer-id=ID     Customer ID (required)
  --help, -h           Show this help message

Examples:
  npx deal-room skill:activate --license-key=LIC-1234-5678-ABCD-EF00 --customer-id=cust_123
  npx deal-room skill:activate --license-file=./license.json --customer-id=cust_123
`);
    process.exit(0);
  }

  // Parse arguments
  const licenseKeyArg = args.find((a) => a.startsWith("--license-key="));
  const licenseFileArg = args.find((a) => a.startsWith("--license-file="));
  const customerIdArg = args.find((a) => a.startsWith("--customer-id="));

  if (!licenseKeyArg && !licenseFileArg) {
    console.error("Error: Either --license-key or --license-file is required");
    process.exit(1);
  }

  if (!customerIdArg) {
    console.error("Error: --customer-id is required");
    process.exit(1);
  }

  const customerId = customerIdArg.split("=")[1];

  // Verify customer exists
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    console.error(`Error: Customer not found: ${customerId}`);
    process.exit(1);
  }

  console.log(`Customer: ${customer.name} (${customer.email})`);
  console.log(`Machine Fingerprint: ${getDisplayFingerprint()}`);
  console.log("");

  let result;

  if (licenseKeyArg) {
    const licenseKey = licenseKeyArg.split("=")[1];
    console.log(`Activating with license key: ${licenseKey}`);
    result = await activateLicense(licenseKey, customerId);
  } else {
    const licensePath = path.resolve(licenseFileArg!.split("=")[1]);

    if (!fs.existsSync(licensePath)) {
      console.error(`Error: License file not found: ${licensePath}`);
      process.exit(1);
    }

    const licenseContent = fs.readFileSync(licensePath, "utf-8");
    const licenseFile = JSON.parse(licenseContent) as LicenseFile;

    console.log(`Activating with offline license file: ${licensePath}`);
    result = await activateOffline(licenseFile, customerId);
  }

  if (!result.success) {
    console.error(`\nActivation failed: ${result.error}`);
    process.exit(1);
  }

  console.log("\nActivation successful!");
  console.log(`  Activation ID: ${result.activationId}`);
  console.log(`  Skill: ${result.skillName} (${result.skillId})`);
  console.log(`  Jurisdictions: ${result.jurisdictions?.join(", ")}`);
  if (result.expiresAt) {
    console.log(`  Expires: ${result.expiresAt.toISOString()}`);
  }
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
