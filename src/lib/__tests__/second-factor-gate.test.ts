// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The second-factor gate (cycle 12, F3).
 *
 * The gate cookie used to be the fixed string "true". The holder of a
 * first-factor session could set it by hand and skip the TOTP step, the three
 * supervisor document routes never looked at it, and codes could be tried
 * without limit. These tests pin the replacement: a signed value bound to the
 * subject and the sign-in, with its expiry inside the signature, checked by
 * the middleware, the routers and the document routes, behind an attempt
 * limit that fails closed.
 *
 * Real next-auth/jwt and real Web Crypto: the values are production's.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { encode, type JWT } from "next-auth/jwt";
import { NextRequest } from "next/server";
import * as OTPAuth from "otpauth";

const SECRET = "test-secret-for-second-factor-gate";
const TOTP_SECRET = new OTPAuth.Secret().base32;

const mocks = vi.hoisted(() => ({
  supervisorFindUnique: vi.fn(),
  platformAdminFindUnique: vi.fn(),
  assignmentFindUnique: vi.fn(),
  assignmentFindMany: vi.fn(),
  aiGenerationFindMany: vi.fn(),
  claimSlot: vi.fn(),
  cookies: new Map<string, string>(),
}));

vi.mock("@/lib/prisma", () => {
  const prisma = {
    supervisor: { findUnique: mocks.supervisorFindUnique },
    platformAdmin: { findUnique: mocks.platformAdminFindUnique },
    supervisorAssignment: {
      findUnique: mocks.assignmentFindUnique,
      findMany: mocks.assignmentFindMany,
    },
    aiGeneration: { findMany: mocks.aiGenerationFindMany },
  };
  return { default: prisma, prisma };
});
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      mocks.cookies.has(name) ? { value: mocks.cookies.get(name) } : undefined,
  }),
  headers: async () => ({ get: () => null }),
}));
vi.mock("@/server/middleware/apiKeyAuth", () => ({ claimSlot: mocks.claimSlot }));
vi.mock("@/server/services/document/generator", () => ({
  generateContractData: vi.fn(),
  isDealSignable: vi.fn(async () => false),
}));
vi.mock("@/server/services/document/contractTxt", () => ({ generateContractTxt: vi.fn() }));
vi.mock("@/server/services/ai/llm-door", () => ({
  getAIProviderName: vi.fn(),
  isAIConfigured: vi.fn(),
}));
vi.mock("@/server/services/ai/posture", () => ({
  AI_RATE_LIMIT_PER_HOUR: 10,
  AI_SETTINGS_SINGLETON_ID: "singleton",
  markAccepted: vi.fn(),
}));

import {
  SECOND_FACTOR_MAX_AGE_SECONDS,
  issueSecondFactor,
  verifySecondFactor,
} from "@/lib/portal-2fa";
import { ADMIN_PORTAL_SALT, SUPERVISOR_PORTAL_SALT } from "@/lib/portal-session";
import { middleware } from "../../../middleware";
import { createInnerTRPCContext } from "@/server/trpc";
import { supervisorRouter } from "@/server/routers/supervisor";
import { aiRouter } from "@/server/routers/ai";
import { GET as supervisorTxtGET } from "@/app/api/supervise/deals/[id]/document/txt/route";
import { POST as supervisorVerifyPOST } from "@/app/api/supervisor-2fa-verify/route";
import { POST as adminVerifyPOST } from "@/app/api/platform-admin-2fa-verify/route";

const SUPERVISOR = { supervisorId: "sup-1", email: "counsel@example.test", sid: "sign-in-A" };
const ADMIN = { adminId: "admin-1", email: "owner@example.test", sid: "sign-in-B" };

let supervisorToken = "";
let adminToken = "";

function validCode(): string {
  return new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(TOTP_SECRET),
  }).generate();
}

function redirectTarget(res: Response) {
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : null;
}

function cookieValue(res: Response, name: string): string | undefined {
  const header = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return header ? decodeURIComponent(header.slice(name.length + 1).split(";")[0]) : undefined;
}

