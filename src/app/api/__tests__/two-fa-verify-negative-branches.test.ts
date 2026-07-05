/**
 * Negative-branch tests for the 2FA gate-cookie routes.
 *
 * Complements two-fa-verify-routes.test.ts (missing/invalid/valid code): this
 * file pins down the first-factor and account-state branches — no session,
 * deactivated accounts, unverified 2FA enrollment, and malformed codes must
 * all be rejected WITHOUT the gate cookie ever being set and (where the check
 * precedes the DB) without touching prisma at all.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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

// Any well-formed 6-digit code; these tests never reach TOTP verification.
const WELL_FORMED_CODE = "123456";

function post(path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function hasGateCookie(res: Response, name: string): boolean {
  return res.headers.get("set-cookie")?.includes(name) ?? false;
}

// --- Platform admin ----------------------------------------------------------

describe("platform-admin-2fa-verify negative branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { email: "admin@example.test" } });
  });

  it("rejects when there is no first-factor admin session, before hitting the DB", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await adminVerifyPOST(
      post("/api/platform-admin-2fa-verify", { code: WELL_FORMED_CODE }),
    );
    expect(res.status).toBe(401);
    expect(hasGateCookie(res, "platform_admin_2fa_verified")).toBe(false);
    expect(mockPlatformAdminFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a non-6-digit code before hitting the DB", async () => {
    const res = await adminVerifyPOST(
      post("/api/platform-admin-2fa-verify", { code: "12345" }),
    );
    expect(res.status).toBe(400);
    expect(hasGateCookie(res, "platform_admin_2fa_verified")).toBe(false);
    expect(mockPlatformAdminFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a deactivated admin with 403", async () => {
    mockPlatformAdminFindUnique.mockResolvedValue({
      id: "admin1",
      isActive: false,
      twoFactorSecret: { secret: "IRRELEVANT", verified: true },
    });
    const res = await adminVerifyPOST(
      post("/api/platform-admin-2fa-verify", { code: WELL_FORMED_CODE }),
    );
    expect(res.status).toBe(403);
    expect(hasGateCookie(res, "platform_admin_2fa_verified")).toBe(false);
  });

  it("rejects an admin whose 2FA enrollment is not verified", async () => {
    mockPlatformAdminFindUnique.mockResolvedValue({
      id: "admin1",
      isActive: true,
      twoFactorSecret: { secret: "IRRELEVANT", verified: false },
    });
    const res = await adminVerifyPOST(
      post("/api/platform-admin-2fa-verify", { code: WELL_FORMED_CODE }),
    );
    expect(res.status).toBe(400);
    expect(hasGateCookie(res, "platform_admin_2fa_verified")).toBe(false);
  });
});

// --- Supervisor ----------------------------------------------------------------

describe("supervisor-2fa-verify negative branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieGet.mockReturnValue({ value: "supervisor-session-token" });
    mockJwtDecode.mockResolvedValue({ supervisorId: "sup1" });
  });

  it("rejects when the supervisor_session cookie is missing, before hitting the DB", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const res = await supervisorVerifyPOST(
      post("/api/supervisor-2fa-verify", { code: WELL_FORMED_CODE }),
    );
    expect(res.status).toBe(401);
    expect(hasGateCookie(res, "supervisor_2fa_verified")).toBe(false);
    expect(mockSupervisorFindUnique).not.toHaveBeenCalled();
  });

  it("rejects when the session JWT fails to decode", async () => {
    mockJwtDecode.mockRejectedValue(new Error("bad token"));
    const res = await supervisorVerifyPOST(
      post("/api/supervisor-2fa-verify", { code: WELL_FORMED_CODE }),
    );
    expect(res.status).toBe(401);
    expect(hasGateCookie(res, "supervisor_2fa_verified")).toBe(false);
    expect(mockSupervisorFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a deactivated supervisor with 403", async () => {
    mockSupervisorFindUnique.mockResolvedValue({
      id: "sup1",
      isActive: false,
      twoFactorSecret: { secret: "IRRELEVANT", verified: true },
    });
    const res = await supervisorVerifyPOST(
      post("/api/supervisor-2fa-verify", { code: WELL_FORMED_CODE }),
    );
    expect(res.status).toBe(403);
    expect(hasGateCookie(res, "supervisor_2fa_verified")).toBe(false);
  });

  it("rejects a supervisor whose 2FA enrollment is not verified", async () => {
    mockSupervisorFindUnique.mockResolvedValue({
      id: "sup1",
      isActive: true,
      twoFactorSecret: { secret: "IRRELEVANT", verified: false },
    });
    const res = await supervisorVerifyPOST(
      post("/api/supervisor-2fa-verify", { code: WELL_FORMED_CODE }),
    );
    expect(res.status).toBe(400);
    expect(hasGateCookie(res, "supervisor_2fa_verified")).toBe(false);
  });
});
