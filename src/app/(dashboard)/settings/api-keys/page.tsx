// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { ApiKeysView } from "./ApiKeysView";

// Settings, API keys. The layout 404s unless the agent API and billing are on.
export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <ApiKeysView creditsAdded={params.credits === "added"} />;
}
