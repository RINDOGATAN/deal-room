// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Bot, FileText } from "lucide-react";
import {
  contractPath,
  loadContractPage,
  pageForSlug,
  sectionHeadings,
  type PageLocale,
} from "@/lib/contract-pages";
import { catalogueEntry } from "@/lib/skill-catalogue";
import { agentExample, contractPageJsonLd, jsonLdScript } from "@/lib/contract-pages-seo";
import { CONTRACT_COPY, JURISDICTION_NAMES, LANGUAGE_NAMES } from "./copy";
import { ContractsShell } from "./ContractsShell";
import { CreateLink } from "./CreateLink";
import { PriceLine } from "./PriceLine";

/** One contract guide, prerendered per language. */
export function ContractGuidePage({ slug, locale }: { slug: string; locale: PageLocale }) {
  const def = pageForSlug(slug);
  const page = def ? loadContractPage(slug, locale) : null;
  if (!def || !page) notFound();

  const copy = CONTRACT_COPY[locale];
  const entry = catalogueEntry(def.contractType);
  const jurisdictions = entry?.jurisdictions ?? [];
  const languages = entry?.languages ?? [];
  const headings = sectionHeadings(page.body);
  const related = page.related
    .map((s) => ({ slug: s, page: pageForSlug(s) ? loadContractPage(s, locale) : null }))
    .filter((r) => r.page);
  const other: PageLocale = locale === "en" ? "es" : "en";
  const example = agentExample({
    contractType: def.contractType,
    jurisdictions,
    languages,
    locale,
    dealName: `${locale === "es" ? "Prueba" : "Example"} ${def.contractType}`,
  });

  return (
    <ContractsShell locale={locale} alternateHref={contractPath(other, slug)}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(contractPageJsonLd(page, copy.indexTitle)) }}
      />
      <article lang={locale} className="max-w-3xl mx-auto px-6 py-10">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-6">
          <Link href={contractPath(locale)} className="hover:text-foreground">
            {copy.allContracts}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{page.heading}</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold leading-tight">{page.heading}</h1>
        {page.summary && <p className="mt-4 text-lg text-muted-foreground">{page.summary}</p>}

        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {jurisdictions.length > 0 && (
            <div>
              <dt className="text-muted-foreground">{copy.jurisdictions}</dt>
              <dd>{jurisdictions.map((j) => JURISDICTION_NAMES[j]?.[locale] ?? j).join(", ")}</dd>
            </div>
          )}
          {languages.length > 0 && (
            <div>
              <dt className="text-muted-foreground">{copy.languages}</dt>
              <dd>{languages.map((l) => LANGUAGE_NAMES[l]?.[locale] ?? l).join(", ")}</dd>
            </div>
          )}
        </dl>

        {headings.length > 2 && (
          <nav aria-label={copy.contents} className="mt-8 border border-border rounded-lg p-4 bg-card">
            <p className="text-sm font-semibold mb-2">{copy.contents}</p>
            <ul className="text-sm space-y-1">
              {headings.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="text-muted-foreground hover:text-foreground">
                    {h.text}
                  </a>
                </li>
              ))}
              <li>
                <a href="#make-it" className="text-muted-foreground hover:text-foreground">
                  {copy.makeTitle}
                </a>
              </li>
              <li>
                <a href="#faq" className="text-muted-foreground hover:text-foreground">
                  {copy.faqTitle}
                </a>
              </li>
            </ul>
          </nav>
        )}

        <div className="contract-article mt-8" dangerouslySetInnerHTML={{ __html: page.html }} />

        <section id="faq" className="mt-12">
          <h2 className="text-2xl font-bold mb-4">{copy.faqTitle}</h2>
          <div className="space-y-3">
            {page.faq.map((f) => (
              <details key={f.q} className="border border-border rounded-lg bg-card p-4" open>
                <summary className="font-semibold cursor-pointer">{f.q}</summary>
                <p className="mt-2 text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="make-it" className="mt-12">
          <h2 className="text-2xl font-bold mb-4">{copy.makeTitle}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border border-border rounded-lg bg-card p-5 flex flex-col">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" aria-hidden />
                {copy.makeSelfTitle}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground flex-1">{copy.makeSelfText}</p>
              <CreateLink
                contractType={def.contractType}
                label={copy.makeSelfButton}
                className="mt-4 inline-flex items-center gap-2 self-start px-4 py-2 text-sm font-medium rounded-full bg-primary text-primary-foreground hover:opacity-90"
              />
            </div>
            <div className="border border-border rounded-lg bg-card p-5">
              <h3 className="font-semibold flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" aria-hidden />
                {copy.makeAgentTitle}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{copy.makeAgentText}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                MCP: <code>list_templates</code> (<code>query: &quot;{def.contractType}&quot;</code>),{" "}
                <code>get_template</code>, <code>create_playbook</code>, <code>initiate_negotiation</code>.
              </p>
              <Link
                href="/docs/agent-api"
                className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {copy.makeAgentDocs}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </Link>
            </div>
          </div>
          <pre className="mt-4 text-xs bg-card border border-border rounded-lg p-4 overflow-x-auto">
            <code>{example}</code>
          </pre>
          <div className="mt-4">
            <PriceLine locale={locale} />
          </div>
        </section>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-bold mb-4">{copy.relatedTitle}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={contractPath(locale, r.slug)}
                    className="block border border-border rounded-lg bg-card p-4 hover:border-primary transition-colors"
                  >
                    <span className="font-semibold">{r.page!.heading}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-12 text-sm text-muted-foreground border-t border-border pt-6">{copy.disclaimer}</p>
      </article>
    </ContractsShell>
  );
}
