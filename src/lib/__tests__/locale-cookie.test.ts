// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../../middleware";
import { localeFromCookieHeader } from "@/i18n/request";
import {
  cleanUpLocaleCookie,
  isHostedHost,
  localeCleanupSetCookies,
  localeCookieWrites,
  readLocaleFromCookieHeader,
  resolveChosenLocale,
  writeLocaleCookie,
} from "../locale-cookie";

describe("isHostedHost", () => {
  it("matches todo.law and its subdomains only", () => {
    expect(isHostedHost("dealroom.todo.law")).toBe(true);
    expect(isHostedHost("todo.law")).toBe(true);
    expect(isHostedHost("localhost")).toBe(false);
    expect(isHostedHost("nottodo.law")).toBe(false);
    expect(isHostedHost("deal-room.vercel.app")).toBe(false);
  });
});

describe("localeCookieWrites", () => {
  it("on a hosted host expires the host-only cookie, then writes the domain-wide one", () => {
    const writes = localeCookieWrites("en", "dealroom.todo.law");
    expect(writes).toHaveLength(2);
    expect(writes[0]).toBe("locale=; Path=/; Max-Age=0; SameSite=Lax");
    expect(writes[1]).toBe("locale=en; Path=/; Max-Age=31536000; SameSite=Lax; Domain=.todo.law");
  });

  it("elsewhere writes one host-only cookie", () => {
    expect(localeCookieWrites("es", "localhost")).toEqual([
      "locale=es; Path=/; Max-Age=31536000; SameSite=Lax",
    ]);
  });

  it("expires both variants of the legacy cookie on a hosted host", () => {
    const writes = localeCookieWrites("es", "dealroom.todo.law", true);
    expect(writes).toContain("NEXT_LOCALE=; Path=/; Max-Age=0; SameSite=Lax");
    expect(writes).toContain("NEXT_LOCALE=; Path=/; Max-Age=0; SameSite=Lax; Domain=.todo.law");
  });
});

describe("readers", () => {
  it("return the last locale value", () => {
    expect(readLocaleFromCookieHeader("locale=es; other=1; locale=en")).toBe("en");
    expect(readLocaleFromCookieHeader("locale=en; locale=es")).toBe("es");
    expect(readLocaleFromCookieHeader("xlocale=es")).toBeUndefined();
    expect(readLocaleFromCookieHeader(null)).toBeUndefined();
  });

  it("prefer locale over the legacy cookie, and fall back to it", () => {
    expect(resolveChosenLocale("NEXT_LOCALE=es; locale=en")).toBe("en");
    expect(resolveChosenLocale("NEXT_LOCALE=es")).toBe("es");
  });

  it("server render is English for `locale=es; locale=en` and when no cookie", () => {
    expect(localeFromCookieHeader("locale=es; locale=en")).toBe("en");
    expect(localeFromCookieHeader("locale=en; locale=es")).toBe("es");
    expect(localeFromCookieHeader(undefined)).toBe("en");
  });
});

describe("localeCleanupSetCookies", () => {
  it("emits the expiry and the domain-wide rewrite when two values arrive", () => {
    expect(localeCleanupSetCookies("locale=es; locale=en", "dealroom.todo.law")).toEqual([
      "locale=; Path=/; Max-Age=0; SameSite=Lax",
      "locale=en; Path=/; Max-Age=31536000; SameSite=Lax; Domain=.todo.law",
    ]);
  });

  it("emits nothing when one value or none arrives", () => {
    expect(localeCleanupSetCookies("locale=es", "dealroom.todo.law")).toEqual([]);
    expect(localeCleanupSetCookies("currency=EUR", "dealroom.todo.law")).toEqual([]);
    expect(localeCleanupSetCookies(null, "localhost")).toEqual([]);
  });

  it("migrates a legacy-only choice into the shared cookie", () => {
    const writes = localeCleanupSetCookies("NEXT_LOCALE=es", "localhost");
    expect(writes[0]).toBe("locale=es; Path=/; Max-Age=31536000; SameSite=Lax");
    expect(writes).toContain("NEXT_LOCALE=; Path=/; Max-Age=0; SameSite=Lax");
  });
});

describe("middleware", () => {
  async function run(cookie?: string) {
    const headers = new Headers();
    if (cookie) headers.set("cookie", cookie);
    const res = await middleware(new NextRequest("https://dealroom.todo.law/docs", { headers }));
    return res.headers.getSetCookie().filter((c) => c.startsWith("locale="));
  }

  it("emits both Set-Cookie headers when two locale values arrive", async () => {
    expect(await run("currency=EUR; locale=es; locale=en")).toEqual([
      "locale=; Path=/; Max-Age=0; SameSite=Lax",
      "locale=en; Path=/; Max-Age=31536000; SameSite=Lax; Domain=.todo.law",
    ]);
  });

  it("keeps both headers when the middleware also writes the currency cookie", async () => {
    expect(await run("locale=es; locale=en")).toHaveLength(2);
  });

  it("emits nothing for one value and never writes a default", async () => {
    expect(await run("currency=EUR; locale=es")).toEqual([]);
    expect(await run("currency=EUR")).toEqual([]);
    expect(await run()).toEqual([]);
  });
});

describe("client helpers", () => {
  let jar: string[];

  beforeEach(() => {
    jar = [];
    vi.stubGlobal("window", { location: { hostname: "dealroom.todo.law" } });
    vi.stubGlobal("document", {
      get cookie() {
        return "locale=es; locale=en";
      },
      set cookie(v: string) {
        jar.push(v);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writer expires the host-only duplicate before the domain-wide write", () => {
    writeLocaleCookie("es");
    expect(jar).toEqual([
      "locale=; Path=/; Max-Age=0; SameSite=Lax",
      "locale=es; Path=/; Max-Age=31536000; SameSite=Lax; Domain=.todo.law",
    ]);
  });

  it("page-load clean-up rewrites the last value", () => {
    cleanUpLocaleCookie();
    expect(jar.at(-1)).toBe("locale=en; Path=/; Max-Age=31536000; SameSite=Lax; Domain=.todo.law");
  });
});
