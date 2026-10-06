// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Contract as one self-contained HTML document: semantic (article, one
 * section per clause with a stable id, dl for parties and definitions),
 * accessible, readable without styles, no scripts and no external assets.
 * Walks the shared outline (`contractOutline.ts`), so it lists exactly what
 * the Markdown lists.
 */

import type { ContractData } from "./generator";
import { buildContractOutline, type OutlineSection } from "./contractOutline";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A paragraph with its single line breaks kept. */
function p(text: string): string {
  return `<p>${text
    .split("\n")
    .map((l) => escapeHtml(l.trim()))
    .filter(Boolean)
    .join("<br>\n")}</p>`;
}

function dl(fields: { label: string; value: string }[]): string {
  if (fields.length === 0) return "";
  return `<dl>\n${fields.map((f) => `<dt>${escapeHtml(f.label)}</dt><dd>${escapeHtml(f.value)}</dd>`).join("\n")}\n</dl>`;
}

function section(s: OutlineSection, level: number): string {
  const h = Math.min(level, 6);
  const title = escapeHtml(s.number ? `${s.number}. ${s.title}` : s.title);
  const parts = [
    `<section id="${s.id}" aria-labelledby="${s.id}-title"${s.number ? ` data-number="${s.number}"` : ""}>`,
    `<h${h} id="${s.id}-title">${title}</h${h}>`,
    ...s.paragraphs.map(p),
  ];
  if (s.definitions?.length) {
    parts.push(
      `<dl>\n${s.definitions
        .map((d) => `<dt><dfn>${escapeHtml(d.term)}</dfn></dt><dd>${escapeHtml(d.definition)}</dd>`)
        .join("\n")}\n</dl>`,
    );
  }
  for (const c of s.children ?? []) parts.push(section(c, level + 1));
  parts.push("</section>");
  return parts.join("\n");
}

const STYLE = `
:root{color-scheme:light dark}
body{font-family:Georgia,"Times New Roman",serif;line-height:1.55;max-width:46rem;margin:2rem auto;padding:0 1rem}
h1{font-size:1.6rem;text-align:center}
h2{font-size:1.2rem;margin-top:2rem;border-bottom:1px solid currentColor;padding-bottom:.2rem}
h3{font-size:1.05rem;margin-top:1.4rem}
dl{display:grid;grid-template-columns:max-content 1fr;gap:.2rem 1rem}
dt{font-weight:bold}dd{margin:0}
.notice{font-style:italic;border-left:3px solid currentColor;padding-left:1rem}
.annex{margin-top:3rem;border-top:2px solid currentColor}
@media print{.annex{break-before:page}}
`;

export function generateContractHtml(data: ContractData): string {
  const o = buildContractOutline(data);
  const lang = escapeHtml(o.lang);
  const body: string[] = [];

  body.push(`<header>\n<h1 id="title">${escapeHtml(o.title)}</h1>\n${dl(o.meta)}\n</header>`);
  if (o.notice.length) {
    body.push(`<section id="notice" class="notice" aria-label="${o.lang === "es" ? "Aviso" : "Notice"}">\n${o.notice.map(p).join("\n")}\n</section>`);
  }
  if (o.preamble) {
    body.push(`<section id="preamble">\n${o.preamble.split(/\n{2,}/).map(p).join("\n")}\n</section>`);
  }

  body.push(
    `<section id="parties" aria-labelledby="parties-title">\n<h2 id="parties-title">${escapeHtml(o.partiesTitle)}</h2>\n${o.parties
      .map(
        (pt) =>
          `<section id="${pt.id}" aria-labelledby="${pt.id}-title">\n<h3 id="${pt.id}-title">${escapeHtml(pt.label)}: ${escapeHtml(pt.name)}</h3>\n${dl(pt.fields)}\n</section>`,
      )
      .join("\n")}\n</section>`,
  );

  for (const s of o.sections) body.push(section(s, 2));

  body.push(
    `<section id="signatures" aria-labelledby="signatures-title">\n<h2 id="signatures-title">${escapeHtml(o.signatures.title)}</h2>\n${o.signatures.intro
      .split(/\n{2,}/)
      .map(p)
      .join("\n")}\n${o.signatures.blocks
      .map(
        (b) =>
          `<section id="${b.id}" aria-labelledby="${b.id}-title">\n<h3 id="${b.id}-title">${escapeHtml(b.label)}</h3>\n${dl(b.fields)}\n</section>`,
      )
      .join("\n")}\n</section>`,
  );

  for (const a of o.annexes) body.push(section(a, 2).replace("<section ", '<section class="annex" '));

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(o.title)}</title>
<style>${STYLE}</style>
</head>
<body>
<article>
${body.join("\n")}
</article>
</body>
</html>
`;
}
