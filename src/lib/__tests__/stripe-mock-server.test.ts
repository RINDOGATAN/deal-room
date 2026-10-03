// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, it, expect } from "vitest";
import { stripeMockServer } from "@/lib/stripe";

describe("stripeMockServer", () => {
  it("points a test-mode client at the mock server", () => {
    expect(
      stripeMockServer({ STRIPE_MOCK_URL: "http://localhost:12111", STRIPE_SECRET_KEY: "sk_test_x" }),
    ).toEqual({ host: "localhost", port: 12111, protocol: "http" });
  });

  it("never redirects a live key", () => {
    expect(
      stripeMockServer({ STRIPE_MOCK_URL: "http://localhost:12111", STRIPE_SECRET_KEY: "sk_live_x" }),
    ).toEqual({});
    expect(
      stripeMockServer({ STRIPE_MOCK_URL: "http://localhost:12111", STRIPE_SECRET_KEY: "rk_live_x" }),
    ).toEqual({});
  });

  it("does nothing without STRIPE_MOCK_URL", () => {
    expect(stripeMockServer({ STRIPE_SECRET_KEY: "sk_test_x" })).toEqual({});
  });
});
