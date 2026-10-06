// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A small public calendar of statutory dates startups meet often (owner's
 * decision T4, 6 October 2026). Each item carries the official source it
 * comes from and is marked "verify with the official source". General
 * public dates only: nothing here looks at the user's facts beyond the
 * dates the caller gives, and nothing says what the user must do.
 *
 * Sources checked on 6 October 2026:
 * - 83(b): IRS Form 15620, "no later than 30 days after the date the
 *   property was transferred".
 * - Form D: 17 CFR 230.503(a)(1), "no later than 15 calendar days after
 *   the first sale of securities in the offering" (a Saturday, Sunday or
 *   holiday moves it to the next business day).
 * - Delaware: Division of Corporations, annual reports and franchise taxes
 *   of domestic corporations "due annually on or before March 1st".
 */

import type { PageLocale } from "./contract-pages-paths";

export type DeadlineId = "83B_ELECTION" | "FORM_D" | "DELAWARE_ANNUAL_REPORT";

export interface DeadlineDef {
  id: DeadlineId;
  title: Record<PageLocale, string>;
  rule: Record<PageLocale, string>;
  /** The input the due date counts from, if any. */
  from?: "grantDate" | "firstSaleDate";
  /** Calendar days after `from`. */
  days?: number;
  source: string;
}

export const STATUTORY_DEADLINES: readonly DeadlineDef[] = [
  {
    id: "83B_ELECTION",
    title: { en: "Section 83(b) election (US federal tax)", es: "Elección de la sección 83(b) (impuesto federal de EE. UU.)" },
    rule: {
      en: "Filed with the IRS no later than 30 days after the date the stock or other property is transferred (for example, granted subject to vesting).",
      es: "Se presenta ante el IRS a más tardar 30 días después de la fecha en que se transmiten las acciones u otros bienes (por ejemplo, al concederlas sujetas a vesting).",
    },
    from: "grantDate",
    days: 30,
    source: "https://www.irs.gov/pub/irs-pdf/f15620.pdf",
  },
  {
    id: "FORM_D",
    title: { en: "Form D notice (SEC, Regulation D offerings)", es: "Aviso Form D (SEC, ofertas bajo la Regulation D)" },
    rule: {
      en: "Filed with the SEC no later than 15 calendar days after the first sale of securities in an offering under Rule 504 or Rule 506.",
      es: "Se presenta ante la SEC a más tardar 15 días naturales después de la primera venta de valores en una oferta acogida a la Rule 504 o a la Rule 506.",
    },
    from: "firstSaleDate",
    days: 15,
    source: "https://www.ecfr.gov/current/title-17/section-230.503",
  },
  {
    id: "DELAWARE_ANNUAL_REPORT",
    title: { en: "Delaware annual report and franchise tax (corporations)", es: "Informe anual e impuesto de franquicia de Delaware (corporations)" },
    rule: {
      en: "Due on or before 1 March each year, for the previous year, for Delaware domestic corporations.",
      es: "Vence el 1 de marzo de cada año, o antes, por el año anterior, para las corporations constituidas en Delaware.",
    },
    source: "https://corp.delaware.gov/paytaxes/",
  },
];

/** The wording of the answer (for the owner's approval: every sentence is here). */
export const DEADLINES_TEXT = {
  verify: { en: "Verify with the official source.", es: "Compruébalo en la fuente oficial." },
  note: {
    en: "General public dates, not advice on any particular situation. Due dates are counted in calendar days from the date given and are not moved for weekends or public holidays here; the official source says when they move.",
    es: "Fechas públicas generales, no asesoramiento sobre ningún caso concreto. Los vencimientos se cuentan en días naturales desde la fecha indicada y aquí no se ajustan por fines de semana ni festivos; la fuente oficial indica cuándo se ajustan.",
  },
} as const;

export interface DeadlineItem {
  id: DeadlineId;
  title: string;
  rule: string;
  /** YYYY-MM-DD, when it can be counted from the dates given. */
  dueDate: string | null;
  source: string;
  verify: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD date as UTC midnight, or null when it is not a real date. */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !ISO_DATE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

function addDays(d: Date, days: number): string {
  return new Date(d.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** The next 1 March on or after `today` (UTC), or 1 March of `year` when given. */
export function delawareDueDate(today: Date, year?: number | null): string {
  if (year) return `${year}-03-01`;
  const y = today.getUTCFullYear();
  const thisYear = `${y}-03-01`;
  return today.toISOString().slice(0, 10) <= thisYear ? thisYear : `${y + 1}-03-01`;
}

export function buildDeadlines(opts: {
  locale?: PageLocale;
  grantDate?: string | null;
  firstSaleDate?: string | null;
  year?: number | null;
  today?: Date;
}): { items: DeadlineItem[]; note: string } {
  const locale = opts.locale ?? "en";
  const today = opts.today ?? new Date();
  const from = {
    grantDate: parseIsoDate(opts.grantDate),
    firstSaleDate: parseIsoDate(opts.firstSaleDate),
  };
  const items = STATUTORY_DEADLINES.map((d) => {
    let dueDate: string | null = null;
    if (d.from && d.days) {
      const start = from[d.from];
      dueDate = start ? addDays(start, d.days) : null;
    } else if (d.id === "DELAWARE_ANNUAL_REPORT") {
      dueDate = delawareDueDate(today, opts.year);
    }
    return {
      id: d.id,
      title: d.title[locale],
      rule: d.rule[locale],
      dueDate,
      source: d.source,
      verify: DEADLINES_TEXT.verify[locale],
    };
  });
  return { items, note: DEADLINES_TEXT.note[locale] };
}
