// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Portal token isolation (cycle 12, F2).
 *
 * All three sign-ins share NEXTAUTH_SECRET. A token issued by the ordinary
 * user sign-in must never read as an admin or supervisor session, whatever
 * e-mail it carries, and no callback may promote it by matching that e-mail
 * against the admin or supervisor table. The portal's own token still works.
 *
 * Uses the real next-auth/jwt, so the tokens are the ones production issues.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { encode, type JWT } from "next-auth/jwt";
import { NextRequest } from "next/server";

const SECRET = "test-secret-for-portal-token-isolation";

const mocks = vi.hoisted(() => ({
  platformAdminFindUnique: vi.fn(),
  supervisorFindUnique: vi.fn(),
  assignmentFindUnique: vi.fn(),
  cookieGet: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    platformAdmin = { findUnique: mocks.platformAdminFindUnique };
    supervisor = { findUnique: mocks.supervisorFindUnique };
  },
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    supervisor: { findUnique: mocks.supervisorFindUnique },
    supervisorAssignment: { findUnique: mocks.assignmentFindUnique },
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet }),
}));
vi.mock("resend", () => ({ Resend: class {} }));
vi.mock("next-auth/providers/email", () => ({ default: () => ({ id: "email" }) }));
vi.mock("@/lib/admin-adapter", () => ({ createAdminAdapter: () => ({}) }));
vi.mock("@/lib/supervisor-adapter", () => ({ createSupervisorAdapter: () => ({}) }));
vi.mock("@/server/services/document/generator", () => ({
  generateContractData: vi.fn(),
  isDealSignable: vi.fn(async () => false),
}));
vi.mock("@/server/services/document/contractTxt", () => ({ generateContractTxt: vi.fn() }));

import { adminAuthOptions } from "@/lib/auth-admin";
import { supervisorAuthOptions } from "@/lib/auth-supervisor";
import { middleware } from "../../../middleware";
import { GET as supervisorTxtGET } from "@/app/api/supervise/deals/[id]/document/txt/route";

const ADMIN = { id: "admin-1", email: "owner@example.test", name: "Owner", isActive: true };
const SUPERVISOR = { id: "sup-1", email: "counsel@example.test", name: "Counsel", isActive: true };

/** What the ordinary user sign-in issues: the library's default key. */
function userPortalToken(email: string) {
  return encode({
    token: { sub: "user-1", email, name: "Stranger" } as unknown as JWT,
    secret: SECRET,
  });
}

/** What a portal's own sign-in issues, through that portal's configured encoder. */
function portalToken(
  options: typeof adminAuthOptions,
  token: Record<string, unknown>
): Promise<string> {
  const portalEncode = options.jwt?.encode ?? encode;
  return Promise.resolve(
    portalEncode({ token: token as unknown as JWT, secret: SECRET, maxAge: 3600 })
  );
}

function visit(path: string, cookie: string) {
  return middleware(
    new NextRequest(`https://dealroom.todo.law${path}`, { headers: { cookie } })
  );
}

function redirectTarget(res: Response) {
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : null;
}

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = SECRET;
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.platformAdminFindUnique.mockResolvedValue(ADMIN);
  mocks.supervisorFindUnique.mockResolvedValue(SUPERVISOR);
  mocks.assignmentFindUnique.mockResolvedValue({ id: "assignment-1" });
});

describe("jwt callbacks never promote a token by e-mail", () => {
  it("admin: a token without adminId stays without it, even when the e-mail is an admin's", async () => {
    const token = await adminAuthOptions.callbacks!.jwt!({
      token: { sub: "user-1", email: ADMIN.email },
    } as never);
    expect(token.adminId).toBeUndefined();
  });

  it("supervisor: a token without supervisorId stays without it", async () => {
    const token = await supervisorAuthOptions.callbacks!.jwt!({
      token: { sub: "user-1", email: SUPERVISOR.email },
    } as never);
    expect(token.supervisorId).toBeUndefined();
  });

  it("admin: the portal's own sign-in still stamps adminId", async () => {
    const token = await adminAuthOptions.callbacks!.jwt!({
      token: { sub: ADMIN.id },
      user: { id: ADMIN.id, email: ADMIN.email },
    } as never);
    expect(token.adminId).toBe(ADMIN.id);
  });

  it("supervisor: the portal's own sign-in still stamps supervisorId", async () => {
    const token = await supervisorAuthOptions.callbacks!.jwt!({
      token: { sub: SUPERVISOR.id },
      user: { id: SUPERVISOR.id, email: SUPERVISOR.email },
    } as never);
    expect(token.supervisorId).toBe(SUPERVISOR.id);
  });
});

