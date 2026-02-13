#!/usr/bin/env npx tsx
/**
 * CLI Command: keygen
 *
 * Generate an Ed25519 key pair for signing skill packages.
 *
 * Usage:
 *   npx deal-room keygen
 *   npx deal-room keygen --out ./keys
 */

import { generateEd25519KeyPair } from "../../src/lib/crypto";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: npx deal-room keygen [options]

Generate an Ed25519 key pair for signing skill packages.

Options:
  --out <dir>     Output directory (default: current directory)
  --help, -h      Show this help message

Output:
  private.pem     Private key (keep secret, use as SKILL_SIGNING_PRIVATE_KEY)
  public.pem      Public key (embed in application or set as SKILL_SIGNING_PUBLIC_KEY)
`);
    process.exit(0);
  }

  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 && args[outIdx + 1] ? args[outIdx + 1] : ".";
  const resolvedDir = path.resolve(outDir);

  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  console.log("Generating Ed25519 key pair...\n");

  const { publicKey, privateKey } = generateEd25519KeyPair();

  const privatePath = path.join(resolvedDir, "private.pem");
  const publicPath = path.join(resolvedDir, "public.pem");

  // Safety check: don't overwrite existing keys
  if (fs.existsSync(privatePath)) {
    console.error(`Error: ${privatePath} already exists. Remove it first or use a different --out directory.`);
    process.exit(1);
  }

  fs.writeFileSync(privatePath, privateKey, { mode: 0o600 });
  fs.writeFileSync(publicPath, publicKey);

  console.log(`Private key: ${privatePath}`);
  console.log(`Public key:  ${publicPath}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Store the private key as a GitHub secret (SKILL_SIGNING_PRIVATE_KEY)");
  console.log("  2. Set SKILL_SIGNING_PUBLIC_KEY env var or replace the placeholder in src/lib/crypto.ts");
  console.log("");
  console.log("Public key PEM (for embedding):");
  console.log(publicKey.trim());
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
