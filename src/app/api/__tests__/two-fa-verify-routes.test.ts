// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Security regression tests for the 2FA gate-cookie routes.
 *
 * These routes issue the `*_2fa_verified` cookies that middleware.ts trusts to
 * admit /admin and /supervise. They must NEVER issue the cookie without a TOTP
 * code that verifies server-side against the stored secret — otherwise any
 * holder of a stolen first-factor session can mint the second-factor gate.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as OTPAuth from "otpauth";
import { NextRequest } from "next/server";

// --- Mocks -----------------------------------------------------------------

const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/auth-admin", () => ({ adminAuthOptions: {} }));

const mockJwtDecode = vi.fn();
vi.mock("next-auth/jwt", () => ({
  decode: (...args: unknown[]) => mockJwtDecode(...args),
}));

const mockCookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mockCookieGet }),
}));

const mockPlatformAdminFindUnique = vi.fn();
const mockSupervisorFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    platformAdmin: { findUnique: (...args: unknown[]) => mockPlatformAdminFindUnique(...args) },
    supervisor: { findUnique: (...args: unknown[]) => mockSupervisorFindUnique(...args) },
  },
}));

import { POST as adminVerifyPOST } from "@/app/api/platform-admin-2fa-verify/route";
import { POST as supervisorVerifyPOST } from "@/app/api/supervisor-2fa-verify/route";

// --- Helpers -----------------------------------------------------------------

const SECRET = new OTPAuth.Secret().base32;

function validCode(): string {
  return new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(SECRET),
  }).generate();
}

function wrongCode(): string {
  // A code one greater (mod 10^6) than the currently valid one.
  return String((Number(validCode()) + 1) % 1_000_000).padStart(6, "0");
}

function post(path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function gateCookie(res: Response, name: string): string | undefined {
  return res.headers.get("set-cookie")?.includes(name)
    ? res.headers.get("set-cookie") ?? undefined
    : undefined;
}

// --- Platform admin ----------------------------------------------------------

describe("platform-admin-2fa-verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { email: "admin@example.test" } });
    mockPlatformAdminFindUnique.mockResolvedValue({
      id: "admin1",
      isActive: true,
      twoFactorSecret: { secret: SECRET, verified: true },
    });
  });

  it("rejects a request without a code and does not set the gate cookie", async () => {
    const res = await adminVerifyPOST(post("/api/platform-admin-2fa-verify", { verified: true }));
    expect(res.status).toBe(400);
    expect(gateCookie(res, "platform_admin_2fa_verified")).toBeUndefined();
  });

  it("rejects an empty body and does not set the gate cookie", async () => {
    const res = await adminVerifyPOST(post("/api/platform-admin-2fa-verify"));
    expect(res.status).toBe(400);
    expect(gateCookie(res, "platform_admin_2fa_verified")).toBeUndefined();
  });

  it("rejects a wrong code and does not set the gate cookie", async () => {
    const res = await adminVerifyPOST(post("/api/platform-admin-2fa-verify", { code: wrongCode() }));
    expect(res.status).toBe(401);
    expect(gateCookie(res, "platform_admin_2fa_verified")).toBeUndefined();
  });

  it("accepts a valid code and sets the gate cookie", async () => {
    const res = await adminVerifyPOST(post("/api/platform-admin-2fa-verify", { code: validCode() }));
    expect(res.status).toBe(200);
    expect(gateCookie(res, "platform_admin_2fa_verified")).toBeDefined();
  });
});

// --- Supervisor ----------------------------------------------------------------

describe("supervisor-2fa-verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieGet.mockReturnValue({ value: "supervisor-session-token" });
    mockJwtDecode.mockResolvedValue({ supervisorId: "sup1" });
    mockSupervisorFindUnique.mockResolvedValue({
      id: "sup1",
      isActive: true,
      twoFactorSecret: { secret: SECRET, verified: true },
    });
  });

  it("rejects a request without a code and does not set the gate cookie", async () => {
    const res = await supervisorVerifyPOST(post("/api/supervisor-2fa-verify", { verified: true }));
    expect(res.status).toBe(400);
    expect(gateCookie(res, "supervisor_2fa_verified")).toBeUndefined();
  });

  it("rejects an empty body and does not set the gate cookie", async () => {
    const res = await supervisorVerifyPOST(post("/api/supervisor-2fa-verify"));
    expect(res.status).toBe(400);
    expect(gateCookie(res, "supervisor_2fa_verified")).toBeUndefined();
  });

  it("rejects a wrong code and does not set the gate cookie", async () => {
    const res = await supervisorVerifyPOST(post("/api/supervisor-2fa-verify", { code: wrongCode() }));
    expect(res.status).toBe(401);
    expect(gateCookie(res, "supervisor_2fa_verified")).toBeUndefined();
  });

  it("accepts a valid code and sets the gate cookie", async () => {
    const res = await supervisorVerifyPOST(post("/api/supervisor-2fa-verify", { code: validCode() }));
    expect(res.status).toBe(200);
    expect(gateCookie(res, "supervisor_2fa_verified")).toBeDefined();
  });
});
