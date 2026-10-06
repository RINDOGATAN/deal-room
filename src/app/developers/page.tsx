// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { headers } from "next/headers";
import { DevelopersPage } from "@/components/developers/DevelopersPage";
import { DEVELOPERS_COPY } from "@/components/developers/copy";
import { developersMetadata } from "@/lib/developers-seo";
import { loadDevelopersDoc } from "@/server/services/developers";

// Rendered per request: the contract types come from the catalogue (cached
// for five minutes) and the price from the /pricing source, in the
// visitor's currency. The language comes from the URL.
export const dynamic = "force-dynamic";

export const metadata = developersMetadata("en", DEVELOPERS_COPY.en.metaTitle, DEVELOPERS_COPY.en.metaDescription);

export default async function Developers() {
  return <DevelopersPage doc={await loadDevelopersDoc("en", await headers())} />;
}
