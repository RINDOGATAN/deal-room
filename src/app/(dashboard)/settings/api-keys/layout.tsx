// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { features } from "@/config/features";
import { notFound } from "next/navigation";

// Only where the agent API and billing are on (hosted). On the kit, keys
// are issued by the platform administrator at /admin/customers.
export default function ApiKeysLayout({ children }: { children: React.ReactNode }) {
  if (!features.selfServiceApiKeys) notFound();
  return <>{children}</>;
}
