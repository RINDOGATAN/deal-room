// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import LandingPage from "@/landing/LandingPage";
import { features } from "@/config/features";
import { CONTRACT_PAGES } from "@/lib/contract-pages-paths";
import { loadContractPage } from "@/lib/contract-pages";
import type { LandingContract } from "@/landing/LandingPage";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/deals");
  }

  // Self-hosted / local-auth builds have no marketing landing. Send logged-out
  // visitors straight to the local sign-in.
  if (features.localAuth) {
    redirect("/sign-in");
  }

  // The contract guides' names in both languages, for the search box and the
  // popular tiles (read on the server; the guide files are not in the browser).
  const contracts: LandingContract[] = CONTRACT_PAGES.map((def) => {
    const en = loadContractPage(def.slug, "en");
    const es = loadContractPage(def.slug, "es");
    return {
      slug: def.slug,
      contractType: def.contractType,
      name: { en: en?.heading ?? def.contractType, es: es?.heading ?? en?.heading ?? def.contractType },
      summary: { en: en?.description ?? "", es: es?.description ?? en?.description ?? "" },
    };
  });

  return <LandingPage contracts={contracts} />;
}
