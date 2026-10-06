// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * GET /es/developers.md
 *
 * The developer quick start as plain Markdown, for agents and tools. Built
 * from the same data as the HTML page (`loadDevelopersDoc`), so the two
 * cannot differ.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { developersMarkdown } from "@/lib/developers-doc";
import { loadDevelopersDoc } from "@/server/services/developers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const doc = await loadDevelopersDoc("es", req.headers);
    return new NextResponse(developersMarkdown(doc), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Language": "es",
        Link: `<${doc.url}>; rel="canonical"`,
        // The price follows the visitor's region, so shared caches keep one copy per region header.
        "Cache-Control": "public, max-age=300",
        Vary: "x-vercel-ip-country, accept-language",
      },
    });
  } catch (error) {
    return apiError(error, "Could not build the page");
  }
}
