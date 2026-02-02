#!/usr/bin/env npx tsx
/**
 * CLI Command: license:fingerprint
 *
 * Display or generate machine fingerprint for offline activation.
 *
 * Usage:
 *   npx deal-room license:fingerprint
 *   npx deal-room license:fingerprint --json
 *   npx deal-room license:fingerprint --request --skill-id=com.nel.skills.nda --customer-id=cust_123
 */

import { prisma } from "../../src/lib/prisma";
import {
  getMachineInfo,
  getDisplayFingerprint,
  getFingerprintData,
  generateFingerprintRequest,
} from "../../src/server/services/licensing";
import * as fs from "fs";

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");
  const generateRequest = args.includes("--request");

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: npx deal-room license:fingerprint [options]

Display or generate machine fingerprint for offline license activation.

Options:
  --json              Output fingerprint data as JSON
  --request           Generate a license request file
  --skill-id=ID       Skill ID for license request (required with --request)
  --customer-id=ID    Customer ID for license request (required with --request)
  --output=PATH       Output file path for request (default: license-request.json)
  --help, -h          Show this help message

Examples:
  npx deal-room license:fingerprint
  npx deal-room license:fingerprint --json
  npx deal-room license:fingerprint --request --skill-id=com.nel.skills.nda --customer-id=cust_123
`);
    process.exit(0);
  }

  if (generateRequest) {
    const skillIdArg = args.find((a) => a.startsWith("--skill-id="));
    const customerIdArg = args.find((a) => a.startsWith("--customer-id="));
    const outputArg = args.find((a) => a.startsWith("--output="));

    if (!skillIdArg) {
      console.error("Error: --skill-id is required with --request");
      process.exit(1);
    }

    if (!customerIdArg) {
      console.error("Error: --customer-id is required with --request");
      process.exit(1);
    }

    const skillId = skillIdArg.split("=")[1];
    const customerId = customerIdArg.split("=")[1];
    const outputPath = outputArg
      ? outputArg.split("=")[1]
      : "license-request.json";

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      console.error(`Error: Customer not found: ${customerId}`);
      process.exit(1);
    }

    const request = generateFingerprintRequest(customerId, skillId);
    fs.writeFileSync(outputPath, request);

    console.log(`License request generated: ${outputPath}`);
    console.log("");
    console.log(
      "Send this file to your license administrator to receive an offline license."
    );

    await prisma.$disconnect();
    return;
  }

  if (jsonOutput) {
    const data = getFingerprintData();
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  const info = getMachineInfo();
  const displayFingerprint = getDisplayFingerprint();

  console.log("\nMachine Information:");
  console.log("=".repeat(50));
  console.log(`Hostname:     ${info.hostname}`);
  console.log(`Platform:     ${info.platform}`);
  console.log(`MAC Address:  ${info.macAddress}`);
  console.log(`Instance ID:  ${info.instanceId}`);
  console.log("");
  console.log("Machine Fingerprint (for license activation):");
  console.log("=".repeat(50));
  console.log(`  ${displayFingerprint}`);
  console.log("");
  console.log(
    "Provide this fingerprint to your license administrator for offline activation."
  );
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
