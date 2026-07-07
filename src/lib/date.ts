// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Locale-aware date formatting.
 * European (day-first): Spain, England & Wales, or Spanish locale.
 * US (month-first): California / default.
 */
export function formatDate(
  date: Date,
  opts?: { locale?: string; governingLaw?: string }
): string {
  const isSpanish = opts?.locale === "es";
  const isEuropean =
    isSpanish ||
    opts?.governingLaw === "SPAIN" ||
    opts?.governingLaw === "ENGLAND_WALES";

  if (isSpanish) {
    return format(date, "d MMM yyyy", { locale: es });
  }
  if (isEuropean) {
    return format(date, "d MMM yyyy");
  }
  return format(date, "MMM d, yyyy");
}

export function formatDateTime(
  date: Date,
  opts?: { locale?: string; governingLaw?: string }
): string {
  const isSpanish = opts?.locale === "es";
  const isEuropean =
    isSpanish ||
    opts?.governingLaw === "SPAIN" ||
    opts?.governingLaw === "ENGLAND_WALES";

  if (isSpanish) {
    return format(date, "d MMM yyyy, HH:mm", { locale: es });
  }
  if (isEuropean) {
    return format(date, "d MMM yyyy, HH:mm");
  }
  return format(date, "MMM d, yyyy 'at' h:mm a");
}
