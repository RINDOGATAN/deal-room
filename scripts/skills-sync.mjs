#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Skills drift guard.
 *
 * The skills/ directory is a frozen, baked copy of the upstream legalskills
 * repo — nothing at runtime records WHICH upstream state it was baked from
 * (provenance today is a flat version "1.0"). This script makes drift
 * visible:
 *
 *   manifest  — walk SKILLS_DIR and write a checksum manifest: per skill,
 *               per file (sorted, relative paths) sha256 of content, plus an
 *               aggregate digest per skill and for the whole set.
 *   diff      — compare local skills/ against a ref (a legalskills checkout
 *               directory, computed on the fly, or a previously written
 *               manifest file) and print added/removed/changed files.
 *
 * Run:
 *   node scripts/skills-sync.mjs manifest [--dir skills] [--out skills/manifest.sha256.json]
 *   node scripts/skills-sync.mjs diff --ref <path-to-checkout-or-manifest> [--dir skills]
 *
 * Exits 0 when clean, 1 on drift (diff mode), 2 on usage/IO errors.
 * Skips dirs starting with `_` or `.` (same scope as check-skills.mjs).
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, resolve, dirname, sep } from "node:path";

const MANIFEST_VERSION = 1;

// ── CLI parsing ───────────────────────────────────────────────────────────

const [, , command, ...rest] = process.argv;

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) usage(`unexpected argument: ${a}`);
    const key = a.slice(2);
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) usage(`missing value for --${key}`);
    flags[key] = value;
    i++;
  }
  return flags;
}

function usage(msg) {
  if (msg) console.error(`✖ ${msg}\n`);
  console.error(
    [
      "Usage:",
      "  node scripts/skills-sync.mjs manifest [--dir skills] [--out skills/manifest.sha256.json]",
      "  node scripts/skills-sync.mjs diff --ref <path-to-checkout-or-manifest> [--dir skills]",
    ].join("\n"),
  );
  process.exit(2);
}

// ── Hashing ───────────────────────────────────────────────────────────────

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

// Same heuristic as check-skills.mjs / the seed loader: a skill dir contains
// at least one of these files. Keeps manifest scope identical to what the
// app actually bakes and seeds.
const SKILL_MARKER_FILES = ["clauses.json", "metadata.json", "boilerplate.json", "SKILL.md"];

/** Skill dirs: direct children of root, skipping `_template`, `.git` etc. */
function listSkillDirs(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) return null;
  return readdirSync(root)
    .filter((entry) => {
      if (entry.startsWith("_") || entry.startsWith(".")) return false;
      const full = join(root, entry);
      if (!statSync(full).isDirectory()) return false;
      return SKILL_MARKER_FILES.some((f) => existsSync(join(full, f)));
    })
    .sort();
}

/** Recursively list files under dir (skipping dot-entries), as sorted posix-relative paths. */
function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir).sort()) {
    if (entry.startsWith(".")) continue; // .DS_Store and friends
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listFiles(full, base));
    } else if (st.isFile()) {
      out.push(relative(base, full).split(sep).join("/"));
    }
  }
  return out.sort();
}

/**
 * Build the manifest object for a skills root.
 * Aggregate digests are computed over `path:hash\n` lines in sorted order,
 * so they are stable across platforms and re-runs.
 */
function buildManifest(root) {
  const skillDirs = listSkillDirs(root);
  if (skillDirs === null) {
    console.error(`✖ skills dir does not exist: ${root}`);
    process.exit(2);
  }

  const skills = {};
  const setHash = createHash("sha256");
  for (const skill of skillDirs) {
    const dir = join(root, skill);
    const files = {};
    const skillHash = createHash("sha256");
    for (const rel of listFiles(dir)) {
      const digest = sha256(readFileSync(join(dir, rel)));
      files[rel] = digest;
      skillHash.update(`${rel}:${digest}\n`);
    }
    const digest = skillHash.digest("hex");
    skills[skill] = { digest, files };
    setHash.update(`${skill}:${digest}\n`);
  }

  return {
    version: MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    skills,
    digest: setHash.digest("hex"),
  };
}

