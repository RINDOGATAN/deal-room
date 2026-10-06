// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Agent API: download the agreed contract as a self-contained HTML document.
 *
 * GET /api/v1/agent/deals/:id/document/html
 * Same access and payment rules as the PDF, DOCX and TXT downloads.
 */

import { NextRequest } from "next/server";
import { apiError } from "@/lib/api-response";
import { agentTextDocument } from "@/server/services/agent/agentTextDocument";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return await agentTextDocument(req, id, "html");
  } catch (error) {
    return apiError(error, "Failed to generate the document");
  }
}
