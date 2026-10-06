// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The developer quick start as data: one object built from the copy, the
 * contract types (`listContractTypes`, the same source as the JSON
 * endpoint) and the price facts (the same source as /pricing). The HTML
 * page and its Markdown twin both render this object, so they cannot say
 * different things.
 */

import { DEVELOPERS_COPY, SECTION_ORDER, type SectionId } from "@/components/developers/copy";
import { JURISDICTION_NAMES, LANGUAGE_NAMES } from "@/components/contracts/copy";
import { CONTRACT_PAGES, SITE_URL, contractPath, developersPath, type PageLocale } from "./contract-pages-paths";
import { COMMON_CONTRACTS, agentBlockPath, agentContractType } from "./agent-discovery";
import { describeInput, requiredInputs } from "./agent-inputs";
import { API_KEYS_SETTINGS_PATH } from "./api-key-scopes";
import type { PricingFacts } from "./pricing-page";
import {
  MCP_SNIPPETS,
  MCP_URL,
  curlGenerate,
  curlListTypes,
  exampleAnswer,
  type SnippetId,
} from "./developer-snippets";

/** The fields of a contract type the page shows (a subset of the endpoint's). */
export interface DocContractType {
  contractType: string;
  slug: string | null;
  name: string;
  group: { id: string; name: string };
  governingLaws: string[];
  languages: string[];
  inputs: { id: string; required: boolean; onlyUnder?: string[]; default?: string }[];
}

export interface DocTypeRow {
  code: string;
  name: string;
  href: string | null;
  laws: string;
  languages: string;
  inputs: string[];
}

/** One row of "Contracts for AI agents": a common contract and its one-call example. */
export interface DocAgentRow {
  rank: number;
  code: string;
  name: string;
  /** The guide. */
  href: string;
  /** The guide's agent block (the one call pre-filled for this contract). */
  callHref: string;
  inputs: string[];
}

/** The most common contracts, in order, from the same source as the guides' agent blocks. */
export function agentRows(locale: PageLocale): DocAgentRow[] {
  const copy = DEVELOPERS_COPY[locale];
  return COMMON_CONTRACTS.flatMap((code, i) => {
    const page = CONTRACT_PAGES.find((p) => p.contractType === code);
    if (!page) return [];
    return [
      {
        rank: i + 1,
        code,
        name: copy.commonNames[code] ?? code,
        href: contractPath(locale, page.slug),
        callHref: agentBlockPath(locale, page.slug),
        inputs: requiredInputs(agentContractType(code)?.requiredInputs).map((input) =>
          describeInput(input, locale, lawName(locale)),
        ),
      },
    ];
  });
}

export interface DevelopersDoc {
  locale: PageLocale;
  url: string;
  markdownUrl: string;
  title: string;
  lead: string;
  tocTitle: string;
  toc: { id: SectionId; label: string }[];
  headings: Record<SectionId, string>;
  steps: { title: string; body: string; link: { label: string; href: string } | null }[];
  oneCall: {
    intro: string;
    requestTitle: string;
    request: string;
    fieldsTitle: string;
    fields: { name: string; text: string }[];
    answerTitle: string;
    answer: string;
    notesTitle: string;
    notes: string[];
  };
  mcp: {
    intro: string;
    url: string;
    clientsTitle: string;
    clients: { id: SnippetId; name: string; note: string; code: string }[];
    toolsTitle: string;
    tools: { name: string; text: string }[];
  };
  agents: {
    intro: string;
    caption: string;
    columns: { rank: string; name: string; code: string; inputs: string; call: string };
    callLabel: string;
    rows: DocAgentRow[];
  };
  rest: {
    intro: string;
    columns: { method: string; path: string; what: string; key: string };
    rows: { method: string; path: string; what: string; key: string }[];
    exampleTitle: string;
    example: string;
    docs: { label: string; href: string };
  };
  types: {
    intro: string;
    caption: string;
    columns: { name: string; code: string; laws: string; languages: string; inputs: string };
    groups: { id: string; name: string; rows: DocTypeRow[] }[];
    empty: string;
    count: number;
  };
  formats: {
    intro: string;
    columns: { format: string; type: string; for: string; how: string };
    rows: { format: string; type: string; for: string; how: string }[];
  };
  pricing: { lines: string[]; link: { label: string; href: string } | null };
  machines: { label: string; href: string }[];
  disclaimer: string;
}

export const CLIENT_ORDER: SnippetId[] = ["claudeCode", "claudeDesktop", "cursor", "vscode", "generic"];

export function priceLines(
  locale: PageLocale,
  opts: { billingOn: boolean; facts: PricingFacts | null; currency: "usd" | "eur" },
): string[] {
  const copy = DEVELOPERS_COPY[locale];
  if (!opts.billingOn) return [copy.priceSelfHost];
  const contract = opts.facts?.contract[opts.currency] ?? null;
  const pack = opts.facts?.pack[opts.currency] ?? null;
  const size = opts.facts?.packSize ?? 10;
  return [
    contract ? copy.pricePaid(contract) : copy.pricePaidNoAmount,
    pack ? copy.pricePack(size, pack) : copy.pricePackNoAmount(size),
  ];
}

