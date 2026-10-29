#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Writes `src/lib/page-dates.json`: for each public contract page, the date
 * of the last commit that changed the content behind it. The sitemap reads
 * this file for `<lastmod>`; IndexNow pings only the pages whose date moved
 * (scripts/page-dates-diff.mjs).
 *
 * Why a committed file and not `git log` inside `next build`: the hosted
 * build runs from a shallow clone, where `git log` returns the clone's tip
 * for every file (or nothing), which is neither accurate nor stable. This
 * script runs on a full clone instead, and CI checks on every pull request
 * that the committed file matches the history (`--check`).
 *
 * Sources per page (date = the newest author date among them):
 *   /contracts/<slug>, /es/contracts/<slug>
 *       content/contracts/<slug>.<locale>.md, plus the contract's skill
 *       folder when the skill lives in this repository (skills/ or
 *       prisma/hosted-skills/; matched on metadata.json contractType).
 *       Skills kept outside this repository count through the page only.
 *   /contracts, /es/contracts
 *       every content/contracts/*.<locale>.md (the index lists their
 *       headings and descriptions).
 * Pages with no committed source get no date rather than a guessed one.
 *
 *   node scripts/page-dates.mjs          # rewrite the file
 *   node scripts/page-dates.mjs --check  # exit 1 when the file is stale
 *
 * Commit content changes first, then run this and commit the result.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const CONTENT = "content/contracts";
export const OUT = "src/lib/page-dates.json";
const SKILL_ROOTS = ["skills", "prisma/hosted-skills"];

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

/** contractType → skill folder, for skills kept in this repository. */
function skillFolders() {
  const out = {};
  for (const root of SKILL_ROOTS) {
    if (!existsSync(join(ROOT, root))) continue;
    for (const dir of readdirSync(join(ROOT, root), { withFileTypes: true })) {
      const meta = join(ROOT, root, dir.name, "metadata.json");
      if (!dir.isDirectory() || !existsSync(meta)) continue;
      const type = JSON.parse(readFileSync(meta, "utf8")).contractType;
      if (typeof type === "string") out[type] = `${root}/${dir.name}`;
    }
  }
  return out;
}

function contractTypeOf(file) {
  const m = readFileSync(join(ROOT, file), "utf8").match(/^contractType:\s*"([^"]+)"/m);
  return m ? m[1] : null;
}

/** URL path → the repository paths whose history dates it. */
export function pageSources() {
  const skills = skillFolders();
  const files = readdirSync(join(ROOT, CONTENT))
    .filter((f) => /^.+\.(en|es)\.md$/.test(f))
    .sort();
  const sources = {};
  const index = { en: [], es: [] };
  for (const file of files) {
    const [, slug, locale] = file.match(/^(.+)\.(en|es)\.md$/);
    const rel = `${CONTENT}/${file}`;
    const base = locale === "es" ? "/es/contracts" : "/contracts";
    const skill = skills[contractTypeOf(rel)];
    sources[`${base}/${slug}`] = skill ? [rel, skill] : [rel];
    index[locale].push(rel);
  }
  sources["/contracts"] = index.en;
  sources["/es/contracts"] = index.es;
  return sources;
}

/**
 * Newest author date (UTC ISO) of the given paths, or null when none is
 * committed. Merge commits are skipped: the date is that of the commit that
 * made the change, so it is the same on a branch, on main after the merge,
 * and on the merge ref CI checks out.
 */
function lastChange(paths) {
  const out = git(["log", "-1", "--no-merges", "--format=%aI", "--", ...paths]);
  return out ? new Date(out).toISOString() : null;
}

export function computeDates() {
  if (git(["rev-parse", "--is-shallow-repository"]) === "true") {
    throw new Error("page-dates: this clone is shallow; fetch the full history first (git fetch --unshallow)");
  }
  const sources = pageSources();
  const all = [...new Set(Object.values(sources).flat())];
  const dirty = git(["status", "--porcelain", "--", ...all]);
  if (dirty) {
    throw new Error(`page-dates: commit these changes first, then run again:\n${dirty}`);
  }
  const dates = {};
  for (const path of Object.keys(sources).sort()) {
    const date = lastChange(sources[path]);
    if (date) dates[path] = date;
  }
  return dates;
}

function main() {
  const check = process.argv.includes("--check");
  const dates = computeDates();
  const text = `${JSON.stringify(dates, null, 2)}\n`;
  if (!check) {
    writeFileSync(join(ROOT, OUT), text);
    console.log(`page-dates: ${Object.keys(dates).length} pages written to ${OUT}`);
    return;
  }
  const current = existsSync(join(ROOT, OUT)) ? JSON.parse(readFileSync(join(ROOT, OUT), "utf8")) : {};
  const stale = [...new Set([...Object.keys(dates), ...Object.keys(current)])]
    .filter((p) => dates[p] !== current[p])
    .map((p) => `  ${p}: file ${current[p] ?? "(none)"}, history ${dates[p] ?? "(none)"}`);
  if (stale.length) {
    console.error(`page-dates: ${OUT} is stale. Run \`npm run seo:dates\` and commit the result.\n${stale.join("\n")}`);
    process.exit(1);
  }
  console.log(`page-dates: ${OUT} matches the history (${Object.keys(dates).length} pages)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
