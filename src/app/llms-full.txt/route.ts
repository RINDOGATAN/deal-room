// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GET /llms-full.txt
 *
 * The long companion of /llms.txt: every contract type with its code,
 * required inputs, guide links and one-call body, plus the one call and
 * the MCP setup. Prerendered from the guide list and the contract-types
 * copy (`llmsFullDocument`).
 */

import { llmsFullDocument } from "@/server/services/agent/discovery";

export const dynamic = "force-static";

export function GET() {
  return new Response(llmsFullDocument(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
