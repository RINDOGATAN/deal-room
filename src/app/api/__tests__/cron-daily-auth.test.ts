// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/** The daily cron refuses a wrong or missing bearer before any job runs. */
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

const jobs = vi.hoisted(() => ({
  runDraftReminderJob: vi.fn(),
  runInvitationReminderJob: vi.fn(),
  runReadySweepJob: vi.fn(),
}));
vi.hoisted(() => {
  process.env.CRON_SECRET = "test-cron-secret";
});
vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));
vi.mock("@/lib/email", () => ({ sendSigningExpiringSoonEmail: vi.fn(), sendSigningExpiredEmail: vi.fn() }));
vi.mock("@/server/services/notifications/deal-emails", () => jobs);

import { GET } from "@/app/api/cron/daily/route";

function call(auth?: string) {
  return GET(
    new NextRequest("http://localhost/api/cron/daily", auth ? { headers: { authorization: auth } } : undefined),
  );
}

describe("cron/daily authentication", () => {
  it.each([undefined, "Bearer wrong", "Bearer test-cron-secre", "Bearer test-cron-secretX", "Bearer "])(
    "refuses %s",
    async (auth) => {
      const res = await call(auth);
      expect(res.status).toBe(401);
      expect(jobs.runInvitationReminderJob).not.toHaveBeenCalled();
    },
  );
});
