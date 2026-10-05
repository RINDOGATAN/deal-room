// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Transactional deal emails (owner decisions of 4 October 2026): who gets
 * which email when, the billing-start exclusion, and the wording rules.
 */
import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  dealEmailsAllowed,
  dedupeKeys,
  draftReminderDue,
  emailLanguage,
  inviteReminderDue,
  lastActivity,
  partyEmail,
  partyName,
  readyEmailDue,
  readyRecipients,
  recipientCurrency,
  turnRecipient,
  type NotificationKind,
  type PartyLike,
} from "@/lib/deal-notifications";
import { defaultDealMode } from "@/lib/deal-mode";
import { renderDealEmail, type DealEmailKind } from "@/lib/email";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const ENV = { CONTRACT_BILLING_START: "2026-09-30" };
const START = new Date("2026-09-30T00:00:00Z");
const NOW = new Date("2026-10-20T09:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY_MS);
const none = new Set<NotificationKind>();

const initiator: PartyLike = {
  id: "pa",
  role: "INITIATOR",
  userId: "ua",
  email: "a@example.com",
  name: "Ana",
  user: { email: "ana@example.com", name: "Ana Ruiz" },
};
const respondent: PartyLike = {
  id: "pb",
  role: "RESPONDENT",
  userId: "ub",
  email: "b@example.com",
  name: null,
  user: { email: "b@example.com", name: "Bruno" },
};
const invitedOnly: PartyLike = { ...respondent, userId: null, user: null };

describe("billing-start exclusion", () => {
  it("never emails about a deal created before the billing start", () => {
    expect(dealEmailsAllowed({ createdAt: new Date(START.getTime() - 1) }, ENV)).toBe(false);
    expect(dealEmailsAllowed({ createdAt: new Date("2026-09-12T10:00:00Z") }, ENV)).toBe(false);
  });

  it("emails about deals created on or after the start", () => {
    expect(dealEmailsAllowed({ createdAt: START }, ENV)).toBe(true);
    expect(dealEmailsAllowed({ createdAt: daysAgo(3) }, ENV)).toBe(true);
  });

  it("sends nothing when the start date is missing or not a date", () => {
    expect(dealEmailsAllowed({ createdAt: daysAgo(3) }, {})).toBe(false);
    expect(dealEmailsAllowed({ createdAt: daysAgo(3) }, { CONTRACT_BILLING_START: "soon" })).toBe(false);
  });

  it("never emails about deals run by agents", () => {
    expect(dealEmailsAllowed({ createdAt: daysAgo(3), isAgentDeal: true }, ENV)).toBe(false);
  });
});

describe("your turn", () => {
  it("goes to the other party once it has joined", () => {
    expect(turnRecipient([initiator, respondent], "pa")?.id).toBe("pb");
    expect(turnRecipient([initiator, respondent], "pb")?.id).toBe("pa");
  });

  it("is not sent to a counterparty who has not accepted the invitation", () => {
    expect(turnRecipient([initiator, invitedOnly], "pa")).toBeNull();
  });

  it("is not sent in solo mode or for an unknown sender", () => {
    expect(turnRecipient([initiator], "pa")).toBeNull();
    expect(turnRecipient([initiator, respondent], "nobody")).toBeNull();
  });

  it("counter-proposals share one key per round, sender and recipient", () => {
    expect(dedupeKeys.turnCounter("r1", "pa", "pb")).toBe(dedupeKeys.turnCounter("r1", "pa", "pb"));
    expect(dedupeKeys.turnCounter("r1", "pa", "pb")).not.toBe(dedupeKeys.turnCounter("r2", "pa", "pb"));
    expect(dedupeKeys.turnCounter("r1", "pa", "pb")).not.toBe(dedupeKeys.turnCounter("r1", "pb", "pa"));
  });

  it("a submission has its own key per sender", () => {
    expect(dedupeKeys.turnSelections("d1", "pa", "pb")).not.toBe(dedupeKeys.turnSelections("d1", "pb", "pa"));
  });
});

describe("invitation reminders", () => {
  const inv = (sentDaysAgo: number, extra: Partial<{ status: string; expiresAt: Date }> = {}) => ({
    status: "PENDING",
    sentAt: daysAgo(sentDaysAgo),
    expiresAt: new Date(daysAgo(sentDaysAgo).getTime() + 14 * DAY_MS),
    ...extra,
  });

  it("sends nothing in the first three days", () => {
    expect(inviteReminderDue(inv(0), NOW, none)).toBeNull();
    expect(inviteReminderDue(inv(2.9), NOW, none)).toBeNull();
  });

  it("sends the day-3 reminder from day 3", () => {
    expect(inviteReminderDue(inv(3), NOW, none)).toBe("INVITE_DAY3");
    expect(inviteReminderDue(inv(6), NOW, none)).toBe("INVITE_DAY3");
  });

  it("never sends the day-3 reminder twice", () => {
    expect(inviteReminderDue(inv(4), NOW, new Set<NotificationKind>(["INVITE_DAY3"]))).toBeNull();
  });

  it("sends the day-10 reminder from day 10, once", () => {
    const sent3 = new Set<NotificationKind>(["INVITE_DAY3"]);
    expect(inviteReminderDue(inv(10), NOW, sent3)).toBe("INVITE_DAY10");
    expect(inviteReminderDue(inv(12), NOW, new Set<NotificationKind>(["INVITE_DAY3", "INVITE_DAY10"]))).toBeNull();
  });

  it("a missed day-3 window gives only the day-10 reminder, never both", () => {
    expect(inviteReminderDue(inv(10.5), NOW, none)).toBe("INVITE_DAY10");
  });

  it("stops once the invitation expired or was answered", () => {
    expect(inviteReminderDue(inv(14), NOW, none)).toBeNull();
    expect(inviteReminderDue(inv(11, { expiresAt: daysAgo(0.1) }), NOW, none)).toBeNull();
    expect(inviteReminderDue(inv(4, { status: "ACCEPTED" }), NOW, none)).toBeNull();
    expect(inviteReminderDue(inv(4, { status: "CANCELLED" }), NOW, none)).toBeNull();
  });

  it("keys differ by reminder and invitation", () => {
    expect(dedupeKeys.invite("INVITE_DAY3", "i1")).not.toBe(dedupeKeys.invite("INVITE_DAY10", "i1"));
    expect(dedupeKeys.invite("INVITE_DAY3", "i1")).not.toBe(dedupeKeys.invite("INVITE_DAY3", "i2"));
  });
});

describe("your contract is ready", () => {
  it("goes to both parties, or the one party in solo mode", () => {
    expect(readyRecipients([initiator, respondent]).map((p) => p.id)).toEqual(["pa", "pb"]);
    expect(readyRecipients([initiator]).map((p) => p.id)).toEqual(["pa"]);
  });

  it("only for an agreed, unpaid deal while payments are on", () => {
    expect(readyEmailDue({ status: "AGREED", paid: false, billingOn: true })).toBe(true);
    expect(readyEmailDue({ status: "AGREED", paid: true, billingOn: true })).toBe(false);
    expect(readyEmailDue({ status: "AGREED", paid: false, billingOn: false })).toBe(false);
    expect(readyEmailDue({ status: "SIGNING", paid: false, billingOn: true })).toBe(false);
    expect(readyEmailDue({ status: "NEGOTIATING", paid: false, billingOn: true })).toBe(false);
  });

  it("one key per deal and party", () => {
    expect(dedupeKeys.ready("d1", "pa")).not.toBe(dedupeKeys.ready("d1", "pb"));
  });

  it("uses the stored billing currency, else the jurisdiction's", () => {
    expect(recipientCurrency({ stored: "eur", governingLaw: "CALIFORNIA" })).toBe("EUR");
    expect(recipientCurrency({ stored: "usd", governingLaw: "SPAIN" })).toBe("USD");
    expect(recipientCurrency({ governingLaw: "SPAIN" })).toBe("EUR");
    expect(recipientCurrency({ governingLaw: "ENGLAND_WALES" })).toBe("EUR");
    expect(recipientCurrency({ governingLaw: "CALIFORNIA" })).toBe("USD");
    expect(recipientCurrency({ governingLaw: "NEW_YORK" })).toBe("USD");
  });
});

describe("unfinished draft", () => {
  const draft = (idleDays: number, status = "DRAFT") => ({ status, lastActivityAt: daysAgo(idleDays) });

  it("is due two days after the last activity", () => {
    expect(draftReminderDue(draft(1.9), NOW, false)).toBe(false);
    expect(draftReminderDue(draft(2), NOW, false)).toBe(true);
    expect(draftReminderDue(draft(5), NOW, false)).toBe(true);
  });

  it("leaves long-forgotten drafts alone", () => {
    expect(draftReminderDue(draft(7), NOW, false)).toBe(false);
  });

  it("at most once per deal", () => {
    expect(draftReminderDue(draft(3), NOW, true)).toBe(false);
    expect(dedupeKeys.draft("d1")).toBe(dedupeKeys.draft("d1"));
  });

  it("only while the deal is still a draft", () => {
    for (const status of ["AWAITING_RESPONSE", "NEGOTIATING", "AGREED", "SIGNING", "COMPLETED", "CANCELLED"]) {
      expect(draftReminderDue(draft(3, status), NOW, false)).toBe(false);
    }
  });

  it("last activity is the latest of the deal, its selections and its log", () => {
    expect(lastActivity([daysAgo(5), null, daysAgo(1), undefined, daysAgo(3)])).toEqual(daysAgo(1));
    expect(lastActivity([])).toBeNull();
  });
});

describe("addresses, names, language", () => {
  it("writes to the account address first", () => {
    expect(partyEmail(initiator)).toBe("ana@example.com");
    expect(partyEmail(invitedOnly)).toBe("b@example.com");
  });

  it("never uses an email address as a name", () => {
    expect(partyName({ ...initiator, user: { email: "x@y.z", name: "x@y.z" }, name: null })).toBeNull();
    expect(partyName(initiator)).toBe("Ana Ruiz");
  });

  it("writes in the contract language", () => {
    expect(emailLanguage("es")).toBe("es");
    expect(emailLanguage("en")).toBe("en");
    expect(emailLanguage(null)).toBe("en");
  });
});

describe("solo first in the wizard", () => {
  it("starts in solo whenever the template supports it", () => {
    expect(defaultDealMode({ soloModeSupported: true, soloModeDefault: false, soloModeOnly: false })).toBe("SOLO");
    expect(defaultDealMode({ soloModeSupported: true, soloModeDefault: true, soloModeOnly: true })).toBe("SOLO");
  });

  it("keeps two parties for templates without solo", () => {
    expect(defaultDealMode({ soloModeSupported: false, soloModeDefault: false, soloModeOnly: false })).toBe(
      "NEGOTIATION",
    );
  });
});

describe("wording", () => {
  const KINDS: DealEmailKind[] = ["TURN_SELECTIONS", "TURN_COUNTER", "INVITE_DAY3", "INVITE_DAY10", "READY", "DRAFT"];
  const base = {
    url: "https://dealroom.example/deals/d1/sign",
    dealName: "Acme <NDA>",
    recipientName: "Bruno",
    otherName: "Ana Ruiz",
    price: "€29",
    expiresAt: new Date("2026-10-14T12:00:00Z"),
  };

  it("has the same keys in English and Spanish", () => {
    expect(Object.keys(es.dealEmails).sort()).toEqual(Object.keys(en.dealEmails).sort());
  });

  it("uses no long dashes", () => {
    for (const value of [...Object.values(en.dealEmails), ...Object.values(es.dealEmails)]) {
      expect(value).not.toMatch(/[–—]/);
    }
  });

  it.each(KINDS)("%s renders in both languages with the link and the deal name escaped", (kind) => {
    for (const language of ["en", "es"] as const) {
      const out = renderDealEmail({ ...base, kind, language });
      expect(out.subject).toContain("Acme <NDA>");
      expect(out.html).toContain("Acme &lt;NDA&gt;");
      expect(out.html).not.toContain("<NDA>");
      expect(out.html).toContain(base.url);
      expect(out.text).toContain(base.url);
      expect(out.text).not.toMatch(/\{\w+\}/);
    }
  });

  it("the ready email shows the price, or says it is paid once when no price is known", () => {
    expect(renderDealEmail({ ...base, kind: "READY", language: "en" }).text).toContain("The price is €29");
    expect(renderDealEmail({ ...base, kind: "READY", language: "es" }).text).toContain("El precio es €29");
    const noPrice = renderDealEmail({ ...base, price: null, kind: "READY", language: "en" });
    expect(noPrice.text).toContain(en.dealEmails.readyNoPrice);
    expect(noPrice.text).not.toContain("The price is");
  });

  it("the day-10 reminder names the expiry date", () => {
    expect(renderDealEmail({ ...base, kind: "INVITE_DAY10", language: "en" }).text).toContain("October 14, 2026");
    expect(renderDealEmail({ ...base, kind: "INVITE_DAY10", language: "es" }).text).toContain("14 de octubre de 2026");
  });

  it("falls back to 'the other party' and drops the greeting without a name", () => {
    const out = renderDealEmail({ ...base, otherName: null, recipientName: null, kind: "TURN_COUNTER", language: "es" });
    expect(out.text.startsWith("La otra parte ha enviado una contrapropuesta")).toBe(true);
  });
});
