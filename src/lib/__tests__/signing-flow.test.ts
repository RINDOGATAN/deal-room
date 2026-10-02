// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The agreed contract as one flow (owner's test purchase, 2 October 2026):
 * - one "Get this contract", never two (item 3);
 * - the execution details asked inside that step only when missing; saved
 *   details are a quiet "Saved" line, not a second call to action (item 4);
 * - after paying, saved details are not shown again, the signature area
 *   comes directly, and the signing view offers no unsigned copy (item 5).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { signingFlow, type SigningFlowInput } from "@/lib/signing-flow";

const KEYS: (keyof SigningFlowInput)[] = [
  "completed",
  "iSigned",
  "myHandoffActive",
  "ownDetails",
  "otherDetails",
  "editingDetails",
  "needsPayment",
];

/** Every combination of the seven inputs. */
function everyInput(): SigningFlowInput[] {
  return Array.from({ length: 1 << KEYS.length }, (_, n) =>
    Object.fromEntries(KEYS.map((k, i) => [k, !!(n & (1 << i))])) as unknown as SigningFlowInput,
  );
}

const base: SigningFlowInput = {
  completed: false,
  iSigned: false,
  myHandoffActive: false,
  ownDetails: false,
  otherDetails: true,
  editingDetails: false,
  needsPayment: false,
};

describe("signingFlow", () => {
  it("never shows the details form when saved details are not being changed", () => {
    for (const input of everyInput()) {
      const flow = signingFlow(input);
      if (input.ownDetails && !input.editingDetails) expect(flow.showDetailsForm, JSON.stringify(input)).toBe(false);
      // Form and quiet "Saved" line are never on screen together.
      expect(flow.showDetailsForm && flow.showSavedDetails).toBe(false);
    }
  });

  it("offers a download only of the signed contract, once every party has signed", () => {
    for (const input of everyInput()) {
      expect(signingFlow(input).signedDownload, JSON.stringify(input)).toBe(input.completed);
    }
  });

  it("asks for payment only while unpaid, and never once signed", () => {
    for (const input of everyInput()) {
      const { primary } = signingFlow(input);
      if (primary === "get-contract") {
        expect(input.needsPayment).toBe(true);
        expect(input.completed || input.iSigned).toBe(false);
      }
    }
  });

  it("first visit, unpaid: one step, the details form, whose button gets the contract", () => {
    const flow = signingFlow({ ...base, needsPayment: true });
    expect(flow).toMatchObject({ step: "details", primary: "get-contract", showDetailsForm: true, showSavedDetails: false });
  });

  it("details saved, unpaid: only the purchase, with the details as a quiet saved line", () => {
    const flow = signingFlow({ ...base, ownDetails: true, needsPayment: true });
    expect(flow).toMatchObject({ step: "pay", primary: "get-contract", showDetailsForm: false, showSavedDetails: true });
  });

  it("after paying, with details saved: the signature area directly", () => {
    const flow = signingFlow({ ...base, ownDetails: true });
    expect(flow).toMatchObject({ step: "sign", primary: "sign", showDetailsForm: false, signedDownload: false });
  });

  it("after paying, details missing: the form, which saves and continues", () => {
    expect(signingFlow(base)).toMatchObject({ step: "details", primary: "save-details" });
  });

  it("changing saved details only saves them, even while unpaid", () => {
    const flow = signingFlow({ ...base, ownDetails: true, editingDetails: true, needsPayment: true });
    expect(flow).toMatchObject({ step: "details", primary: "save-details" });
  });

  it("waits, without an action, while the other party's details are missing", () => {
    expect(signingFlow({ ...base, ownDetails: true, otherDetails: false })).toMatchObject({
      step: "waiting-details",
      primary: null,
    });
  });

  it("after signing: no action and no download until everyone has signed", () => {
    expect(signingFlow({ ...base, ownDetails: true, iSigned: true })).toMatchObject({
      step: "signed-waiting",
      primary: null,
      signedDownload: false,
    });
    expect(signingFlow({ ...base, ownDetails: true, iSigned: true, completed: true })).toMatchObject({
      step: "completed",
      signedDownload: true,
    });
  });
});

describe("the signing page follows the flow", () => {
  const root = join(__dirname, "../../..");
  const sign = readFileSync(join(root, "src/app/(dashboard)/deals/[id]/sign/page.tsx"), "utf8");
  const deal = readFileSync(join(root, "src/app/(dashboard)/deals/[id]/page.tsx"), "utf8");

  it("has no unsigned download: one document link, the signed one", () => {
    expect(sign).not.toMatch(/\/document\/(docx|txt)/);
    expect(sign).not.toContain("PaidDownloads");
    const links = sign.match(/\/api\/deals\/\$\{dealId\}\/document/g) ?? [];
    expect(links).toHaveLength(1);
    const at = sign.indexOf("/api/deals/${dealId}/document");
    expect(sign.slice(Math.max(0, at - 800), at)).toContain('flow.step === "completed"');
  });

  it("shows the purchase only from the flow's one primary action (no second panel)", () => {
    expect(sign).not.toContain("ContractPaymentPanel");
    expect(sign).not.toContain("startSigningProcess");
    for (const match of sign.matchAll(/data-testid="get-contract"/g)) {
      const before = sign.slice(Math.max(0, (match.index ?? 0) - 1600), match.index);
      const lastStep = [...before.matchAll(/flow\.(step === "(\w|-)+"|primary === "get-contract")/g)].pop();
      expect(lastStep?.[0]).toMatch(/flow\.step === "pay"|flow\.primary === "get-contract"/);
    }
  });

  it("keeps the deal page to one 'Get this contract' (download links hidden while unpaid)", () => {
    expect(deal).toContain('unpaid="hide"');
    expect(deal).toContain("getContractCard(signUrl)");
  });

  it("brings the person back to the signing page after paying", () => {
    const route = readFileSync(join(root, "src/app/api/deals/[id]/checkout/route.ts"), "utf8");
    expect(route).toContain("/deals/${dealRoomId}/sign?paid=1&session_id={CHECKOUT_SESSION_ID}");
    expect(sign).toContain("<CheckoutReturn dealId={dealId} />");
  });

  it("has the new strings in English and Spanish, and no 'Final details' button", async () => {
    const en = (await import("@/messages/en.json")).default as unknown as Record<string, Record<string, unknown>>;
    const es = (await import("@/messages/es.json")).default as unknown as Record<string, Record<string, unknown>>;
    for (const msgs of [en, es]) {
      const details = (msgs.signing.signingDetails ?? {}) as Record<string, string>;
      for (const key of ["change", "keepSaved", "saveAndContinue", "otherSaved"]) expect(details[key]).toBeTruthy();
      expect(msgs.signing.startSigningProcess).toBeUndefined();
      const readiness = (msgs.dealDetail.readiness ?? {}) as Record<string, string>;
      expect(readiness.getContractTitle).toBeTruthy();
      expect(readiness.getContractDescription).toBeTruthy();
    }
  });
});
