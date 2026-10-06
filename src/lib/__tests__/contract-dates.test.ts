// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { describe, expect, it } from "vitest";
import { buildContractDates, buildObligationsLedger } from "@/lib/obligations";

const schema = [
  { id: "start-date", type: "date", label: { en: "Start date", es: "Fecha de inicio" } },
  { id: "term-months", type: "number", label: { en: "Term (months)", es: "Duración (meses)" } },
  { id: "payment-term-days", type: "number", label: "Payment term (days)" },
  { id: "company-name", type: "text", label: "Company" },
  { id: "end-date", type: "date", label: "End date" },
];

describe("contract dates beyond the DPA", () => {
  it("lists date inputs, period inputs and the agreed term, renewal and notice clauses", () => {
    const dates = buildContractDates({
      parameterSchema: schema,
      parameters: { "start-date": "2026-11-01", "term-months": "12", "payment-term-days": "30", "company-name": "X" },
      agreedClauses: [
        { clauseId: "term-and-renewal", title: "Term and renewal", optionLabel: "12 months, renews automatically" },
        { clauseId: "auto-renewal", title: "Auto-renewal", optionLabel: "Renews; 60 days' notice" },
        { clauseId: "termination-notice", title: "Termination notice", optionLabel: "One month" },
        { clauseId: "payment-terms", title: "Payment terms", optionLabel: "Net 30" },
        { clauseId: "governing-law", title: "Governing law", optionLabel: "California" },
      ],
      lang: "en",
    });
    expect(dates).toEqual([
      { id: "start-date", kind: "date", label: "Start date", value: "2026-11-01" },
      { id: "term-months", kind: "period", label: "Term (months)", value: "12" },
      { id: "term-and-renewal", kind: "clause", label: "Term and renewal", value: "12 months, renews automatically" },
      { id: "auto-renewal", kind: "clause", label: "Auto-renewal", value: "Renews; 60 days' notice" },
      { id: "termination-notice", kind: "clause", label: "Termination notice", value: "One month" },
    ]);
  });

  it("uses the Spanish labels and skips empty inputs", () => {
    const dates = buildContractDates({ parameterSchema: schema, parameters: { "start-date": "2026-11-01", "end-date": " " }, agreedClauses: [], lang: "es" });
    expect(dates).toEqual([{ id: "start-date", kind: "date", label: "Fecha de inicio", value: "2026-11-01" }]);
  });

  it("leaves the DPA ledger as it was for other types", () => {
    expect(buildObligationsLedger({ contractType: "NDA", agreed: [] })).toEqual([]);
  });
});
