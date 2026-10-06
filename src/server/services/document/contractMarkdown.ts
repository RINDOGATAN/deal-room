// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Contract as Markdown: for agents and tools that read text. Headings per
 * section, numbered clauses, a parties block, no layout. Walks the shared
 * outline (`contractOutline.ts`), so it lists exactly what the HTML lists.
 */

import type { ContractData } from "./generator";
import { buildContractOutline, type OutlineSection } from "./contractOutline";

/** Keep text from turning into Markdown it was never meant to be. */
export function escapeMarkdownLine(line: string): string {
  return line
    .replace(/\\/g, "\\\\")
    .replace(/^(\s*)(#{1,6}\s)/, "$1\\$2")
    // Lists in the text ("1. ", "- ") stay lists; a quote marker would not.
    .replace(/^(\s*)(>)/, "$1\\$2")
    // Underscore runs are fill-in blanks ("[____]"); left as written so the
    // text stays readable as plain text.
    .replace(/([`<])/g, "\\$1");
}

/** A paragraph: escaped lines joined with hard line breaks. */
function para(text: string): string {
  return text
    .split("\n")
    .map((l) => escapeMarkdownLine(l.trim()))
    .filter(Boolean)
    .join("  \n");
}

function heading(level: number, s: OutlineSection): string {
  const title = escapeMarkdownLine(s.title);
  return `${"#".repeat(level)} ${s.number ? `${s.number}. ${title}` : title}`;
}

function section(s: OutlineSection, level: number, out: string[]) {
  out.push(heading(level, s), "");
  for (const p of s.paragraphs) out.push(para(p), "");
  for (const d of s.definitions ?? []) {
    out.push(`**${escapeMarkdownLine(d.term)}**: ${para(d.definition)}`, "");
  }
  for (const c of s.children ?? []) section(c, level + 1, out);
}

export function generateContractMarkdown(data: ContractData): string {
  const o = buildContractOutline(data);
  const out: string[] = [];

  out.push(`# ${escapeMarkdownLine(o.title)}`, "");
  for (const m of o.meta) out.push(`- **${m.label}:** ${escapeMarkdownLine(m.value)}`);
  out.push("");

  for (const n of o.notice) out.push(`> ${para(n)}`, "");
  if (o.preamble) {
    for (const p of o.preamble.split(/\n{2,}/)) out.push(para(p), "");
  }

  out.push(`## ${o.partiesTitle}`, "");
  for (const p of o.parties) {
    out.push(`### ${escapeMarkdownLine(p.label)}: ${escapeMarkdownLine(p.name)}`, "");
    for (const f of p.fields) out.push(`- **${f.label}:** ${escapeMarkdownLine(f.value)}`);
    out.push("");
  }

  for (const s of o.sections) section(s, 2, out);

  out.push(`## ${o.signatures.title}`, "");
  for (const p of o.signatures.intro.split(/\n{2,}/)) out.push(para(p), "");
  for (const b of o.signatures.blocks) {
    out.push(`### ${escapeMarkdownLine(b.label)}`, "");
    for (const f of b.fields) out.push(`- **${f.label}:** ${escapeMarkdownLine(f.value)}`);
    out.push("");
  }

  for (const a of o.annexes) {
    out.push("---", "");
    section(a, 2, out);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