beforeAll(async () => {
  process.env.NEXTAUTH_SECRET = SECRET;
  supervisorToken = await encode({
    token: { sub: SUPERVISOR.supervisorId, ...SUPERVISOR } as unknown as JWT,
    secret: SECRET,
    salt: SUPERVISOR_PORTAL_SALT,
  });
  adminToken = await encode({
    token: { sub: ADMIN.adminId, ...ADMIN } as unknown as JWT,
    secret: SECRET,
    salt: ADMIN_PORTAL_SALT,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.clear();
  mocks.claimSlot.mockResolvedValue({ allowed: true, remaining: 9 });
  mocks.supervisorFindUnique.mockResolvedValue({
    id: SUPERVISOR.supervisorId,
    email: SUPERVISOR.email,
    isActive: true,
    twoFactorSecret: { secret: TOTP_SECRET, verified: true },
  });
  mocks.platformAdminFindUnique.mockResolvedValue({
    id: ADMIN.adminId,
    email: ADMIN.email,
    isActive: true,
    twoFactorSecret: { secret: TOTP_SECRET, verified: true },
  });
  mocks.assignmentFindUnique.mockResolvedValue({ id: "assignment-1" });
  mocks.assignmentFindMany.mockResolvedValue([]);
  mocks.aiGenerationFindMany.mockResolvedValue([]);
});

describe("the signed value", () => {
  it("verifies for the subject and sign-in it was issued for", async () => {
    const value = await issueSecondFactor("admin", "admin-1", "sign-in-B");
    expect(value).not.toBe("true");
    expect(await verifySecondFactor("admin", "admin-1", "sign-in-B", value)).toBe(true);
  });

  it("refuses the old fixed value and anything malformed", async () => {
    for (const forged of ["true", "", "v1", "v1.9999999999.", "v1.9999999999.AAAA", "v2.1.x"]) {
      expect(await verifySecondFactor("admin", "admin-1", "sign-in-B", forged)).toBe(false);
    }
    expect(await verifySecondFactor("admin", "admin-1", "sign-in-B", undefined)).toBe(false);
  });

  it("is worthless for another subject, another sign-in or the other portal", async () => {
    const value = await issueSecondFactor("admin", "admin-1", "sign-in-B");
    expect(await verifySecondFactor("admin", "admin-2", "sign-in-B", value)).toBe(false);
    expect(await verifySecondFactor("admin", "admin-1", "sign-in-C", value)).toBe(false);
    expect(await verifySecondFactor("supervisor", "admin-1", "sign-in-B", value)).toBe(false);
    expect(await verifySecondFactor("admin", "admin-1", null, value)).toBe(false);
  });

  it("carries its expiry inside the signature", async () => {
    const issuedAt = Date.UTC(2026, 8, 20, 12, 0, 0);
    const value = await issueSecondFactor("admin", "admin-1", "sign-in-B", issuedAt);
    const justBefore = issuedAt + (SECOND_FACTOR_MAX_AGE_SECONDS - 1) * 1000;
    const justAfter = issuedAt + (SECOND_FACTOR_MAX_AGE_SECONDS + 1) * 1000;
    expect(await verifySecondFactor("admin", "admin-1", "sign-in-B", value, justBefore)).toBe(true);
    expect(await verifySecondFactor("admin", "admin-1", "sign-in-B", value, justAfter)).toBe(false);

    // Pushing the expiry out by hand breaks the signature.
    const [version, , signature] = value.split(".");
    const extended = `${version}.9999999999.${signature}`;
    expect(await verifySecondFactor("admin", "admin-1", "sign-in-B", extended, justAfter)).toBe(
      false
    );
  });

  it("fails closed without NEXTAUTH_SECRET", async () => {
    const value = await issueSecondFactor("admin", "admin-1", "sign-in-B");
    delete process.env.NEXTAUTH_SECRET;
    try {
      expect(await verifySecondFactor("admin", "admin-1", "sign-in-B", value)).toBe(false);
      await expect(issueSecondFactor("admin", "admin-1", "sign-in-B")).rejects.toThrow();
    } finally {
      process.env.NEXTAUTH_SECRET = SECRET;
    }
  });
});

describe("middleware", () => {
  function visit(path: string, cookie: string) {
    return middleware(new NextRequest(`https://dealroom.todo.law${path}`, { headers: { cookie } }));
  }

  it("sends a hand-set cookie back to the code page, on both portals", async () => {
    const admin = await visit(
      "/admin/customers",
      `admin_session=${adminToken}; platform_admin_2fa_verified=true`
    );
    expect(redirectTarget(admin)).toBe("/admin/verify");

    const supervisor = await visit(
      "/supervise/deals",
      `supervisor_session=${supervisorToken}; supervisor_2fa_verified=true`
    );
    expect(redirectTarget(supervisor)).toBe("/supervise/verify");
  });

  it("refuses a value issued for someone else's sign-in", async () => {
    const other = await issueSecondFactor("supervisor", SUPERVISOR.supervisorId, "sign-in-Z");
    const res = await visit(
      "/supervise/deals",
      `supervisor_session=${supervisorToken}; supervisor_2fa_verified=${other}`
    );
    expect(redirectTarget(res)).toBe("/supervise/verify");
  });

  it("lets a supervisor with their own verified value through", async () => {
    const own = await issueSecondFactor("supervisor", SUPERVISOR.supervisorId, SUPERVISOR.sid);
    const res = await visit(
      "/supervise/deals",
      `supervisor_session=${supervisorToken}; supervisor_2fa_verified=${own}`
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("tRPC routers", () => {
  function context(cookie: Record<string, string>) {
    return createInnerTRPCContext({
      session: null,
      adminSession: ADMIN,
      supervisorSession: SUPERVISOR,
      getCookie: (name) => cookie[name],
    });
  }

  it("supervisor: a hand-set cookie is FORBIDDEN, the issued value works", async () => {
    await expect(
      supervisorRouter
        .createCaller(context({ supervisor_2fa_verified: "true" }))
        .getAssignedDeals()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.assignmentFindMany).not.toHaveBeenCalled();

    const own = await issueSecondFactor("supervisor", SUPERVISOR.supervisorId, SUPERVISOR.sid);
    await expect(
      supervisorRouter.createCaller(context({ supervisor_2fa_verified: own })).getAssignedDeals()
    ).resolves.toEqual([]);
  });

  it("admin AI procedures need the second factor too", async () => {
    await expect(
      aiRouter.createCaller(context({})).listGenerations({ limit: 10 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      aiRouter
        .createCaller(context({ platform_admin_2fa_verified: "true" }))
        .listGenerations({ limit: 10 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.aiGenerationFindMany).not.toHaveBeenCalled();

    const own = await issueSecondFactor("admin", ADMIN.adminId, ADMIN.sid);
    await expect(
      aiRouter
        .createCaller(context({ platform_admin_2fa_verified: own }))
        .listGenerations({ limit: 10 })
    ).resolves.toEqual([]);
  });
});

describe("supervisor document route", () => {
  function get() {
    return supervisorTxtGET(
      new NextRequest("http://localhost/api/supervise/deals/deal-1/document/txt"),
      { params: Promise.resolve({ id: "deal-1" }) }
    );
  }

  it("refuses a first-factor session with no second factor, or a hand-set one", async () => {
    mocks.cookies.set("supervisor_session", supervisorToken);
    expect((await get()).status).toBe(403);

    mocks.cookies.set("supervisor_2fa_verified", "true");
    expect((await get()).status).toBe(403);
    expect(mocks.assignmentFindUnique).not.toHaveBeenCalled();
  });

  it("serves a supervisor whose second factor verifies", async () => {
    mocks.cookies.set("supervisor_session", supervisorToken);
    mocks.cookies.set(
      "supervisor_2fa_verified",
      await issueSecondFactor("supervisor", SUPERVISOR.supervisorId, SUPERVISOR.sid)
    );
    const res = await get();
    // Past every access check: the mocked deal is simply not ready to render.
    expect(res.status).toBe(400);
    expect(mocks.assignmentFindUnique).toHaveBeenCalled();
  });
});

describe("verify routes", () => {
  function post(path: string, code: string) {
    return new NextRequest(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  }

  it("issue a value that verifies for this sign-in, not the word true", async () => {
    mocks.cookies.set("supervisor_session", supervisorToken);
    const res = await supervisorVerifyPOST(post("/api/supervisor-2fa-verify", validCode()));
    expect(res.status).toBe(200);
    const value = cookieValue(res, "supervisor_2fa_verified");
    expect(value).toBeDefined();
    expect(value).not.toBe("true");
    expect(
      await verifySecondFactor("supervisor", SUPERVISOR.supervisorId, SUPERVISOR.sid, value)
    ).toBe(true);

    mocks.cookies.set("admin_session", adminToken);
    const adminRes = await adminVerifyPOST(post("/api/platform-admin-2fa-verify", validCode()));
    expect(adminRes.status).toBe(200);
    expect(
      await verifySecondFactor(
        "admin",
        ADMIN.adminId,
        ADMIN.sid,
        cookieValue(adminRes, "platform_admin_2fa_verified")
      )
    ).toBe(true);
  });

  it("stop checking codes once the attempt limit is reached, even a right one", async () => {
    mocks.claimSlot.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 600 });

    mocks.cookies.set("supervisor_session", supervisorToken);
    const res = await supervisorVerifyPOST(post("/api/supervisor-2fa-verify", validCode()));
    expect(res.status).toBe(429);
    expect(cookieValue(res, "supervisor_2fa_verified")).toBeUndefined();

    mocks.cookies.set("admin_session", adminToken);
    const adminRes = await adminVerifyPOST(post("/api/platform-admin-2fa-verify", validCode()));
    expect(adminRes.status).toBe(429);
    expect(cookieValue(adminRes, "platform_admin_2fa_verified")).toBeUndefined();

    expect(mocks.claimSlot).toHaveBeenCalledWith(
      `second-factor:supervisor:${SUPERVISOR.supervisorId}`,
      10,
      15 * 60_000
    );
  });

  it("fail closed when the attempt counter cannot be written", async () => {
    mocks.claimSlot.mockRejectedValue(new Error("counter unavailable"));
    mocks.cookies.set("admin_session", adminToken);
    const res = await adminVerifyPOST(post("/api/platform-admin-2fa-verify", validCode()));
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(cookieValue(res, "platform_admin_2fa_verified")).toBeUndefined();
  });
});
