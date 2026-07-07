// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * ManifestSchema skillId namespace coverage.
 *
 * The manifest schema must accept skill ids in both the `com.nel.skills.*`
 * and the `com.todolaw.skills.*` namespaces, including the dotted `a2a.*`
 * sub-namespace used by the agent-to-agent skills, while still rejecting
 * ids from other namespaces or with an empty name segment.
 */
import { describe, it, expect } from "vitest";
import { ManifestSchema } from "./validator";

function manifestWithId(skillId: string) {
  return {
    skillId,
    name: "test-skill",
    displayName: "Test Skill",
    version: "1.0.0",
    jurisdictions: ["SPAIN"],
    languages: ["en"],
    files: {},
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("ManifestSchema skillId", () => {
  it("accepts the com.nel.skills.* namespace", () => {
    const result = ManifestSchema.safeParse(manifestWithId("com.nel.skills.employment"));
    expect(result.success).toBe(true);
  });

  it("accepts the com.todolaw.skills.* namespace", () => {
    const result = ManifestSchema.safeParse(manifestWithId("com.todolaw.skills.term-sheet"));
    expect(result.success).toBe(true);
  });

  it("accepts the dotted com.todolaw.skills.a2a.* sub-namespace", () => {
    const result = ManifestSchema.safeParse(
      manifestWithId("com.todolaw.skills.a2a.api-access")
    );
    expect(result.success).toBe(true);
  });

  it("rejects an unknown namespace", () => {
    const result = ManifestSchema.safeParse(manifestWithId("com.acme.skills.foo"));
    expect(result.success).toBe(false);
  });

  it("rejects an empty name segment", () => {
    const result = ManifestSchema.safeParse(manifestWithId("com.nel.skills."));
    expect(result.success).toBe(false);
  });
});
