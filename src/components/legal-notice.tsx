// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The copyright notice, rendered once from the root layout so it closes
 * every page. Only the notice (owner, 2026-10-01): no licence name, no
 * "Source & licence" link, no repeated product name. The licence and the
 * corresponding-source offer stay at /licenses.
 */
export function LegalNotice() {
  return (
    <div className="px-4 py-2 text-center text-xs text-muted-foreground/70">
      &copy; Rindogatan LLC
    </div>
  );
}
