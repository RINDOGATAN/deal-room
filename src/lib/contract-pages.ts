// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Public contract guide pages: `/contracts` and `/contracts/<slug>` in
 * English, `/es/contracts/...` in Spanish.
 *
 * The wording lives in `content/contracts/<slug>.<locale>.md` so it can be
 * edited without code (see the README there). This module reads those
 * files and turns the Markdown into HTML; the page list itself is in
 * `contract-pages-paths.ts`. It reads the file system, so it runs on the
 * server and at build time only.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { PageLocale } from "./contract-pages-paths";

export * from "./contract-pages-paths";

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

// ---------------------------------------------------------------------------
// Page content

export interface FaqItem {
  q: string;
  a: string;
}

export interface ContractPageContent {
  slug: string;
  locale: PageLocale;
  contractType: string;
  title: string;
  description: string;
  heading: string;
  summary: string;
  related: string[];
  faq: FaqItem[];
  /** The Markdown body. */
  body: string;
  /** The body as HTML. */
  html: string;
  /** Words in the body. */
  wordCount: number;
}

const CONTENT_DIR = join(process.cwd(), "content", "contracts");

export function contentFile(slug: string, locale: PageLocale): string {
  return join(CONTENT_DIR, `${slug}.${locale}.md`);
}

/**
 * Front matter: `key: "text"`, `key: ["a", "b"]`, and `faq:` followed by
 * `  - q: "…"` / `    a: "…"` pairs. Values are JSON strings or arrays.
 */
export function parseFrontMatter(source: string): { data: Record<string, unknown>; body: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: source };
  const data: Record<string, unknown> = {};
  let list: Record<string, string>[] | null = null;

  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const item = line.match(/^\s+-\s+(\w+):\s*(.*)$/);
    const cont = line.match(/^\s+(\w+):\s*(.*)$/);
    const top = line.match(/^(\w+):\s*(.*)$/);
    if (item && list) {
      list.push({ [item[1]]: parseValue(item[2]) as string });
    } else if (cont && list && list.length > 0) {
      list[list.length - 1][cont[1]] = parseValue(cont[2]) as string;
    } else if (top) {
      if (top[2].trim() === "") {
        list = [];
        data[top[1]] = list;
      } else {
        list = null;
        data[top[1]] = parseValue(top[2]);
      }
    } else {
      throw new Error(`Front matter line not understood: ${line}`);
    }
  }
  return { data, body: match[2] };
}

function parseValue(raw: string): unknown {
  const value = raw.trim();
  if (value.startsWith('"') || value.startsWith("[")) return JSON.parse(value);
  return value;
}

const contentCache = new Map<string, ContractPageContent | null>();

/** A page's content in a language, or null when the file is missing. */
export function loadContractPage(slug: string, locale: PageLocale): ContractPageContent | null {
  const key = `${slug}.${locale}`;
  if (contentCache.has(key)) return contentCache.get(key)!;
  const file = contentFile(slug, locale);
  if (!existsSync(file)) {
    contentCache.set(key, null);
    return null;
  }
  const { data, body } = parseFrontMatter(readFileSync(file, "utf8"));
  const text = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : "");
  const faq = Array.isArray(data.faq)
    ? (data.faq as Record<string, unknown>[])
        .filter((f) => typeof f.q === "string" && typeof f.a === "string")
        .map((f) => ({ q: f.q as string, a: f.a as string }))
    : [];
  const page: ContractPageContent = {
    slug,
    locale,
    contractType: text("contractType"),
    title: text("title"),
    description: text("description"),
    heading: text("heading"),
    summary: text("summary"),
    related: strings(data.related),
    faq,
    body,
    html: markdownToHtml(body),
    wordCount: countWords(body),
  };
  contentCache.set(key, page);
  return page;
}

export function countWords(markdown: string): number {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*`>_-]/g, " ");
  return plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

// ---------------------------------------------------------------------------
// Markdown → HTML (the small subset the content README allows)

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Only site paths, anchors and https links are kept as links. */
function safeHref(href: string): string | null {
  return /^(\/(?!\/)|#|https:\/\/)/.test(href) ? href : null;
}

function inline(text: string): string {
  const codes: string[] = [];
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, href: string) => {
      const safe = safeHref(href.replace(/&amp;/g, "&"));
      if (!safe) return label;
      const external = safe.startsWith("https://");
      return `<a href="${escapeHtml(safe)}"${external ? ' rel="noopener"' : ""}>${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>");
  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)]);
}

/** Heading text → id for in-page links. */
export function headingId(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (listType) html.push(`<${listType}>${listItems.map((i) => `<li>${inline(i)}</li>`).join("")}</${listType}>`);
    listType = null;
    listItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trim().startsWith("```"); i++) code.push(lines[i]);
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{2,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const text = heading[2].trim();
      html.push(`<h${level} id="${headingId(text)}">${inline(text)}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? "ul" : "ol";
      if (listType && listType !== type) flushList();
      listType = type;
      listItems.push((bullet ?? numbered)![1]);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    if (listType && /^\s{2,}\S/.test(line)) {
      // A wrapped list item.
      listItems[listItems.length - 1] += ` ${line.trim()}`;
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  return html.join("\n");
}

/** The `##` headings of a body, for the table of contents. */
export function sectionHeadings(markdown: string): { id: string; text: string }[] {
  return [...markdown.matchAll(/^##\s+(.*)$/gm)].map((m) => ({ id: headingId(m[1].trim()), text: m[1].trim() }));
}
