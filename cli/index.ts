#!/usr/bin/env npx tsx
/**
 * Deal Room CLI
 *
 * Unified CLI for skill and license management.
 *
 * Usage:
 *   npx deal-room <command> [options]
 *
 * Commands:
 *   skill:install     Install a skill package
 *   skill:list        List installed skill packages
 *   skill:verify      Verify a skill package
 *   skill:activate    Activate a skill license
 *   skill:deactivate  Deactivate a skill license
 *   license:fingerprint  Show machine fingerprint
 */

import { spawn } from "child_process";
import * as path from "path";

const COMMANDS: Record<string, string> = {
  "skill:install": "skill-install.ts",
  "skill:list": "skill-list.ts",
  "skill:verify": "skill-verify.ts",
  "skill:activate": "skill-activate.ts",
  "skill:deactivate": "skill-deactivate.ts",
  "license:fingerprint": "license-fingerprint.ts",
};

function showHelp() {
  console.log(`
Deal Room CLI

Usage: npx deal-room <command> [options]

Commands:
  skill:install         Install a skill package (.skill file or directory)
  skill:list            List installed skill packages
  skill:verify          Verify a skill package signature and content
  skill:activate        Activate a skill license on this machine
  skill:deactivate      Deactivate a skill license on this machine
  license:fingerprint   Show machine fingerprint for offline activation

Options:
  --help, -h            Show help for a command

Examples:
  npx deal-room skill:install ./nda.skill
  npx deal-room skill:list
  npx deal-room skill:activate --license-key=LIC-XXXX-XXXX-XXXX-XXXX --customer-id=cust_123
  npx deal-room license:fingerprint

Run 'npx deal-room <command> --help' for more information on a specific command.
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    showHelp();
    process.exit(0);
  }

  const command = args[0];
  const commandFile = COMMANDS[command];

  if (!commandFile) {
    console.error(`Unknown command: ${command}`);
    console.error("");
    console.error("Run 'npx deal-room --help' for a list of available commands.");
    process.exit(1);
  }

  const commandPath = path.join(__dirname, "commands", commandFile);
  const commandArgs = args.slice(1);

  // Execute the command using tsx
  const child = spawn("npx", ["tsx", commandPath, ...commandArgs], {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });

  child.on("error", (error) => {
    console.error(`Failed to execute command: ${error.message}`);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
