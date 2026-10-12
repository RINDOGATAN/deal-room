// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import LandingPage from "@/landing/LandingPage";
import { features } from "@/config/features";
import { CONTRACT_PAGES } from "@/lib/contract-pages-paths";
import { loadContractPage } from "@/lib/contract-pages";
import type { LandingContract } from "@/landing/LandingPage";
import { resolveChosenLocale } from "@/lib/locale-cookie";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
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
  // contract index (read on the server; the guide files are not in the browser).
  const contracts: LandingContract[] = CONTRACT_PAGES.map((def) => {
    const en = loadContractPage(def.slug, "en");
    const es = loadContractPage(def.slug, "es");
    return {
      slug: def.slug,
      contractType: def.contractType,
      group: def.group,
      name: { en: en?.heading ?? def.contractType, es: es?.heading ?? en?.heading ?? def.contractType },
      summary: { en: en?.description ?? "", es: es?.description ?? en?.description ?? "" },
    };
  });

  // The language is chosen on the server (`?lang=`, then the cookie), so the
  // hero is rendered in the visitor's language and never swapped after
  // hydration (the swap delayed the largest paint on Spanish visits).
  const lang = (await searchParams).lang;
  const fromUrl = Array.isArray(lang) ? lang[0] : lang;
  const initialLocale =
    fromUrl === "es" || fromUrl === "en" ? fromUrl : (resolveChosenLocale((await headers()).get("cookie")) ?? "en");

  return <LandingPage contracts={contracts} initialLocale={initialLocale} />;
}
