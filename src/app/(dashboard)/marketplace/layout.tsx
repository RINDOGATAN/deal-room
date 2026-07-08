// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { features } from "@/config/features";
import { notFound } from "next/navigation";

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  if (!features.marketplace) notFound();
  return <>{children}</>;
}
