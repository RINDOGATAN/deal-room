// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Print every colour pair the product uses with its measured contrast ratio.
 *
 *   npm run report:contrast
 *
 * The same pairs are asserted by src/lib/__tests__/status-colors.test.ts; this
 * is for reading the numbers, for a review or an accessibility statement.
 */
import { measuredPairs } from "../src/lib/status-colors";

const pairs = measuredPairs();
const width = Math.max(...pairs.map((p) => p.name.length));

for (const p of pairs) {
  const mark = p.passes ? "ok  " : "FAIL";
  console.log(
    `${mark} ${p.name.padEnd(width)}  ${p.foreground} on ${p.background}  ${p.ratio.toFixed(2)}:1 (needs ${p.minimum}:1)`,
  );
}

const failed = pairs.filter((p) => !p.passes);
console.log(`\n${pairs.length} pairs, ${failed.length} below threshold`);
process.exit(failed.length === 0 ? 0 : 1);
