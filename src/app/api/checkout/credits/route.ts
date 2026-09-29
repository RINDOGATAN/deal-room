// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Backward-compatible path for POST /api/v1/agent/subscribe, which is
 * retired (HTTP 410). Credit packs are bought at
 * POST /api/v1/agent/credits/checkout.
 */
export { POST } from "@/app/api/v1/agent/subscribe/route";
