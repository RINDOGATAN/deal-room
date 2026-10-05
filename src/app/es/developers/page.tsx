// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { DevelopersPage } from "@/components/developers/DevelopersPage";
import { DEVELOPERS_COPY } from "@/components/developers/copy";
import { developersMetadata } from "@/lib/developers-seo";

// The language comes from the URL, not the visitor's cookie.
export const dynamic = "force-static";

export const metadata = developersMetadata("es", DEVELOPERS_COPY.es.metaTitle, DEVELOPERS_COPY.es.metaDescription);

export default function DevelopersEs() {
  return <DevelopersPage locale="es" />;
}
