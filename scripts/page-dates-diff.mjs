#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The public pages whose date in `src/lib/page-dates.json` changed between
 * a previous commit and the working tree, one path per line. Used after a
 * production deploy to ping IndexNow for those pages only.
 *
 *   node scripts/page-dates-diff.mjs <previous-sha>
 *
 * A previous commit without the file counts as "no dates", so every dated
 * page is listed once.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const FILE = "src/lib/page-dates.json";

/** Paths that are new or whose date differs; removed pages are not listed. */
export function changedPaths(previous, current) {
  return Object.keys(current)
    .filter((path) => /^\/[a-z0-9/-]*$/.test(path) && current[path] !== previous[path])
    .sort();
}

function readAt(sha) {
  try {
    return JSON.parse(execFileSync("git", ["show", `${sha}:${FILE}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return {};
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sha = process.argv[2];
  if (!sha || !/^[0-9a-f]{7,40}$/.test(sha)) {
    console.error("usage: node scripts/page-dates-diff.mjs <previous-sha>");
    process.exit(2);
  }
  const current = JSON.parse(readFileSync(FILE, "utf8"));
  for (const path of changedPaths(readAt(sha), current)) console.log(path);
}
