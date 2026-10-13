// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The option a clause takes when the caller leaves it out (one-call
 * contracts, solo intake with selectionPolicy "defaults").
 *
 * Skills carry no explicit default flag; the guides document the default
 * as "the most neutral option, the middle ground", which the option biases
 * encode. So, among the options available under the governing law:
 *   1. an optional clause (isRequired false) with a "none" option takes it:
 *      an optional obligation is never added unasked;
 *   2. otherwise the most neutral option, the smallest
 *      |biasPartyA| + |biasPartyB|; among equally neutral options one coded
 *      or labelled "standard" wins, then the lowest order.
 * Never simply the first option: options are listed from one side's
 * strongest position to the other's, so the first is usually the most
 * one-sided.
 */

export interface DefaultableOption {
  code: string;
  order: number;
  label?: string | null;
  biasPartyA?: number | null;
  biasPartyB?: number | null;
}

const NONE_CODES = new Set(["none", "no", "not-applicable", "n-a"]);

const isStandard = (o: DefaultableOption) =>
  /^standard\b/i.test(o.code) || /^standard\b/i.test((o.label ?? "").trim());

export function neutrality(o: DefaultableOption): number {
  return Math.abs(o.biasPartyA ?? 0) + Math.abs(o.biasPartyB ?? 0);
}

export function defaultOption<T extends DefaultableOption>(
  options: T[],
  opts: { isRequired?: boolean } = {},
): T | undefined {
  if (options.length === 0) return undefined;
  if (opts.isRequired === false) {
    const none = options.find((o) => NONE_CODES.has(o.code.toLowerCase()));
    if (none) return none;
  }
  return [...options].sort((a, b) => {
    const n = neutrality(a) - neutrality(b);
    if (Math.abs(n) > 1e-9) return n;
    const s = Number(isStandard(b)) - Number(isStandard(a));
    if (s !== 0) return s;
    return a.order - b.order;
  })[0];
}