function list(values: string[], names: Record<string, Record<PageLocale, string>>, locale: PageLocale): string {
  return values.map((v) => names[v]?.[locale] ?? v).join(", ");
}

const lawName = (locale: PageLocale) => (law: string) => JURISDICTION_NAMES[law]?.[locale] ?? law;

export function typeRow(t: DocContractType, locale: PageLocale): DocTypeRow {
  const inputs = requiredInputs(t.inputs).map((i) => describeInput(i, locale, lawName(locale)));
  return {
    code: t.contractType,
    name: t.name,
    href: t.slug ? contractPath(locale, t.slug) : null,
    laws: list(t.governingLaws, JURISDICTION_NAMES, locale),
    languages: list(t.languages, LANGUAGE_NAMES, locale),
    inputs,
  };
}

export function buildDevelopersDoc(opts: {
  locale: PageLocale;
  types: DocContractType[];
  prices: string[];
  billingOn: boolean;
}): DevelopersDoc {
  const { locale } = opts;
  const copy = DEVELOPERS_COPY[locale];
  const path = developersPath(locale);

  const groups: DevelopersDoc["types"]["groups"] = [];
  for (const t of opts.types) {
    let g = groups.find((x) => x.id === t.group.id);
    if (!g) {
      g = { id: t.group.id, name: t.group.name, rows: [] };
      groups.push(g);
    }
    g.rows.push(typeRow(t, locale));
  }

  return {
    locale,
    url: `${SITE_URL}${path}`,
    markdownUrl: `${SITE_URL}${path}.md`,
    title: copy.title,
    lead: copy.lead,
    tocTitle: copy.tocTitle,
    toc: SECTION_ORDER.map((id) => ({ id, label: copy.tocLabels[id] })),
    headings: copy.sections,
    steps: copy.steps.map((s) => ({
      title: s.title,
      body: s.body,
      link: s.link ? { label: s.link, href: API_KEYS_SETTINGS_PATH } : null,
    })),
    oneCall: {
      intro: copy.oneCallIntro,
      requestTitle: copy.requestTitle,
      request: curlGenerate(locale),
      fieldsTitle: copy.fieldsTitle,
      fields: copy.fields,
      answerTitle: copy.answerTitle,
      answer: exampleAnswer(locale),
      notesTitle: copy.notesTitle,
      notes: copy.notes,
    },
    mcp: {
      intro: copy.mcpIntro,
      url: MCP_URL,
      clientsTitle: copy.clientsTitle,
      clients: CLIENT_ORDER.map((id) => ({ id, name: copy.clients[id].name, note: copy.clients[id].note, code: MCP_SNIPPETS[id] })),
      toolsTitle: copy.toolsTitle,
      tools: copy.tools,
    },
    agents: {
      intro: copy.agentsIntro,
      caption: copy.agentsCaption,
      columns: copy.agentsColumns,
      callLabel: copy.agentsCallLink,
      rows: agentRows(locale),
    },
    rest: {
      intro: copy.restIntro,
      columns: copy.restColumns,
      rows: copy.restRows.map((r) => ({ ...r, key: r.key ? copy.keyYes : copy.keyNo })),
      exampleTitle: copy.restExampleTitle,
      example: `${curlListTypes(locale)}\n\n${curlGenerate(locale)}`,
      docs: { label: copy.restDocs, href: "/docs/agent-api" },
    },
    types: {
      intro: copy.typesIntro,
      caption: copy.typesCaption,
      columns: copy.typesColumns,
      groups,
      empty: copy.typesEmpty,
      count: opts.types.length,
    },
    formats: { intro: copy.formatsIntro, columns: copy.formatsColumns, rows: copy.formats },
    pricing: {
      lines: opts.prices,
      link: opts.billingOn ? { label: copy.pricingLink, href: "/pricing" } : null,
    },
    machines: copy.machines.map((m) => ({ label: m.label, href: m.path })),
    disclaimer: copy.disclaimer,
  };
}

// ---------------------------------------------------------------------------
// Markdown twin

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const abs = (href: string) => (href.startsWith("http") ? href : `${SITE_URL}${href}`);
const fence = (code: string, lang = "") => `\`\`\`${lang}\n${code}\n\`\`\``;

