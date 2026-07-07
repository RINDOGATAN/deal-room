// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import { isTerminalStatus } from "@/server/services/deal/mutability";

describe("isTerminalStatus", () => {
  it("treats COMPLETED as terminal", () => {
    expect(isTerminalStatus("COMPLETED")).toBe(true);
  });
  it("treats CANCELLED as terminal", () => {
    expect(isTerminalStatus("CANCELLED")).toBe(true);
  });
  it.each(["DRAFT", "AWAITING_RESPONSE", "NEGOTIATING", "AGREED", "SIGNING"] as const)(
    "%s is not terminal",
    (status) => {
      expect(isTerminalStatus(status)).toBe(false);
    },
  );
});
