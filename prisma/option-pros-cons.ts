// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Reads an option's pros and cons in either authored layout.
 *
 * Skills author pros and cons in one of two layouts (see the note in
 * src/server/services/skills/loader.ts): FLAT (`prosPartyA`, `consPartyB`) or
 * NESTED (`pros.partyA`, `cons.partyB`). The seed used to read only the flat
 * fields, so every option of the NDA, MSA, SaaS and Delaware skills (all
 * nested) reached the database with empty pros and cons.
 *
 * The nested layout is read first; the flat field is the fallback.
 */

export type LocalizedArray = string[] | Record<string, string[]>;

export interface ProsConsSource {
  pros?: { partyA?: LocalizedArray; partyB?: LocalizedArray };
  cons?: { partyA?: LocalizedArray; partyB?: LocalizedArray };
  prosPartyA?: LocalizedArray;
  consPartyA?: LocalizedArray;
  prosPartyB?: LocalizedArray;
  consPartyB?: LocalizedArray;
}

export interface OptionProsCons {
  prosPartyA: LocalizedArray | undefined;
  consPartyA: LocalizedArray | undefined;
  prosPartyB: LocalizedArray | undefined;
  consPartyB: LocalizedArray | undefined;
}

export function optionProsCons(option: ProsConsSource): OptionProsCons {
  return {
    prosPartyA: option.pros?.partyA ?? option.prosPartyA,
    consPartyA: option.cons?.partyA ?? option.consPartyA,
    prosPartyB: option.pros?.partyB ?? option.prosPartyB,
    consPartyB: option.cons?.partyB ?? option.consPartyB,
  };
}
