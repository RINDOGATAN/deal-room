// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { notFound } from "next/navigation";

/**
 * The supervision docs page was removed from the public site — its
 * content covers platform-admin / supervisor 2FA flows, which are
 * only relevant to our internal team and to self-hosters of the OSS
 * build (who get their own doc tree). The original content lives in
 * git history; restore by reverting the commit that introduced this
 * notFound() stub, and re-add the "Administration" block in
 * `src/app/(public)/docs/components/DocsNav.tsx`.
 */
export default function SupervisionPage() {
  notFound();
}
