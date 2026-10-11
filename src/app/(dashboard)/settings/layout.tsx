// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { features } from "@/config/features";
import { notFound } from "next/navigation";

// Settings holds the person's agent API keys once billing is on
// (`features.selfServiceApiKeys`). The kit has none, so the route does not
// exist there (same pattern as /skills and /billing).
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  if (!features.selfServiceApiKeys) notFound();
  return <>{children}</>;
}