describe("each portal reads only its own token", () => {
  it("the admin portal cannot decode a user-portal token", async () => {
    const stranger = await userPortalToken(ADMIN.email);
    await expect(
      Promise.resolve(adminAuthOptions.jwt!.decode!({ token: stranger, secret: SECRET }))
    ).rejects.toThrow();
  });

  it("the supervisor portal cannot decode an admin-portal token, and the reverse", async () => {
    const admin = await portalToken(adminAuthOptions, { sub: ADMIN.id, adminId: ADMIN.id });
    const supervisor = await portalToken(supervisorAuthOptions, { sub: SUPERVISOR.id });
    await expect(
      Promise.resolve(supervisorAuthOptions.jwt!.decode!({ token: admin, secret: SECRET }))
    ).rejects.toThrow();
    await expect(
      Promise.resolve(adminAuthOptions.jwt!.decode!({ token: supervisor, secret: SECRET }))
    ).rejects.toThrow();
  });

  it("a portal decodes what it issued", async () => {
    const admin = await portalToken(adminAuthOptions, { sub: ADMIN.id, adminId: ADMIN.id });
    const decoded = await adminAuthOptions.jwt!.decode!({ token: admin, secret: SECRET });
    expect(decoded?.adminId).toBe(ADMIN.id);
  });
});

describe("middleware", () => {
  it("sends a user-portal token in the admin cookie to the admin sign-in", async () => {
    const stranger = await userPortalToken(ADMIN.email);
    const res = await visit(
      "/admin/customers",
      `admin_session=${stranger}; platform_admin_2fa_verified=true`
    );
    expect(redirectTarget(res)).toBe("/admin/sign-in");
  });

  it("sends a user-portal token in the supervisor cookie to the supervisor sign-in", async () => {
    const stranger = await userPortalToken(SUPERVISOR.email);
    const res = await visit(
      "/supervise/deals",
      `supervisor_session=${stranger}; supervisor_2fa_verified=true`
    );
    expect(redirectTarget(res)).toBe("/supervise/sign-in");
  });

  it("moves a real admin session on to the second factor, not back to sign-in", async () => {
    const admin = await portalToken(adminAuthOptions, {
      sub: ADMIN.id,
      adminId: ADMIN.id,
      email: ADMIN.email,
    });
    const res = await visit("/admin/customers", `admin_session=${admin}`);
    expect(redirectTarget(res)).toBe("/admin/verify");
  });

  it("refuses every portal session when NEXTAUTH_SECRET is missing", async () => {
    const admin = await portalToken(adminAuthOptions, {
      sub: ADMIN.id,
      adminId: ADMIN.id,
      email: ADMIN.email,
    });
    delete process.env.NEXTAUTH_SECRET;
    try {
      const res = await visit("/admin/customers", `admin_session=${admin}`);
      expect(redirectTarget(res)).toBe("/admin/sign-in");
    } finally {
      process.env.NEXTAUTH_SECRET = SECRET;
    }
  });
});

describe("supervisor document route", () => {
  function get() {
    return supervisorTxtGET(
      new NextRequest("http://localhost/api/supervise/deals/deal-1/document/txt"),
      { params: Promise.resolve({ id: "deal-1" }) }
    );
  }

  it("refuses a user-portal token that carries a supervisor's e-mail", async () => {
    const stranger = await userPortalToken(SUPERVISOR.email);
    mocks.cookieGet.mockImplementation((name: string) =>
      name === "supervisor_session" ? { value: stranger } : undefined
    );
    const res = await get();
    expect(res.status).toBe(401);
    expect(mocks.supervisorFindUnique).not.toHaveBeenCalled();
  });
});
