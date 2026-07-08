// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Licences · Dealroom",
  description:
    "Dealroom licensing and the AGPL-3.0 corresponding-source offer.",
};

// Corresponding Source location (AGPL-3.0 §13). Pinned to the running commit
// when the build exposes one, so the offer points at the exact deployed code.
const SOURCE =
  process.env.NEXT_PUBLIC_SOURCE_URL || "https://github.com/RINDOGATAN/deal-room";
const COMMIT =
  process.env.NEXT_PUBLIC_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
const SOURCE_URL = COMMIT ? `${SOURCE}/tree/${COMMIT}` : SOURCE;
// The source repo is not public yet; until it is, offer the source at no
// charge on request rather than link to a URL that would 404. Set
// NEXT_PUBLIC_SOURCE_PUBLIC=true once the repo is published.
const SOURCE_PUBLIC = process.env.NEXT_PUBLIC_SOURCE_PUBLIC === "true";

export default function LicensesPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16 space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">Licences</h1>
        <p className="text-muted-foreground">
          <strong>Dealroom</strong>
        </p>
      </div>

      <section className="space-y-3 text-sm leading-relaxed">
        <p>Copyright (C) 2025-2026 Rindogatan LLC</p>
        <p>
          Licensed under the GNU Affero General Public License, version 3 or
          later (AGPL-3.0-or-later).
        </p>
        <p>This program comes with ABSOLUTELY NO WARRANTY.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Complete corresponding source code</h2>
        {SOURCE_PUBLIC ? (
          <>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Under section 13 of the AGPL, users interacting with this program
              over a network are offered the complete corresponding source code
              of the version they are running:
            </p>
            <p className="text-sm">
              <a
                href={SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline decoration-primary/30 hover:decoration-primary break-all"
              >
                {SOURCE_URL}
              </a>
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">
            Under section 13 of the AGPL, users interacting with this program
            over a network are offered the complete corresponding source code of
            the version they are running
            {COMMIT ? ` (commit ${COMMIT})` : ""}, at no charge. The public
            source repository is being finalised; until it is published, request
            the corresponding source by emailing{" "}
            <a
              href="mailto:support@rindogatan.com?subject=AGPL%20corresponding%20source%20request"
              className="text-primary underline decoration-primary/30 hover:decoration-primary"
            >
              support@rindogatan.com
            </a>{" "}
            and we will provide it.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Premium skills</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Premium skills are separately licensed and are not covered by the
          AGPL. Their terms are provided with those components.
        </p>
      </section>
    </main>
  );
}
