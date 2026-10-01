// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Owner, 2026-10-01: Dealroom is fully rolled out, so the hosted caution
 * (no contractual safeguards; do not enter privileged or confidential
 * information) is gone from every screen, the pricing page and llms.txt.
 * The Terms of Service and Privacy Policy are hosted elsewhere and are
 * not touched here.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../../../..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const FILES = [
  "src/messages/en.json",
  "src/messages/es.json",
  "src/landing/i18n/en/startups-auth.json",
  "src/landing/i18n/es/startups-auth.json",
  "public/llms.txt",
  "README.md",
];

describe("hosted caution", () => {
  it.each(FILES)("is absent from %s", (rel) => {
    const text = read(rel);
    expect(text).not.toMatch(/no contractual safeguards/i);
    expect(text).not.toMatch(/privileged or confidential information/i);
    expect(text).not.toMatch(/garantías contractuales/i);
    expect(text).not.toMatch(/información privilegiada o confidencial/i);
  });

  it("has no component left to render it", () => {
    expect(read("src/components/pilot/PilotNotice.tsx")).not.toContain("HostedCaution");
    expect(read("src/app/(dashboard)/layout.tsx")).not.toContain("PilotBanner");
  });
});
