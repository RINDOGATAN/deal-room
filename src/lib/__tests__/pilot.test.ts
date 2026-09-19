// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Hosted pilot rules: which builds are the pilot, the 90-day edit window,
 * the record ceilings, and the mutations a read-only account keeps.
 */
import { describe, it, expect } from "vitest";
import {
  PILOT_CAPS,
  PILOT_EXPORT_PATH,
  PILOT_LIVE_AT,
  PILOT_RUN_URL,
  isHostedPilotEnv,
  pilotAllowsMutation,
  pilotCapMessage,
  pilotEditWindow,
  pilotHasRoom,
  pilotWindowStart,
} from "@/lib/pilot";

const DAY = 24 * 60 * 60 * 1000;

describe("isHostedPilotEnv", () => {
  it("is the pilot on Vercel production (same signal as the auth guards)", () => {
    expect(isHostedPilotEnv({ VERCEL_ENV: "production" })).toBe(true);
  });

  it("is the pilot with an explicit hosted cookie domain", () => {
    expect(isHostedPilotEnv({ AUTH_COOKIE_DOMAIN: ".todo.law" })).toBe(true);
  });

  it("is the pilot when the build-time flag says so (browser bundle)", () => {
    expect(isHostedPilotEnv({ NEXT_PUBLIC_HOSTED_PILOT: "true" })).toBe(true);
  });

  it("is not the pilot on the kit: local auth, host-only cookie, no Vercel", () => {
    expect(
      isHostedPilotEnv({
        NODE_ENV: "production",
        NEXT_PUBLIC_LOCAL_AUTH_ENABLED: "true",
        AUTH_COOKIE_DOMAIN: "",
        NEXT_PUBLIC_HOSTED_PILOT: "false",
      }),
    ).toBe(false);
  });

  it("is not the pilot on a production build that merely lacks AUTH_COOKIE_DOMAIN", () => {
    expect(isHostedPilotEnv({ NODE_ENV: "production" })).toBe(false);
  });

  it("is not the pilot on Vercel previews or in development", () => {
    expect(isHostedPilotEnv({ VERCEL_ENV: "preview" })).toBe(false);
    expect(isHostedPilotEnv({ NODE_ENV: "development" })).toBe(false);
  });
});

describe("pilot caps", () => {
  it("allows one organisation per account", () => {
    expect(PILOT_CAPS.organisationsPerAccount).toBe(1);
  });

  it("gives 90 days of editing", () => {
    expect(PILOT_CAPS.editDays).toBe(90);
  });

  it("accepts records up to the ceiling and refuses the next one", () => {
    expect(pilotHasRoom("deals", 0)).toBe(true);
    expect(pilotHasRoom("deals", PILOT_CAPS.deals - 1)).toBe(true);
    expect(pilotHasRoom("deals", PILOT_CAPS.deals)).toBe(false);
    expect(pilotHasRoom("journeys", PILOT_CAPS.journeys)).toBe(false);
  });

  it("refuses a batch that would pass the ceiling even if the first would fit", () => {
    expect(pilotHasRoom("deals", PILOT_CAPS.deals - 2, 2)).toBe(true);
    expect(pilotHasRoom("deals", PILOT_CAPS.deals - 2, 3)).toBe(false);
  });
});

describe("pilotWindowStart (one clock rule across the suite)", () => {
  it("opens the window at a first sign-in after the deployment date", () => {
    const signIn = new Date("2026-11-03T09:30:00Z");
    expect(pilotWindowStart(signIn)).toEqual(signIn);
  });

  it("never opens the window before the deployment date", () => {
    expect(pilotWindowStart(new Date("2026-09-20T12:00:00Z"))).toEqual(PILOT_LIVE_AT);
    expect(PILOT_LIVE_AT.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("gives an early sign-in the full 90 days from the deployment date", () => {
    const early = new Date("2026-09-25T08:00:00Z");
    const w = pilotEditWindow(early, early);
    expect(w.startedAt).toEqual(PILOT_LIVE_AT);
    expect(w.endsAt.getTime()).toBe(PILOT_LIVE_AT.getTime() + 90 * DAY);
    expect(w).toMatchObject({ daysLeft: 90, readOnly: false });
    // Day 89 after the deployment date: still open; day 90: read-only.
    expect(pilotEditWindow(early, new Date(PILOT_LIVE_AT.getTime() + 89 * DAY)).readOnly).toBe(false);
    expect(pilotEditWindow(early, new Date(PILOT_LIVE_AT.getTime() + 90 * DAY)).readOnly).toBe(true);
  });

  it("counts an account created long before the pilot from its first sign-in, not its creation", () => {
    // Created in 2025; first pilot sign-in on 1 February 2027.
    const firstSignIn = new Date("2027-02-01T10:00:00Z");
    const w = pilotEditWindow(firstSignIn, new Date("2027-02-11T10:00:00Z"));
    expect(w.startedAt).toEqual(firstSignIn);
    expect(w).toMatchObject({ daysLeft: 80, readOnly: false });
  });
});

describe("pilotEditWindow", () => {
  const start = new Date("2026-10-16T10:00:00Z");

  it("has 90 days left on the first day", () => {
    const w = pilotEditWindow(start, start);
    expect(w).toMatchObject({ daysLeft: 90, readOnly: false });
    expect(w.endsAt.getTime()).toBe(start.getTime() + 90 * DAY);
  });

  it("still allows edits in the last hour of day 90", () => {
    const w = pilotEditWindow(start, new Date(start.getTime() + 90 * DAY - 60 * 60 * 1000));
    expect(w).toMatchObject({ daysLeft: 1, readOnly: false });
  });

  it("switches to read-only exactly at 90 days", () => {
    expect(pilotEditWindow(start, new Date(start.getTime() + 90 * DAY))).toMatchObject({
      daysLeft: 0,
      readOnly: true,
    });
  });

  it("stays read-only afterwards", () => {
    expect(pilotEditWindow(start, new Date(start.getTime() + 400 * DAY)).readOnly).toBe(true);
  });
});

describe("pilotAllowsMutation", () => {
  it("allows every mutation while the window is open", () => {
    expect(pilotAllowsMutation("deal.create", false)).toBe(true);
  });

  it("refuses edits once read-only", () => {
    expect(pilotAllowsMutation("deal.create", true)).toBe(false);
    expect(pilotAllowsMutation("deal.updateName", true)).toBe(false);
    expect(pilotAllowsMutation("signing.sign", true)).toBe(false);
  });

  it("keeps role selection and feedback open, so a read-only account can still read", () => {
    expect(pilotAllowsMutation("lawyer.setRole", true)).toBe(true);
    expect(pilotAllowsMutation("feedback.submit", true)).toBe(true);
  });
});

describe("pilotCapMessage", () => {
  it.each(["read_only", "deals", "journeys"] as const)(
    "names both ways out for %s",
    (reason) => {
      const message = pilotCapMessage(reason);
      expect(message).toContain(PILOT_RUN_URL);
      expect(message).toContain(PILOT_EXPORT_PATH);
    },
  );

  it("points the run link at todo.law/run", () => {
    expect(PILOT_RUN_URL).toBe("https://www.todo.law/run");
  });
});
