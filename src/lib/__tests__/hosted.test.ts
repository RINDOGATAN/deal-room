// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Which builds are the hosted service (the kit never is).
 */
import { describe, it, expect } from "vitest";
import { isHostedEnv } from "@/lib/hosted";

describe("isHostedEnv", () => {
  it("is the hosted service on Vercel production (same signal as the auth guards)", () => {
    expect(isHostedEnv({ VERCEL_ENV: "production" })).toBe(true);
  });

  it("is the hosted service with an explicit hosted cookie domain", () => {
    expect(isHostedEnv({ AUTH_COOKIE_DOMAIN: ".todo.law" })).toBe(true);
  });

  it("is the hosted service when the build-time flag says so (browser bundle)", () => {
    expect(isHostedEnv({ NEXT_PUBLIC_HOSTED_PILOT: "true" })).toBe(true);
  });

  it("is not the hosted service on the kit: local auth, host-only cookie, no Vercel", () => {
    expect(
      isHostedEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_LOCAL_AUTH_ENABLED: "true",
        AUTH_COOKIE_DOMAIN: "",
        NEXT_PUBLIC_HOSTED_PILOT: "false",
      }),
    ).toBe(false);
  });

  it("is not the hosted service on a production build that merely lacks AUTH_COOKIE_DOMAIN", () => {
    expect(isHostedEnv({ NODE_ENV: "production" })).toBe(false);
  });

  it("is not the hosted service on Vercel previews or in development", () => {
    expect(isHostedEnv({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isHostedEnv({ NODE_ENV: "development" })).toBe(false);
  });
});
