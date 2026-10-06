// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The HTTP 401 of the /api/v1 routes, for a missing, unknown, revoked or
 * expired API key: the standard `WWW-Authenticate: Bearer` challenge and a
 * message that says where to create a key, as the MCP tools already say.
 * `error` stays "Unauthorized" for callers that read it.
 */

import { NextResponse } from "next/server";
import { brand } from "@/config/brand";
import { API_KEYS_SETTINGS_PATH } from "@/lib/api-key-scopes";

/** Where a person creates an API key (the address the MCP tools give). */
export function apiKeyCreationUrl(): string {
  return `https://${brand.appDomain}${API_KEYS_SETTINGS_PATH}`;
}

export const WWW_AUTHENTICATE = 'Bearer realm="dealroom"';

export function unauthorizedResponse(): NextResponse {
  const keyCreationUrl = apiKeyCreationUrl();
  return NextResponse.json(
    {
      error: "Unauthorized",
      message: `This endpoint needs a valid Dealroom API key in the Authorization header ("Bearer drk_..."). Create one at ${keyCreationUrl}.`,
      keyCreationUrl,
    },
    { status: 401, headers: { "WWW-Authenticate": WWW_AUTHENTICATE } },
  );
}
