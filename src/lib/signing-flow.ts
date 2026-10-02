// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The signing page as one flow (owner's test purchase, 2 October 2026).
 *
 * Once every clause is agreed, the page shows ONE step and at most ONE
 * primary action:
 * - the execution details form, only while this party's details are
 *   missing (or being changed); its button saves them and gets the
 *   contract when it is still unpaid, else saves and continues;
 * - "Get this contract" while unpaid;
 * - a wait while the other party's details are missing;
 * - the signature area, directly (signing starts with the first signature).
 * Saved details are shown as a quiet "Saved" line, never as a second call
 * to action. The signing view offers no unsigned copy: the only download
 * it shows is the signed contract, once every party has signed.
 */

export type SigningStep =
  | "completed"
  | "signed-waiting"
  | "firmas"
  | "details"
  | "pay"
  | "waiting-details"
  | "sign";

export type PrimaryAction = "get-contract" | "save-details" | "sign" | null;

export interface SigningFlowInput {
  /** Every party has signed (the signing request is COMPLETED). */
  completed: boolean;
  /** This party has signed. */
  iSigned: boolean;
  /** This party chose the phone hand-off and has not signed yet. */
  myHandoffActive: boolean;
  /** This party's execution details are saved. */
  ownDetails: boolean;
  /** The other party's execution details are saved (always true in solo mode). */
  otherDetails: boolean;
  /** This party opened the form to change saved details. */
  editingDetails: boolean;
  /** Payments are on and the contract is not paid yet. */
  needsPayment: boolean;
}

export interface SigningFlow {
  step: SigningStep;
  primary: PrimaryAction;
  /** Show the execution details form (inside the step). */
  showDetailsForm: boolean;
  /** Show the quiet "Saved" line for this party's details. */
  showSavedDetails: boolean;
  /** The single download on the signing view: the signed contract, only when complete. */
  signedDownload: boolean;
}

export function signingFlow(input: SigningFlowInput): SigningFlow {
  const step = stepFor(input);
  return {
    step,
    primary: primaryFor(step, input),
    showDetailsForm: step === "details",
    showSavedDetails: input.ownDetails && step !== "details",
    signedDownload: step === "completed",
  };
}

function stepFor(i: SigningFlowInput): SigningStep {
  if (i.completed) return "completed";
  if (i.iSigned) return "signed-waiting";
  if (i.myHandoffActive) return "firmas";
  if (!i.ownDetails || i.editingDetails) return "details";
  if (i.needsPayment) return "pay";
  if (!i.otherDetails) return "waiting-details";
  return "sign";
}

function primaryFor(step: SigningStep, i: SigningFlowInput): PrimaryAction {
  switch (step) {
    case "details":
      // First time: the form's button is the purchase itself. Changing
      // saved details only saves them.
      return i.needsPayment && !i.ownDetails ? "get-contract" : "save-details";
    case "pay":
      return "get-contract";
    case "sign":
      return "sign";
    default:
      return null;
  }
}
