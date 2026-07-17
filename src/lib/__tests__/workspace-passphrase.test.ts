// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import { verifyWorkspacePassphrase } from "@/lib/workspace-passphrase";

describe("verifyWorkspacePassphrase", () => {
  it("accepts the exact passphrase", () => {
    expect(verifyWorkspacePassphrase("correct horse", "correct horse")).toBe(true);
  });

  it("rejects a wrong passphrase of the same length", () => {
    expect(verifyWorkspacePassphrase("correct horsf", "correct horse")).toBe(false);
  });

  it("rejects a wrong passphrase of a different length (timingSafeEqual precondition)", () => {
    expect(verifyWorkspacePassphrase("short", "correct horse")).toBe(false);
    expect(verifyWorkspacePassphrase("much much longer than required", "correct horse")).toBe(false);
  });

  it("rejects a missing or empty input when a passphrase is required", () => {
    expect(verifyWorkspacePassphrase(undefined, "correct horse")).toBe(false);
    expect(verifyWorkspacePassphrase(null, "correct horse")).toBe(false);
    expect(verifyWorkspacePassphrase("", "correct horse")).toBe(false);
  });

  it("passes everything when no passphrase is configured (no lockout on update)", () => {
    expect(verifyWorkspacePassphrase(undefined, "")).toBe(true);
    expect(verifyWorkspacePassphrase("", "")).toBe(true);
    expect(verifyWorkspacePassphrase("anything", "")).toBe(true);
  });

  it("compares multi-byte characters by bytes, not code points", () => {
    expect(verifyWorkspacePassphrase("señal-única", "señal-única")).toBe(true);
    expect(verifyWorkspacePassphrase("senal-unica", "señal-única")).toBe(false);
  });
});
