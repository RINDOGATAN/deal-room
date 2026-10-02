// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Dealroom does not present itself as a pilot (owner's decision,
 * 2026-09-21). No string a person can read, in either language, may say
 * "pilot" or "piloto". Message KEYS are internal names and may keep the
 * word; only values are checked.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "../..");
const WORD = /pilot/i; // also matches "piloto"

/**
 * Values allowed to keep the word because it names a kind of contract a
 * customer negotiates (a pilot agreement), not Dealroom itself. Empty since
 * 2026-10-02: the landing no longer lists "Pilot Contracts", which was not a
 * contract type Dealroom offers.
 */
const ALLOWED: Record<string, string[]> = {};

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return jsonFiles(full);
    return name.endsWith(".json") ? [full] : [];
  });
}

/** Every string value in a JSON tree, with its dotted key path. */
function strings(node: unknown, prefix = ""): Array<[string, string]> {
  if (typeof node === "string") return [[prefix, node]];
  if (node && typeof node === "object") {
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
      strings(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

const files = [
  ...jsonFiles(path.join(SRC, "messages")),
  ...jsonFiles(path.join(SRC, "landing/i18n")),
];

describe("no pilot language in user-visible strings", () => {
  it("finds the message files", () => {
    const rel = files.map((f) => path.relative(SRC, f));
    expect(rel).toContain("messages/en.json");
    expect(rel).toContain("messages/es.json");
    expect(rel).toContain("landing/i18n/en/dealroom-startups.json");
    expect(rel).toContain("landing/i18n/es/startups-auth.json");
  });

  it.each(files.map((f) => [path.relative(SRC, f), f]))("%s", (rel, file) => {
    const allowed = ALLOWED[rel] ?? [];
    const offenders = strings(JSON.parse(readFileSync(file, "utf8")))
      .filter(([key, value]) => WORD.test(value) && !allowed.includes(key))
      .map(([key, value]) => `${key}: ${value}`);
    expect(offenders).toEqual([]);
  });

  it("keeps the allowance narrow: it names a contract type, not Dealroom", () => {
    for (const [rel, keys] of Object.entries(ALLOWED)) {
      const flat = new Map(strings(JSON.parse(readFileSync(path.join(SRC, rel), "utf8"))));
      for (const key of keys) {
        expect(flat.get(key)).toMatch(/Pilot Contracts|Pilotos y SOWs/);
        expect(flat.get(key)).not.toMatch(/hosted|alojado/i);
      }
    }
  });
});
