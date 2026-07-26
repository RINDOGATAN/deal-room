// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Asymmetric-role contract configuration.
 *
 * A handful of contract types are *asymmetric*: the two parties occupy named
 * roles that are not interchangeable (DPA: Controller vs Processor; BAA:
 * Business Associate vs Covered Entity). For these, the initiator must declare
 * which role they take, so the wizard's guidance orients to their side, and the
 * generated document places them in the right block.
 *
 * House convention (as of 2026-07): role support is keyed by `contractType`
 * here — NOT declared in the skill payload. DPA (a free, app-baked skill)
 * carries no role field in its clauses/metadata; the app hard-codes the
 * behaviour. BAA_NEGOTIATOR (a premium clause-pack) follows the same pattern:
 * this module is the single source of truth for both, consumed by the new-deal
 * wizard, the deal.create default, the document generator's A/B swap, and the
 * signing-page role editor.
 *
 * Boilerplate slot convention: Party A is the FIRST-declared role in each
 * template's `partyLabels`. DPA → Party A = Controller; BAA → Party A =
 * Business Associate (Company). When the initiator picks the OTHER role, the
 * generator swaps the A/B slots (`roleRequiresSwap`).
 */

export type ContractRole =
  | "CONTROLLER"
  | "PROCESSOR"
  | "BUSINESS_ASSOCIATE"
  | "COVERED_ENTITY";

export interface ContractRoleOption {
  role: ContractRole;
  /** i18n key under the `newDeal` namespace for the option's title. */
  titleKey: string;
  /** i18n key under the `newDeal` namespace for the option's description. */
  descKey: string;
  /** i18n key under `signingDetails.role` for the compact signing-page label. */
  signingKey: string;
}

export interface ContractRoleConfig {
  contractType: string;
  /** Role the initiator takes by default (the party who usually offers the template). */
  defaultRole: ContractRole;
  /** The role occupying the boilerplate Party A slot (first in partyLabels). */
  slotARole: ContractRole;
  /** i18n keys under the `newDeal` namespace. */
  titleKey: string;
  hintKey: string;
  hintNegotiationKey: string;
  /** Two options, in display order. */
  options: [ContractRoleOption, ContractRoleOption];
}

export const CONTRACT_ROLE_CONFIGS: Record<string, ContractRoleConfig> = {
  DPA: {
    contractType: "DPA",
    defaultRole: "PROCESSOR",
    slotARole: "CONTROLLER",
    titleKey: "dpaRoleTitle",
    hintKey: "dpaRoleHint",
    hintNegotiationKey: "dpaRoleHintNegotiation",
    options: [
      { role: "PROCESSOR", titleKey: "dpaRoleProcessor", descKey: "dpaRoleProcessorDescription", signingKey: "processor" },
      { role: "CONTROLLER", titleKey: "dpaRoleController", descKey: "dpaRoleControllerDescription", signingKey: "controller" },
    ],
  },
  BAA_NEGOTIATOR: {
    contractType: "BAA_NEGOTIATOR",
    defaultRole: "BUSINESS_ASSOCIATE",
    slotARole: "BUSINESS_ASSOCIATE",
    titleKey: "baaRoleTitle",
    hintKey: "baaRoleHint",
    hintNegotiationKey: "baaRoleHintNegotiation",
    options: [
      { role: "BUSINESS_ASSOCIATE", titleKey: "baaRoleBusinessAssociate", descKey: "baaRoleBusinessAssociateDescription", signingKey: "businessAssociate" },
      { role: "COVERED_ENTITY", titleKey: "baaRoleCoveredEntity", descKey: "baaRoleCoveredEntityDescription", signingKey: "coveredEntity" },
    ],
  },
};

export function roleConfigFor(
  contractType?: string | null
): ContractRoleConfig | undefined {
  return contractType ? CONTRACT_ROLE_CONFIGS[contractType] : undefined;
}

/**
 * Roles that occupy the Party B slot — i.e. picking them means the initiator is
 * NOT in the boilerplate Party A slot, so the generator must swap A/B. Kept as a
 * flat set so the generator need not know the contract type (each role name is
 * unique to one contract).
 */
const PARTY_B_ROLES = new Set<string>(["PROCESSOR", "COVERED_ENTITY"]);

/** Does the initiator's chosen role require an A/B slot swap in the document? */
export function roleRequiresSwap(fillRole?: string | null): boolean {
  return !!fillRole && PARTY_B_ROLES.has(fillRole);
}
