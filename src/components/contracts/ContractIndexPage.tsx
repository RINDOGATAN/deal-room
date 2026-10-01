// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import {
  CONTRACT_GROUPS,
  CONTRACT_PAGES,
  contractPath,
  loadContractPage,
  type PageLocale,
} from "@/lib/contract-pages";
import { contractIndexJsonLd, jsonLdScript } from "@/lib/contract-pages-seo";
import { CONTRACT_COPY } from "./copy";
import { ContractsShell } from "./ContractsShell";
import { PriceLine } from "./PriceLine";

/** `/contracts`: every contract type, grouped. */
export function ContractIndexPage({ locale }: { locale: PageLocale }) {
  const copy = CONTRACT_COPY[locale];
  const pages = CONTRACT_PAGES.map((def) => ({ def, page: loadContractPage(def.slug, locale) })).filter(
    (p) => p.page,
  );
  const other: PageLocale = locale === "en" ? "es" : "en";
  const jsonLd = contractIndexJsonLd(
    locale,
    copy.indexTitle,
    pages.map((p) => ({ slug: p.def.slug, name: p.page!.heading })),
  );

  return (
    <ContractsShell locale={locale} alternateHref={contractPath(other)}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div lang={locale} className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-3xl md:text-4xl font-bold">{copy.indexTitle}</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-3xl">{copy.indexLead}</p>
        <div className="mt-3">
          <PriceLine locale={locale} />
        </div>

        {CONTRACT_GROUPS.map((group) => {
          const items = pages.filter((p) => p.def.group === group.id);
          if (items.length === 0) return null;
          return (
            <section key={group.id} className="mt-10">
              <h2 className="text-xl font-bold mb-4">{group.name[locale]}</h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(({ def, page }) => (
                  <li key={def.slug}>
                    <Link
                      href={contractPath(locale, def.slug)}
                      className="block h-full border border-border rounded-lg bg-card p-4 hover:border-primary transition-colors"
                    >
                      <span className="font-semibold">{page!.heading}</span>
                      <span className="mt-1 block text-sm text-muted-foreground line-clamp-3">
                        {page!.description}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <p className="mt-12 text-sm text-muted-foreground border-t border-border pt-6">{copy.disclaimer}</p>
      </div>
    </ContractsShell>
  );
}