export function developersMarkdown(doc: DevelopersDoc): string {
  const h = doc.headings;
  const out: string[] = [];
  out.push(`# ${doc.title}`, "", doc.lead, "", `Source: ${doc.url}`, "");

  out.push(`## ${doc.tocTitle}`, "");
  for (const t of doc.toc) out.push(`- [${t.label}](#${t.id})`);
  out.push("");

  out.push(`<a id="steps"></a>`, "", `## ${h.steps}`, "");
  doc.steps.forEach((s, i) => {
    out.push(`${i + 1}. **${s.title}.** ${s.body}${s.link ? ` [${s.link.label}](${abs(s.link.href)})` : ""}`);
  });
  out.push("");

  out.push(`<a id="one-call"></a>`, "", `## ${h["one-call"]}`, "", doc.oneCall.intro, "");
  out.push(`### ${doc.oneCall.requestTitle}`, "", fence(doc.oneCall.request, "sh"), "");
  out.push(`### ${doc.oneCall.fieldsTitle}`, "");
  for (const f of doc.oneCall.fields) out.push(`- \`${f.name}\`: ${f.text}`);
  out.push("", `### ${doc.oneCall.answerTitle}`, "", fence(doc.oneCall.answer, "json"), "");
  out.push(`### ${doc.oneCall.notesTitle}`, "");
  for (const n of doc.oneCall.notes) out.push(`- ${n}`);
  out.push("");

  out.push(`<a id="mcp"></a>`, "", `## ${h.mcp}`, "", doc.mcp.intro, "", fence(doc.mcp.url), "");
  out.push(`### ${doc.mcp.clientsTitle}`, "");
  for (const c of doc.mcp.clients) {
    out.push(`#### ${c.name}`, "", c.note, "", fence(c.code, c.id === "claudeCode" ? "sh" : "json"), "");
  }
  out.push(`### ${doc.mcp.toolsTitle}`, "");
  for (const t of doc.mcp.tools) out.push(`- \`${t.name}\`: ${t.text}`);
  out.push("");

  out.push(`<a id="agents"></a>`, "", `## ${h.agents}`, "", doc.agents.intro, "");
  const ac = doc.agents.columns;
  out.push(`| ${ac.rank} | ${ac.name} | ${ac.code} | ${ac.inputs} | ${ac.call} |`, "| --- | --- | --- | --- | --- |");
  for (const r of doc.agents.rows) {
    const inputs = r.inputs.length ? r.inputs.map((i) => `\`${cell(i)}\``).join(", ") : DEVELOPERS_COPY[doc.locale].inputsNone;
    out.push(
      `| ${r.rank} | [${cell(r.name)}](${abs(r.href)}) | \`${r.code}\` | ${inputs} | [${doc.agents.callLabel}](${abs(r.callHref)}) |`,
    );
  }
  out.push("");

  out.push(`<a id="rest"></a>`, "", `## ${h.rest}`, "", doc.rest.intro, "");
  const rc = doc.rest.columns;
  out.push(`| ${rc.method} | ${rc.path} | ${rc.what} | ${rc.key} |`, "| --- | --- | --- | --- |");
  for (const r of doc.rest.rows) out.push(`| ${r.method} | \`${cell(r.path)}\` | ${cell(r.what)} | ${r.key} |`);
  out.push("", `### ${doc.rest.exampleTitle}`, "", fence(doc.rest.example, "sh"), "");
  out.push(`[${doc.rest.docs.label}](${abs(doc.rest.docs.href)})`, "");

  out.push(`<a id="contract-types"></a>`, "", `## ${h["contract-types"]}`, "", doc.types.intro, "");
  if (doc.types.count === 0) {
    out.push(doc.types.empty, "");
  } else {
    const tc = doc.types.columns;
    for (const g of doc.types.groups) {
      out.push(`### ${g.name}`, "");
      out.push(`| ${tc.name} | ${tc.code} | ${tc.laws} | ${tc.languages} | ${tc.inputs} |`, "| --- | --- | --- | --- | --- |");
      for (const r of g.rows) {
        const name = r.href ? `[${cell(r.name)}](${abs(r.href)})` : cell(r.name);
        const inputs = r.inputs.length ? r.inputs.map((i) => `\`${cell(i)}\``).join(", ") : DEVELOPERS_COPY[doc.locale].inputsNone;
        out.push(`| ${name} | \`${r.code}\` | ${cell(r.laws)} | ${cell(r.languages)} | ${inputs} |`);
      }
      out.push("");
    }
  }

  out.push(`<a id="formats"></a>`, "", `## ${h.formats}`, "", doc.formats.intro, "");
  const fc = doc.formats.columns;
  out.push(`| ${fc.format} | ${fc.type} | ${fc.for} | ${fc.how} |`, "| --- | --- | --- | --- |");
  for (const r of doc.formats.rows) out.push(`| ${r.format} | \`${r.type}\` | ${cell(r.for)} | \`${cell(r.how)}\` |`);
  out.push("");

  out.push(`<a id="pricing"></a>`, "", `## ${h.pricing}`, "");
  for (const l of doc.pricing.lines) out.push(l, "");
  if (doc.pricing.link) out.push(`[${doc.pricing.link.label}](${abs(doc.pricing.link.href)})`, "");

  out.push(`<a id="machines"></a>`, "", `## ${h.machines}`, "");
  for (const m of doc.machines) out.push(`- ${m.label}: ${abs(m.href)}`);
  out.push("", "---", "", doc.disclaimer, "");

  return out.join("\n");
}
