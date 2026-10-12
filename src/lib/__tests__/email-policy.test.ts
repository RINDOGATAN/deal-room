// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The e-mail policy (email-policy.ts): dotted Gmail everywhere, the hotmail
 * and aol domains on accounts only, one message for both.
 */
import { describe, expect, it } from "vitest";
import {
  BLOCKED_EMAIL_MESSAGES,
  BLOCKED_EMAIL_MESSAGE_KEY,
  blockedEmailMessage,
  isBlockedAccountEmail,
  isBlockedEnquiryEmail,
  isDottedGmail,
} from "@/lib/email-policy";

const DOTTED_GMAIL = [
  "b.ake.r.miche.ll.eba.hpc.y.jx@gmail.com",
  "B.AKE.R.MICHE.LL.EBA.HPC.Y.JX@GMAIL.COM",
  "a.b.c.d@googlemail.com",
  "A.B.C.D@GoogleMail.Com",
  "a.b.c.d+x@gmail.com",
];
const BLOCKED_DOMAINS = [
  "someone@hotmail.com",
  "SOMEONE@HOTMAIL.COM",
  "x@hotmail.co.uk",
  "x@hotmail.fr",
  "x@hotmail.com.ar",
  "x@mx.hotmail.com",
  "x@aol.com",
  "X@AOL.CO.UK",
  "x@aol.de",
  " x@hotmail.com. ",
];
const ACCEPTED = [
  "first.last@gmail.com",
  "FIRST.LAST@GMAIL.COM",
  "a.b.c@gmail.com",
  "a.b+c.d.e@gmail.com",
  "a.b.c.d@example.com",
  "x@aol.example.com",
  "x@nothotmail.com",
  "x@hotmailer.com",
  "x@outlook.com",
];

describe("account scope (sign-up, sign-in, invitations): both rules", () => {
  it.each([...DOTTED_GMAIL, ...BLOCKED_DOMAINS])("refuses %s", (email) => {
    expect(isBlockedAccountEmail(email)).toBe(true);
  });
  it.each(ACCEPTED)("accepts %s", (email) => {
    expect(isBlockedAccountEmail(email)).toBe(false);
  });
  it("never throws on odd input", () => {
    for (const v of ["", "nonsense", "@gmail.com", "a@", null, undefined, 42]) {
      expect(isBlockedAccountEmail(v)).toBe(false);
    }
  });
});

describe("enquiry scope (contact, booking, updates forms): dotted Gmail only", () => {
  it.each(DOTTED_GMAIL)("refuses %s", (email) => {
    expect(isBlockedEnquiryEmail(email)).toBe(true);
    expect(isDottedGmail(email)).toBe(true);
  });
  it.each(BLOCKED_DOMAINS)("keeps %s open", (email) => {
    expect(isBlockedEnquiryEmail(email)).toBe(false);
  });
  it.each(ACCEPTED)("accepts %s", (email) => {
    expect(isBlockedEnquiryEmail(email)).toBe(false);
  });
});

describe("message", () => {
  it("is one sentence per language, with a stable key", () => {
    expect(BLOCKED_EMAIL_MESSAGE_KEY).toBe("email_not_accepted");
    expect(blockedEmailMessage("en")).toBe(
      "Please use your work e-mail address, or a different personal address. We can't accept this one.",
    );
    expect(blockedEmailMessage("es")).toBe(
      "Usa tu correo del trabajo u otra dirección personal. No podemos aceptar esta.",
    );
    expect(blockedEmailMessage("es-ES")).toBe(BLOCKED_EMAIL_MESSAGES.es);
    expect(blockedEmailMessage(undefined)).toBe(BLOCKED_EMAIL_MESSAGES.en);
  });

  it("matches the app and landing translations", async () => {
    const en = (await import("@/messages/en.json")).default as { auth: Record<string, string> };
    const es = (await import("@/messages/es.json")).default as { auth: Record<string, string> };
    expect(en.auth.errorEmailNotAccepted).toBe(BLOCKED_EMAIL_MESSAGES.en);
    expect(es.auth.errorEmailNotAccepted).toBe(BLOCKED_EMAIL_MESSAGES.es);
    const lEn = (await import("@/landing/i18n/en/startups-auth.json")).default as Record<string, string>;
    const lEs = (await import("@/landing/i18n/es/startups-auth.json")).default as Record<string, string>;
    expect(lEn.emailNotAccepted).toBe(BLOCKED_EMAIL_MESSAGES.en);
    expect(lEs.emailNotAccepted).toBe(BLOCKED_EMAIL_MESSAGES.es);
  });
});
