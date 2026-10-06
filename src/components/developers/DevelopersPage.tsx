// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { developersPath, type PageLocale } from "@/lib/contract-pages-paths";
import { jsonLdScript } from "@/lib/contract-pages-seo";
import { developersJsonLd } from "@/lib/developers-seo";
import type { DevelopersDoc } from "@/lib/developers-doc";
import { ContractsShell } from "@/components/contracts/ContractsShell";
import { ClientTabs } from "./ClientTabs";
import { CodeBlock } from "./CodeBlock";
import { DEVELOPERS_COPY } from "./copy";

/*
 * Tables keep one shape on every screen: a real table from md up; below
 * it, each row becomes an identical card whose cells carry their column
 * name (data-label). Same markup, so readers and crawlers see one table.
 */
const TABLE = "w-full text-sm border-collapse max-md:block";
const THEAD = "max-md:sr-only";
const TBODY = "max-md:block";
const TR = "border-t border-border max-md:block max-md:border max-md:rounded-lg max-md:bg-card max-md:p-3 max-md:mb-3";
const TH_COL = "text-left font-semibold py-2 pr-4 align-bottom text-muted-foreground";
const CELL =
  "py-2 pr-4 align-top text-left max-md:block max-md:py-1 max-md:pr-0 max-md:before:content-[attr(data-label)] max-md:before:block max-md:before:text-xs max-md:before:text-muted-foreground";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-14 scroll-mt-24">
      <h2 id={`${id}-title`} className="text-2xl font-bold">
        <a href={`#${id}`} className="hover:underline">
          {title}
        </a>
      </h2>
      {children}
    </section>
  );
}

