// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { features } from "@/config/features";
import { notFound } from "next/navigation";

// Settings holds the hosted pilot counters while the pilot runs, and the
// person's agent API keys once billing is on (`features.selfServiceApiKeys`).
// The kit has neither, so the route does not exist there (same pattern as
// /skills and /billing).
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  if (!features.hostedPilot && !features.selfServiceApiKeys) notFound();
  return <>{children}</>;
}
