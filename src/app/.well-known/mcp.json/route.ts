// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GET /.well-known/mcp.json
 *
 * MCP discovery for this site: the server address, transport, how to send
 * the API key, the tool names, the server card and every contract code
 * with its guide and required inputs. Prerendered (no database).
 */

import { NextResponse } from "next/server";
import { mcpDiscoveryDocument } from "@/server/services/agent/discovery";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(mcpDiscoveryDocument(), {
    headers: { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" },
  });
}
