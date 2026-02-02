#!/usr/bin/env npx tsx
/**
 * CLI Command: skill:deactivate
 *
 * Deactivate a skill license on this machine.
 *
 * Usage:
 *   npx deal-room skill:deactivate --license-key=LIC-XXXX-XXXX-XXXX-XXXX --customer-id=cust_123
 */

import { prisma } from "../../src/lib/prisma";
import {
  deactivateLicense,
  getDisplayFingerprint,
} from "../../src/server/services/licensing";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: npx deal-room skill:deactivate [options]

Deactivate a skill license on this machine.

Options:
  --license-key=KEY    License key to deactivate (LIC-XXXX-XXXX-XXXX-XXXX)
  --customer-id=ID     Customer ID (required)
  --help, -h           Show this help message

Examples:
  npx deal-room skill:deactivate --license-key=LIC-1234-5678-ABCD-EF00 --customer-id=cust_123
`);
    process.exit(0);
  }

  // Parse arguments
  const licenseKeyArg = args.find((a) => a.startsWith("--license-key="));
  const customerIdArg = args.find((a) => a.startsWith("--customer-id="));

  if (!licenseKeyArg) {
    console.error("Error: --license-key is required");
    process.exit(1);
  }

  if (!customerIdArg) {
    console.error("Error: --customer-id is required");
    process.exit(1);
  }

  const licenseKey = licenseKeyArg.split("=")[1];
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
  console.log(`Deactivating license: ${licenseKey}`);
  console.log("");

  const result = await deactivateLicense(licenseKey, customerId);

  if (!result.success) {
    console.error(`Deactivation failed: ${result.error}`);
    process.exit(1);
  }

  console.log("Deactivation successful!");
  console.log("This machine's activation slot has been freed.");
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
