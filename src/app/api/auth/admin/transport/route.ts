// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GET /api/auth/admin/transport — does this install have a mail transport?
 *
 * The platform-admin sign-in page reads this flag to tell the truth after a
 * magic-link request: with no RESEND_API_KEY the sign-in link is printed to
 * the server log (see lib/auth-admin.ts sendVerificationRequest), so the UI
 * must point the operator at the logs instead of claiming an email was sent.
 *
 * Static segment, so it takes precedence over the sibling [...nextauth]
 * catch-all. Discloses only a boolean about server configuration — no
 * secrets, no admin enumeration.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    emailConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
  });
}
