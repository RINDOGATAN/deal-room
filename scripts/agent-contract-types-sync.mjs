#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Refreshes `src/lib/agent-contract-types.json`: what each contract type
 * needs from an agent (governing laws, languages, roles and the required
 * inputs), as the public endpoint GET /api/v1/agent/contract-types reports
 * it. The guide pages, the MCP server card, the agent card and
 * llms-full.txt are prerendered from this file, so they show the same
 * codes and inputs as the one call accepts without reading the database
 * at build time.
 *
 * Only the public, keyless facts are kept (ids, types, options, defaults),
 * never clause text, so the premium skills stay in their own repository.
 *
 *   node scripts/agent-contract-types-sync.mjs            # from dealroom.todo.law
 *   node scripts/agent-contract-types-sync.mjs http://localhost:3000
 *
 * The test `src/lib/__tests__/agent-discovery.test.ts` checks the file
 * against the built-in skills of this repository and the guide list.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const base = (process.argv[2] || "https://dealroom.todo.law").replace(/\/$/, "");
const url = `${base}/api/v1/agent/contract-types`;

const res = await fetch(url, { headers: { Accept: "application/json" } });
if (!res.ok) {
  console.error(`GET ${url} answered ${res.status}`);
  process.exit(1);
}
const { contractTypes } = await res.json();

const out = contractTypes
  .filter((t) => t.slug)
  .map((t) => ({
    contractType: t.contractType,
    slug: t.slug,
    governingLaws: t.governingLaws,
    languages: t.languages,
    roles: t.roles ?? null,
    requiredInputs: t.inputs
      .filter((i) => i.required)
      .map((i) => ({
        id: i.id,
        type: i.type,
        ...(i.options?.length ? { options: i.options } : {}),
        ...(i.default !== undefined && i.default !== "" ? { default: i.default } : {}),
        ...(i.onlyUnder?.length ? { onlyUnder: i.onlyUnder } : {}),
      })),
  }))
  .sort((a, b) => a.contractType.localeCompare(b.contractType));

const file = join(process.cwd(), "src", "lib", "agent-contract-types.json");
writeFileSync(file, `${JSON.stringify({ source: "/api/v1/agent/contract-types", contractTypes: out }, null, 2)}\n`);
console.log(`Wrote ${out.length} contract types to ${file}`);
