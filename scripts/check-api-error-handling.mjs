#!/usr/bin/env node
/**
 * Regression guard for API route error handling.
 *
 * Scans src/app/api/** /route.ts for patterns that leak raw error bodies to
 * clients — specifically the antipattern that caused the Neon "Control plane
 * request failed" JSON to reach end users. Exits non-zero on any violation.
 *
 * Run via: npm run check:api
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const API_DIR = join(ROOT, "src/app/api");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

// Given the index of `{` opening a block, return the substring inside it
// (exclusive of the braces). Naive brace matcher — good enough for real code,
// can be tripped by braces inside strings/comments but false positives are rare.
function extractBalancedBody(src, openBraceAfterIdx) {
  let depth = 1;
  let i = openBraceAfterIdx;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    i++;
  }
  return depth === 0 ? src.slice(openBraceAfterIdx, i - 1) : null;
}

function findHandlers(src) {
  const handlerRe =
    /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{/g;
  const out = [];
  let m;
  while ((m = handlerRe.exec(src)) !== null) {
    const method = m[1];
    const bodyStart = m.index + m[0].length;
    const body = extractBalancedBody(src, bodyStart);
    if (body === null) continue;
    const lineNum = src.slice(0, m.index).split("\n").length;
    out.push({ method, body, bodyStartIdx: bodyStart, line: lineNum });
  }
  return out;
}

const rules = [
  {
    id: "raw-error-message",
    description:
      "NextResponse.json returns raw `error.message` — must use apiError(error, fallback)",
    check(src) {
      const hits = [];
      const lines = src.split("\n");
      // Only flag the `error` variable name — the codebase convention for outer
      // catch blocks. Inner typed catches use `e` or `err` (e.g. ApiScopeError).
      const re = /\{\s*error:\s*error\.message\b/;
      const ternaryRe = /error\s+instanceof\s+Error\s*\?\s*error\.message/;
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i]) || ternaryRe.test(lines[i])) {
          hits.push({ line: i + 1, text: lines[i].trim() });
        }
      }
      return hits;
    },
  },
  {
    id: "prisma-without-try",
    description:
      "Handler calls prisma. outside a try/catch — Neon cold-start errors will bubble raw",
    check(src) {
      const hits = [];
      for (const h of findHandlers(src)) {
        // Does this handler's own body use prisma?
        if (!/\bprisma\./.test(h.body)) continue;
        // Find first `try {` and first `prisma.` in the body. If any prisma
        // call appears before the first try, the handler isn't guarding.
        const tryIdx = h.body.indexOf("try {");
        const prismaMatch = /\bprisma\./.exec(h.body);
        if (!prismaMatch) continue;
        if (tryIdx === -1 || prismaMatch.index < tryIdx) {
          hits.push({
            line: h.line,
            text: `${h.method} handler has prisma. call outside try/catch`,
          });
        }
      }
      return hits;
    },
  },
];

const files = walk(API_DIR);
let violations = 0;

for (const file of files) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, "utf8");
  for (const rule of rules) {
    const hits = rule.check(src);
    for (const hit of hits) {
      violations++;
      console.error(
        `${rel}:${hit.line}  [${rule.id}] ${rule.description}\n    ${hit.text}`,
      );
    }
  }
}

if (violations > 0) {
  console.error(`\n✖ ${violations} API error-handling violation(s) found.`);
  console.error(
    `  Fix by returning \`apiError(error, fallback)\` from @/lib/api-response.`,
  );
  process.exit(1);
}

console.log(`✓ Checked ${files.length} route files — no violations.`);
