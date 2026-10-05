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

/** A code sample with a copy button. The text is in the HTML for readers and crawlers. */
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
    <div className="relative mt-3">
      <pre
        className="text-xs bg-background border border-border rounded-lg p-4 pr-24 overflow-x-auto"
        aria-label={label}
      >
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-card text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="w-3.5 h-3.5" aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />}
        {copied ? words.copied : words.copy}
      </button>
    </div>
  );
}
