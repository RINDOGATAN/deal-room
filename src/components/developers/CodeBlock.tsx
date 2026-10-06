"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { PageLocale } from "@/lib/contract-pages-paths";

const LABELS: Record<PageLocale, { copy: string; copied: string }> = {
  en: { copy: "Copy", copied: "Copied" },
  es: { copy: "Copiar", copied: "Copiado" },
};

/**
 * A code sample in one consistent frame: a title bar with its label and a
 * copy button, then the code. The text is in the HTML for readers and
 * crawlers.
 */
export function CodeBlock({ code, locale, label }: { code: string; locale: PageLocale; label?: string }) {
  const [copied, setCopied] = useState(false);
  const words = LABELS[locale];

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (permissions, insecure origin): the text stays selectable.
    }
  }

  return (
    <figure className="mt-3 min-w-0 max-w-full border border-border rounded-lg bg-background overflow-hidden">
      <figcaption className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border text-xs text-muted-foreground">
        <span className="font-medium truncate">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-card hover:text-foreground"
        >
          {copied ? <Check className="w-3.5 h-3.5" aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />}
          {copied ? words.copied : words.copy}
        </button>
      </figcaption>
      <pre className="text-xs p-4 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
