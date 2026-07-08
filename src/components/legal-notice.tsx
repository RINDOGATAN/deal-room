// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";

/**
 * Persistent, unobtrusive Appropriate Legal Notice (AGPL-3.0 §5(d)), rendered
 * once from the root layout so it appears throughout the running app.
 */
export function LegalNotice() {
  return (
    <div className="px-4 py-2 text-center text-xs text-muted-foreground/70">
      Dealroom &middot; AGPL-3.0 &middot; &copy; Rindogatan LLC &middot;{" "}
      <Link href="/licenses" className="underline hover:text-muted-foreground">
        Source &amp; licence
      </Link>
    </div>
  );
}
