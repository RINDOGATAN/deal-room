// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Honest failure: a procedure that fails on our side answers with a
 * sentence the person can act on and a reference id, logs the failure
 * under that id, and never sends a stack trace. Driven through the real
 * fetch adapter and error formatter with the failure probe switched on.
 * Also checks that every route group has an error page and the root has a
 * global one.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const logged = vi.hoisted(() => [] as { msg: string; meta?: Record<string, unknown> }[]);

vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/jwt", () => ({ decode: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: (msg: string, meta?: Record<string, unknown>) => logged.push({ msg, meta }),
  }),
}));

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { TRPCError } from "@trpc/server";
import { createInnerTRPCContext, createTRPCRouter, publicProcedure } from "@/server/trpc";
import { diagnosticsRouter, failureProbeEnabled } from "@/server/routers/diagnostics";
import { presentInternalError } from "@/server/internal-error";
import { errorReference, userSafeErrorMessage } from "@/lib/error-reference";

const router = createTRPCRouter({
  diagnostics: diagnosticsRouter,
  written: publicProcedure.query(() => {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The PDF could not be generated. Try again." });
  }),
});

async function call(path: string) {
  const res = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request(`http://localhost/api/trpc/${path}`),
    router,
    createContext: () =>
      createInnerTRPCContext({
        session: null,
        adminSession: null,
        supervisorSession: null,
        getCookie: () => undefined,
      }),
  });
  return { status: res.status, body: await res.json() };
}

describe("a failing procedure", () => {
  beforeEach(() => {
    logged.length = 0;
    vi.stubEnv("FAILURE_PROBE_ENABLED", "true");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("answers with an actionable sentence and a reference, logged under the same id", async () => {
    const { status, body } = await call("diagnostics.failureProbe");
    expect(status).toBe(500);
    const { message, data } = body.error.json;
    expect(message).toMatch(/^Something went wrong on our side\. Please try again/);
    expect(message).not.toMatch(/Internal server error|TypeError|undefined|reading/);
    expect(data.reference).toMatch(/^DR-[0-9A-F]{10}$/);
    expect(message).toContain(data.reference);
    expect(data.stack ?? null).toBeNull();
    expect(JSON.stringify(body)).not.toMatch(/\bat .*\.ts:\d+/);
    expect(logged).toHaveLength(1);
    expect(logged[0].meta).toMatchObject({
      reference: data.reference,
      path: "diagnostics.failureProbe",
      name: "TypeError",
    });
  });

  it("keeps a message the code wrote on purpose, still with a reference", async () => {
    const { body } = await call("written");
    expect(body.error.json.message).toBe("The PDF could not be generated. Try again.");
    expect(body.error.json.data.reference).toMatch(/^DR-/);
  });

  it("is off without the flag and on hosted production", async () => {
    vi.stubEnv("FAILURE_PROBE_ENABLED", "");
    const { status } = await call("diagnostics.failureProbe");
    expect(status).toBe(404);
    expect(failureProbeEnabled({ FAILURE_PROBE_ENABLED: "true", VERCEL_ENV: "production" })).toBe(false);
    expect(failureProbeEnabled({ FAILURE_PROBE_ENABLED: "true" })).toBe(true);
  });
});

describe("presentInternalError", () => {
  it("replaces a bare 'Internal server error' with the actionable sentence", () => {
    const out = presentInternalError(
      new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Internal server error" }),
      "x",
    );
    expect(out.message).toContain(out.reference);
  });

  it("keeps the reconnecting sentence for a database hiccup", () => {
    const out = presentInternalError(
      new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: new Error("Can't reach database server at x") }),
      "x",
    );
    expect(out.message).toMatch(/reconnecting/);
  });
});

describe("error pages", () => {
  const app = join(__dirname, "..", "..", "app");

  it("every route group and the root has an error page; the root has a global one", () => {
    const groups = readdirSync(app).filter((d) => /^\(.+\)$/.test(d));
    expect(groups.length).toBeGreaterThanOrEqual(5);
    for (const dir of ["", ...groups]) {
      const file = join(app, dir, "error.tsx");
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file, "utf8")).toContain("<ErrorScreen");
    }
    const global = readFileSync(join(app, "global-error.tsx"), "utf8");
    expect(global).toContain("<html");
    expect(global).toContain("<ErrorScreen");
  });

  it("the error screen shows a reference, a way back and the reporting guide", () => {
    const src = readFileSync(join(__dirname, "..", "..", "components", "ErrorScreen.tsx"), "utf8");
    expect(src).toContain("errorReference(");
    expect(src).toContain("backHref");
    expect(src).toContain("status-and-support.md");
    expect(src).toContain('logger.error("page failed"');
  });

  it("only a server-written tRPC message reaches the screen", () => {
    const bug = new TypeError("Cannot read properties of undefined (reading 'x')");
    expect(userSafeErrorMessage(bug)).toBeNull();
    const trpc = Object.assign(new Error("Deal not found"), { name: "TRPCClientError" });
    expect(userSafeErrorMessage(trpc)).toBe("Deal not found");
    expect(errorReference("1234567890abcdef")).toBe("DR-1234567890AB");
  });
});
