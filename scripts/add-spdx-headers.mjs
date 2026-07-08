#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC
//
// add-spdx-headers.mjs — add an SPDX licence header to every source file that
// lacks one. Idempotent: files that already contain an SPDX-License-Identifier
// in their first lines are left untouched. Preserves shebangs and React
// "use client" / "use server" directives (the header is inserted AFTER them so
// the directive stays the first executable statement).
//
// Usage:  node scripts/add-spdx-headers.mjs [--check] [root ...]
//   --check   exit 1 if any file WOULD be changed (for CI); writes nothing.
//   root ...  directories to sweep (default: src scripts prisma).
//
// No dependencies; Node >= 18.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

const SPDX = "AGPL-3.0-or-later";
const COPYRIGHT = "Copyright (C) 2025-2026 Rindogatan LLC";
const HEADER = [`// SPDX-License-Identifier: ${SPDX}`, `// ${COPYRIGHT}`];

const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build", "out", "coverage",
  ".vercel", ".turbo", "generated", "migrations",
]);
const DIRECTIVE = /^["'](use client|use server|use strict)["'];?\s*$/;

const args = process.argv.slice(2);
const check = args.includes("--check");
const roots = args.filter((a) => !a.startsWith("--"));
const targets = roots.length ? roots : ["src", "scripts", "prisma"];

/** @param {string} dir @param {string[]} out */
function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(p, out);
    } else if (e.isFile()) {
      if (e.name.endsWith(".d.ts")) continue;
      if (EXTS.has(extname(e.name))) out.push(p);
    }
  }
}

function hasSpdx(text) {
  // look only at the first ~8 non-empty lines
  const head = text.split("\n", 8).join("\n");
  return head.includes("SPDX-License-Identifier");
}

function insert(text) {
  const nl = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  let i = 0;
  if (lines[0] && lines[0].startsWith("#!")) i = 1;
  if (lines[i] && DIRECTIVE.test(lines[i].trim())) i = i + 1;
  const before = lines.slice(0, i);
  const after = lines.slice(i);
  const block = [...HEADER];
  // one blank line between header and following code, unless already blank
  if (after.length && after[0].trim() !== "") block.push("");
  const merged = [...before, ...block, ...after];
  return merged.join(nl);
}

const files = [];
for (const t of targets) walk(t, files);

let changed = 0;
const changedList = [];
for (const f of files) {
  const text = readFileSync(f, "utf8");
  if (hasSpdx(text)) continue;
  changed++;
  changedList.push(f);
  if (!check) writeFileSync(f, insert(text));
}

const verb = check ? "would add header to" : "added header to";
console.log(`${verb} ${changed} file(s); ${files.length} scanned.`);
if (check && changed > 0) {
  for (const f of changedList.slice(0, 50)) console.log("  " + f);
  process.exit(1);
}
