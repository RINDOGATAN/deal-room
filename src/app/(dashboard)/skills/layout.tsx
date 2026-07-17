// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { features } from "@/config/features";
import { notFound } from "next/navigation";

// The .skill installer only exists on self-hosted installs (no Stripe). On
// hosted, premium is a Stripe subscription — closing the route here covers
// bookmarks and shared links, same pattern as /billing and /marketplace.
export default function SkillsLayout({ children }: { children: React.ReactNode }) {
  if (!features.skillInstaller) notFound();
  return <>{children}</>;
}
