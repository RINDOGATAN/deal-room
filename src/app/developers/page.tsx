// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { DevelopersPage } from "@/components/developers/DevelopersPage";
import { DEVELOPERS_COPY } from "@/components/developers/copy";
import { developersMetadata } from "@/lib/developers-seo";

// The language comes from the URL, not the visitor's cookie; the price
// line loads in the browser from the price configuration.
export const dynamic = "force-static";

export const metadata = developersMetadata("en", DEVELOPERS_COPY.en.metaTitle, DEVELOPERS_COPY.en.metaDescription);

export default function Developers() {
  return <DevelopersPage locale="en" />;
}
