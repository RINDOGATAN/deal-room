"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useId, useState, type KeyboardEvent } from "react";
import type { PageLocale } from "@/lib/contract-pages-paths";
import { CodeBlock } from "./CodeBlock";

/**
 * One tab per MCP client, in a fixed order. Every panel is in the HTML
 * (inactive ones carry `hidden`), so readers and crawlers get all of them;
 * arrow keys move between tabs (WAI-ARIA tabs pattern).
 */
export function ClientTabs({
  clients,
  locale,
  label,
}: {
  clients: { id: string; name: string; note: string; code: string }[];
  locale: PageLocale;
  label: string;
}) {
  const [active, setActive] = useState(0);
  const base = useId();

  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    const last = clients.length - 1;
    const next =
      e.key === "ArrowRight" ? (active === last ? 0 : active + 1)
      : e.key === "ArrowLeft" ? (active === 0 ? last : active - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    document.getElementById(`${base}-tab-${next}`)?.focus();
  }

  return (
    <div className="mt-4 border border-border rounded-lg bg-card">
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-border p-2">
        {clients.map((c, i) => (
          <button
            key={c.id}
            id={`${base}-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls={`${base}-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={onKey}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              i === active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      {clients.map((c, i) => (
        <div
          key={c.id}
          id={`${base}-panel-${i}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${i}`}
          hidden={i !== active}
          className="p-4"
        >
          <h4 className="sr-only">{c.name}</h4>
          <p className="text-sm text-muted-foreground">{c.note}</p>
          <CodeBlock code={c.code} locale={locale} label={c.name} />
        </div>
      ))}
    </div>
  );
}