/** Load a ref: a manifest JSON file, or a directory (checkout) hashed on the fly. */
function loadRef(refPath) {
  const abs = resolve(refPath);
  if (!existsSync(abs)) {
    console.error(`✖ --ref path does not exist: ${abs}`);
    process.exit(2);
  }
  if (statSync(abs).isFile()) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(abs, "utf8"));
    } catch (e) {
      console.error(`✖ --ref is not valid manifest JSON: ${e.message}`);
      process.exit(2);
    }
    if (!parsed || typeof parsed.skills !== "object") {
      console.error(`✖ --ref file does not look like a skills manifest (no "skills" key)`);
      process.exit(2);
    }
    return { manifest: parsed, label: `manifest ${abs}` };
  }
  // Directory ref. Convenience: a legalskills checkout may keep skills in a
  // skills/ subdir — use it when the root itself contains no skill dirs.
  let root = abs;
  const direct = listSkillDirs(abs) ?? [];
  const nested = join(abs, "skills");
  if (direct.length === 0 && existsSync(nested) && statSync(nested).isDirectory()) {
    root = nested;
  }
  return { manifest: buildManifest(root), label: `directory ${root}` };
}

// ── Commands ──────────────────────────────────────────────────────────────

function cmdManifest(flags) {
  const dir = resolve(flags.dir ?? "skills");
  const out = resolve(flags.out ?? join(dir, "manifest.sha256.json"));
  const manifest = buildManifest(dir);

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");

  const skillNames = Object.keys(manifest.skills);
  const fileCount = skillNames.reduce(
    (n, s) => n + Object.keys(manifest.skills[s].files).length,
    0,
  );
  console.log(`Hashed ${skillNames.length} skill(s), ${fileCount} file(s) in ${dir}`);
  for (const s of skillNames) {
    console.log(`  ${s}: ${manifest.skills[s].digest.slice(0, 12)}… (${Object.keys(manifest.skills[s].files).length} files)`);
  }
  console.log(`\nSet digest: ${manifest.digest}`);
  console.log(`✔ Manifest written to ${out}`);
  process.exit(0);
}

function cmdDiff(flags) {
  if (!flags.ref) usage("diff requires --ref <path-to-checkout-or-manifest>");
  const dir = resolve(flags.dir ?? "skills");
  const local = buildManifest(dir);
  const { manifest: ref, label } = loadRef(flags.ref);

  console.log(`Comparing ${dir}\n  against ${label}\n`);

  if (local.digest === ref.digest) {
    const skillCount = Object.keys(local.skills).length;
    console.log(`✔ No drift — ${skillCount} skill(s) match (set digest ${local.digest.slice(0, 12)}…)`);
    process.exit(0);
  }

  let drift = 0;
  const localSkills = Object.keys(local.skills);
  const refSkills = Object.keys(ref.skills);

  for (const s of refSkills.filter((s) => !localSkills.includes(s))) {
    drift++;
    console.error(`✖ ${s}: skill missing locally (present in ref)`);
  }
  for (const s of localSkills.filter((s) => !refSkills.includes(s))) {
    drift++;
    console.error(`✖ ${s}: skill only exists locally (not in ref)`);
  }

  for (const s of localSkills.filter((s) => refSkills.includes(s))) {
    const lf = local.skills[s].files;
    const rf = ref.skills[s].files;
    if (local.skills[s].digest === ref.skills[s].digest) continue;

    for (const f of Object.keys(rf).filter((f) => !(f in lf))) {
      drift++;
      console.error(`✖ ${s}: removed  ${f}`);
    }
    for (const f of Object.keys(lf).filter((f) => !(f in rf))) {
      drift++;
      console.error(`✖ ${s}: added    ${f}`);
    }
    for (const f of Object.keys(lf).filter((f) => f in rf && lf[f] !== rf[f])) {
      drift++;
      console.error(`✖ ${s}: changed  ${f}`);
    }
  }

  console.error(`\n✖ Drift detected: ${drift} difference(s)`);
  process.exit(1);
}

// ── Main ──────────────────────────────────────────────────────────────────

if (command === "manifest") {
  cmdManifest(parseFlags(rest));
} else if (command === "diff") {
  cmdDiff(parseFlags(rest));
} else {
  usage(command ? `unknown command: ${command}` : "missing command");
}