/** `/developers`: the quick start, rendered from the same data as `/developers.md`. */
export function DevelopersPage({ doc }: { doc: DevelopersDoc }) {
  const locale: PageLocale = doc.locale;
  const copy = DEVELOPERS_COPY[locale];
  const other: PageLocale = locale === "en" ? "es" : "en";
  const h = doc.headings;
  const tc = doc.types.columns;
  const jsonLd = developersJsonLd(doc, {
    description: copy.metaDescription,
    howToName: copy.howToName,
    apiName: copy.apiName,
    apiDescription: copy.apiDescription,
    breadcrumb: copy.breadcrumb,
  });

  return (
    <ContractsShell locale={locale} alternateHref={developersPath(other)} active="developers">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <article lang={locale} className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Top block: what it is, the three steps, the contents. */}
        <header>
          <h1 className="text-3xl md:text-4xl font-bold">{doc.title}</h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-3xl">{doc.lead}</p>
        </header>

        <section id="steps" aria-labelledby="steps-title" className="mt-8 scroll-mt-24">
          <h2 id="steps-title" className="sr-only">
            {h.steps}
          </h2>
          <ol className="grid gap-3 md:grid-cols-3">
            {doc.steps.map((s, i) => (
              <li key={s.title} className="border border-border rounded-lg bg-card p-4 flex gap-3">
                <span
                  aria-hidden
                  className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                  {s.link && (
                    <Link href={s.link.href} className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                      {s.link.label}
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <nav aria-labelledby="toc-title" className="mt-8 border-y border-border py-4">
          <h2 id="toc-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {doc.tocTitle}
          </h2>
          <ol className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {doc.toc.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="text-primary hover:underline">
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Section id="one-call" title={h["one-call"]}>
          <p className="mt-3 text-muted-foreground">{doc.oneCall.intro}</p>
          <CodeBlock code={doc.oneCall.request} locale={locale} label={doc.oneCall.requestTitle} />
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="min-w-0">
              <h3 className="font-semibold">{doc.oneCall.fieldsTitle}</h3>
              <dl className="mt-3 space-y-2 text-sm">
                {doc.oneCall.fields.map((f) => (
                  <div key={f.name} className="grid grid-cols-[8.5rem_1fr] gap-3 max-sm:grid-cols-1 max-sm:gap-0">
                    <dt>
                      <code className="font-semibold">{f.name}</code>
                    </dt>
                    <dd className="text-muted-foreground">{f.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">{doc.oneCall.answerTitle}</h3>
              <CodeBlock code={doc.oneCall.answer} locale={locale} label={doc.oneCall.answerTitle} />
            </div>
          </div>
          <h3 className="mt-6 font-semibold">{doc.oneCall.notesTitle}</h3>
          <ul className="mt-2 list-disc pl-6 space-y-1 text-sm">
            {doc.oneCall.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Section>

        <Section id="mcp" title={h.mcp}>
          <p className="mt-3 text-muted-foreground">{doc.mcp.intro}</p>
          <CodeBlock code={doc.mcp.url} locale={locale} label="MCP" />
          <h3 className="mt-6 font-semibold">{doc.mcp.clientsTitle}</h3>
          <ClientTabs clients={doc.mcp.clients} locale={locale} label={doc.mcp.clientsTitle} />
          <h3 className="mt-6 font-semibold">{doc.mcp.toolsTitle}</h3>
          <dl className="mt-3 space-y-2 text-sm">
            {doc.mcp.tools.map((t) => (
              <div key={t.name} className="grid grid-cols-[minmax(0,22rem)_1fr] gap-3 max-sm:grid-cols-1 max-sm:gap-0">
                <dt>
                  <code className="font-semibold break-words">{t.name}</code>
                </dt>
                <dd className="text-muted-foreground">{t.text}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="rest" title={h.rest}>
          <p className="mt-3 text-muted-foreground">{doc.rest.intro}</p>
          <table className={`${TABLE} mt-4`}>
            <thead className={THEAD}>
              <tr>
                <th scope="col" className={TH_COL}>{doc.rest.columns.method}</th>
                <th scope="col" className={TH_COL}>{doc.rest.columns.path}</th>
                <th scope="col" className={TH_COL}>{doc.rest.columns.what}</th>
                <th scope="col" className={TH_COL}>{doc.rest.columns.key}</th>
              </tr>
            </thead>
            <tbody className={TBODY}>
              {doc.rest.rows.map((r) => (
                <tr key={`${r.method} ${r.path}`} className={TR}>
                  <td data-label={doc.rest.columns.method} className={`${CELL} font-mono text-xs`}>{r.method}</td>
                  <th scope="row" data-label={doc.rest.columns.path} className={`${CELL} font-normal`}>
                    <code className="text-xs break-all">{r.path}</code>
                  </th>
                  <td data-label={doc.rest.columns.what} className={CELL}>{r.what}</td>
                  <td data-label={doc.rest.columns.key} className={CELL}>{r.key}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-6 font-semibold">{doc.rest.exampleTitle}</h3>
          <CodeBlock code={doc.rest.example} locale={locale} label="curl" />
          <Link href={doc.rest.docs.href} className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
            {doc.rest.docs.label}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </Link>
        </Section>

        <Section id="contract-types" title={h["contract-types"]}>
          <p className="mt-3 text-muted-foreground">{doc.types.intro}</p>
          {doc.types.count === 0 ? (
            <p className="mt-4 text-sm">{doc.types.empty}</p>
          ) : (
            <table className={`${TABLE} mt-4`}>
              <caption className="sr-only">{doc.types.caption}</caption>
              <thead className={THEAD}>
                <tr>
                  <th scope="col" className={TH_COL}>{tc.name}</th>
                  <th scope="col" className={TH_COL}>{tc.code}</th>
                  <th scope="col" className={TH_COL}>{tc.laws}</th>
                  <th scope="col" className={TH_COL}>{tc.languages}</th>
                  <th scope="col" className={TH_COL}>{tc.inputs}</th>
                </tr>
              </thead>
              {doc.types.groups.map((g) => (
                <tbody key={g.id} id={`group-${g.id}`} className={TBODY}>
                  <tr className="max-md:block">
                    <th
                      scope="rowgroup"
                      colSpan={5}
                      className="text-left text-base font-bold pt-6 pb-2 max-md:block max-md:pt-4"
                    >
                      {g.name}
                    </th>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.code} id={`type-${r.code}`} className={TR}>
                      <th scope="row" data-label={tc.name} className={`${CELL} font-medium`}>
                        {r.href ? (
                          <Link href={r.href} className="text-primary hover:underline">
                            {r.name}
                          </Link>
                        ) : (
                          r.name
                        )}
                      </th>
                      <td data-label={tc.code} className={CELL}>
                        <code className="text-xs break-all">{r.code}</code>
                      </td>
                      <td data-label={tc.laws} className={CELL}>{r.laws}</td>
                      <td data-label={tc.languages} className={CELL}>{r.languages}</td>
                      <td data-label={tc.inputs} className={CELL}>
                        {r.inputs.length === 0 ? (
                          <span className="text-muted-foreground">{copy.inputsNone}</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {r.inputs.map((i) => (
                              <li key={i}>
                                <code className="text-xs break-words">{i}</code>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          )}
        </Section>

        <Section id="formats" title={h.formats}>
          <p className="mt-3 text-muted-foreground">{doc.formats.intro}</p>
          <table className={`${TABLE} mt-4`}>
            <thead className={THEAD}>
              <tr>
                <th scope="col" className={TH_COL}>{doc.formats.columns.format}</th>
                <th scope="col" className={TH_COL}>{doc.formats.columns.type}</th>
                <th scope="col" className={TH_COL}>{doc.formats.columns.for}</th>
                <th scope="col" className={TH_COL}>{doc.formats.columns.how}</th>
              </tr>
            </thead>
            <tbody className={TBODY}>
              {doc.formats.rows.map((r) => (
                <tr key={r.format} className={TR}>
                  <th scope="row" data-label={doc.formats.columns.format} className={`${CELL} font-medium`}>{r.format}</th>
                  <td data-label={doc.formats.columns.type} className={CELL}><code className="text-xs">{r.type}</code></td>
                  <td data-label={doc.formats.columns.for} className={CELL}>{r.for}</td>
                  <td data-label={doc.formats.columns.how} className={CELL}><code className="text-xs break-words">{r.how}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section id="pricing" title={h.pricing}>
          <div className="mt-3 space-y-2 text-muted-foreground">
            {doc.pricing.lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
          {doc.pricing.link && (
            <Link href={doc.pricing.link.href} className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              {doc.pricing.link.label}
              <ArrowRight className="w-3.5 h-3.5" aria-hidden />
            </Link>
          )}
        </Section>

        <Section id="machines" title={h.machines}>
          <ul className="mt-3 space-y-2 text-sm">
            {doc.machines.map((m) => (
              <li key={m.href} className="grid grid-cols-[minmax(0,20rem)_1fr] gap-3 max-sm:grid-cols-1 max-sm:gap-0">
                <span>{m.label}</span>
                <a href={m.href} className="text-primary hover:underline break-all">
                  <code className="text-xs">{m.href}</code>
                </a>
              </li>
            ))}
          </ul>
        </Section>

        <footer className="mt-14 text-sm text-muted-foreground border-t border-border pt-6">{doc.disclaimer}</footer>
      </article>
    </ContractsShell>
  );
}
