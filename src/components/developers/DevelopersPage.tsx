// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  CONTRACT_GROUPS,
  CONTRACT_PAGES,
  SITE_URL,
  contractPath,
  developersPath,
  loadContractPage,
  type PageLocale,
} from "@/lib/contract-pages";
import { jsonLdScript } from "@/lib/contract-pages-seo";
import { developersJsonLd } from "@/lib/developers-seo";
import { API_KEYS_SETTINGS_PATH } from "@/lib/api-key-scopes";
import {
  MCP_SNIPPETS,
  MCP_URL,
  curlGenerate,
  curlListTypes,
  exampleAnswer,
  type SnippetId,
} from "@/lib/developer-snippets";
import { ContractsShell } from "@/components/contracts/ContractsShell";
import { CodeBlock } from "./CodeBlock";
import { DeveloperPrices } from "./DeveloperPrices";
import { DEVELOPERS_COPY } from "./copy";

const CLIENT_ORDER: SnippetId[] = ["claudeCode", "claudeDesktop", "cursor", "vscode", "generic"];

/** `/developers`: the quick start for developers and startups, prerendered per language. */
export function DevelopersPage({ locale }: { locale: PageLocale }) {
  const copy = DEVELOPERS_COPY[locale];
  const other: PageLocale = locale === "en" ? "es" : "en";
  const contracts = CONTRACT_PAGES.map((def) => ({ def, page: loadContractPage(def.slug, locale) })).filter(
    (c) => c.page,
  );
  const jsonLd = developersJsonLd({
    locale,
    title: copy.metaTitle,
    description: copy.metaDescription,
    howToName: copy.howToName,
    steps: copy.steps,
    breadcrumb: copy.breadcrumb,
    contracts: contracts.map((c) => ({ slug: c.def.slug, name: c.page!.heading })),
  });

  const h2 = "text-2xl font-bold";
  const card = "border border-border rounded-lg bg-card p-5";

  return (
    <ContractsShell locale={locale} alternateHref={developersPath(other)} active="developers">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div lang={locale} className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl md:text-4xl font-bold">{copy.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{copy.lead}</p>

        <section className="mt-10" aria-labelledby="what">
          <h2 id="what" className={h2}>
            {copy.whatTitle}
          </h2>
          <ul className="mt-4 list-disc pl-6 space-y-2">
            {copy.what.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">{copy.whatLimit}</p>
        </section>

        <section className="mt-10" aria-labelledby="price">
          <h2 id="price" className={h2}>
            {copy.priceTitle}
          </h2>
          <div className="mt-4">
            <DeveloperPrices locale={locale} />
          </div>
        </section>

        <section className="mt-10" aria-labelledby="steps">
          <h2 id="steps" className={h2}>
            {copy.stepsTitle}
          </h2>
          <ol className="mt-4 grid gap-4 md:grid-cols-3">
            {copy.steps.map((step, i) => (
              <li key={step.title} id={`step-${i + 1}`} className={card}>
                <p className="text-sm font-semibold text-primary">{i + 1}</p>
                <h3 className="mt-1 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
                {step.link && (
                  <Link
                    href={API_KEYS_SETTINGS_PATH}
                    className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {step.link}
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10" aria-labelledby="call">
          <h2 id="call" className={h2}>
            {copy.callTitle}
          </h2>
          <p className="mt-4 text-muted-foreground">{copy.callIntro}</p>
          <CodeBlock code={curlGenerate(locale)} locale={locale} label={copy.callTitle} />
          <h3 className="mt-6 font-semibold">{copy.answerTitle}</h3>
          <CodeBlock code={exampleAnswer(locale)} locale={locale} label={copy.answerTitle} />
          <h3 className="mt-6 font-semibold">{copy.callNotesTitle}</h3>
          <ul className="mt-3 list-disc pl-6 space-y-2 text-sm">
            {copy.callNotes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="mcp">
          <h2 id="mcp" className={h2}>
            {copy.mcpTitle}
          </h2>
          <p className="mt-4 text-muted-foreground">{copy.mcpIntro}</p>
          <CodeBlock code={MCP_URL} locale={locale} label="MCP" />
          <div className="mt-6 space-y-6">
            {CLIENT_ORDER.map((id) => (
              <div key={id}>
                <h3 className="font-semibold">{copy.clients[id].name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{copy.clients[id].note}</p>
                <CodeBlock code={MCP_SNIPPETS[id]} locale={locale} label={copy.clients[id].name} />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="rest">
          <h2 id="rest" className={h2}>
            {copy.restTitle}
          </h2>
          <p className="mt-4 text-muted-foreground">{copy.restIntro}</p>
          <CodeBlock code={`${curlListTypes(locale)}\n\n${curlGenerate(locale)}`} locale={locale} label={copy.restTitle} />
          <Link
            href="/docs/agent-api"
            className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {copy.restDocs}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </Link>
        </section>

        <section className="mt-10" aria-labelledby="types">
          <h2 id="types" className={h2}>
            {copy.typesTitle}
          </h2>
          <p className="mt-4 text-muted-foreground">{copy.typesIntro}</p>
          {CONTRACT_GROUPS.map((group) => {
            const items = contracts.filter((c) => c.def.group === group.id);
            if (items.length === 0) return null;
            return (
              <div key={group.id} className="mt-6">
                <h3 className="font-semibold">{group.name[locale]}</h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {items.map(({ def, page }) => (
                    <li key={def.slug} className="text-sm">
                      <Link href={contractPath(locale, def.slug)} className="text-primary hover:underline">
                        {page!.heading}
                      </Link>{" "}
                      <span className="text-muted-foreground">
                        ({copy.codeLabel}: <code>{def.contractType}</code>)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <section className="mt-10" aria-labelledby="machines">
          <h2 id="machines" className={h2}>
            {copy.moreTitle}
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {copy.more.map((item) => (
              <li key={item.path}>
                {item.label}:{" "}
                <a href={item.path} className="text-primary hover:underline break-all">
                  {`${SITE_URL}${item.path}`}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-12 text-sm text-muted-foreground border-t border-border pt-6">{copy.disclaimer}</p>
      </div>
    </ContractsShell>
  );
}
