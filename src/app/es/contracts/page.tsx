// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { ContractIndexPage } from "@/components/contracts/ContractIndexPage";
import { indexMetadata } from "@/components/contracts/routes";

// The language comes from the URL, not the visitor's cookie.
export const dynamic = "force-static";

export const metadata = indexMetadata("es");

export default function ContractsIndexEs() {
  return <ContractIndexPage locale="es" />;
}
