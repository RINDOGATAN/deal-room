// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextResponse } from "next/server";

// The sign-in page asks this endpoint whether the local login needs a
// workspace passphrase. Runtime env (NOT NEXT_PUBLIC): the operator can set
// or rotate WORKSPACE_PASSPHRASE without rebuilding the image — so the
// answer must never be baked into the bundle or cached.
export const dynamic = "force-dynamic";

export async function GET() {
  const passphraseRequired =
    (process.env.WORKSPACE_PASSPHRASE ?? "").trim().length > 0;
  return NextResponse.json({ passphraseRequired });
}
