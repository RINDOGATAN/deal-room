// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Lawyer-review interest line on a finished DPA: the allowed answers, the
 * wording, the outcome of each answer and the counter's input schema.
 * Shared by the deal page (client) and the reviewInterest router (server).
 *
 * The counter stores anonymous events only: the event name, the two
 * answers and the page language. Nothing that identifies a person, a deal
 * or a browser is accepted (the schema is strict) or stored.
 */

import { z } from "zod";

/** The only contract type that shows the line. */
export const REVIEW_INTEREST_CONTRACT_TYPE = "DPA";

/** Deal statuses at which the DPA is a finished draft. */
export const REVIEW_INTEREST_STATUSES = ["AGREED", "SIGNING", "COMPLETED"] as const;

export const REVIEW_JURISDICTIONS = ["california", "us_other", "eu", "uk", "elsewhere"] as const;
export const REVIEW_SPEEDS = ["two_hours", "same_day", "this_week"] as const;
export const REVIEW_LOCALES = ["en", "es"] as const;

export type ReviewJurisdiction = (typeof REVIEW_JURISDICTIONS)[number];
export type ReviewSpeed = (typeof REVIEW_SPEEDS)[number];
export type ReviewLocale = (typeof REVIEW_LOCALES)[number];

/** Category value passed to the California firm's request form. */
export const NORTH_END_LAW_DPA_CATEGORY = "commercial-dpa-terms";

/** The California firm's request form, opened in a new tab. */
export const NORTH_END_LAW_DPA_REVIEW_URL = `https://northend.law/submit-a-matter?category=${encodeURIComponent(
  NORTH_END_LAW_DPA_CATEGORY,
)}&source=dealroom`;

export function showsReviewInterest(contractType: string | null | undefined, status: string): boolean {
  return (
    contractType === REVIEW_INTEREST_CONTRACT_TYPE &&
    (REVIEW_INTEREST_STATUSES as readonly string[]).includes(status)
  );
}

export type ReviewOutcome = "california" | "not_offered";

/** California answers get the firm's link; every other answer the thank-you note. */
export function reviewOutcome(jurisdiction: ReviewJurisdiction): ReviewOutcome {
  return jurisdiction === "california" ? "california" : "not_offered";
}

const locale = z.enum(REVIEW_LOCALES);

/** What the counter accepts: four event shapes, nothing else. */
export const reviewInterestInput = z.discriminatedUnion("event", [
  z.object({ event: z.literal("shown"), locale }).strict(),
  z.object({ event: z.literal("clicked"), locale }).strict(),
  z
    .object({
      event: z.literal("answered"),
      locale,
      jurisdiction: z.enum(REVIEW_JURISDICTIONS),
      speed: z.enum(REVIEW_SPEEDS),
    })
    .strict(),
  z
    .object({
      event: z.literal("california_link"),
      locale,
      jurisdiction: z.literal("california"),
      speed: z.enum(REVIEW_SPEEDS),
    })
    .strict(),
]);

export type ReviewInterestInput = z.infer<typeof reviewInterestInput>;

/** The row written for an accepted event: these five columns only. */
export function reviewInterestRow(input: ReviewInterestInput): {
  event: string;
  jurisdiction: string | null;
  speed: string | null;
  locale: string;
} {
  return {
    event: input.event,
    jurisdiction: "jurisdiction" in input ? input.jurisdiction : null,
    speed: "speed" in input ? input.speed : null,
    locale: input.locale,
  };
}

// ---------------------------------------------------------------------------
// The panel's flow, as a pure step function (the component only renders it)

export interface ReviewPanelState {
  open: boolean;
  /** "clicked" is counted once per page view. */
  clicked: boolean;
  jurisdiction: ReviewJurisdiction | null;
  speed: ReviewSpeed | null;
  submitted: { jurisdiction: ReviewJurisdiction; speed: ReviewSpeed } | null;
  /** The California link is counted once per page view. */
  linked: boolean;
}

export const INITIAL_REVIEW_PANEL: ReviewPanelState = {
  open: false,
  clicked: false,
  jurisdiction: null,
  speed: null,
  submitted: null,
  linked: false,
};

export type ReviewPanelAction =
  | { type: "toggle" }
  | { type: "jurisdiction"; value: ReviewJurisdiction }
  | { type: "speed"; value: ReviewSpeed }
  | { type: "submit" }
  | { type: "follow-link" };

/** The next state, and the event to count, if any. */
export function reviewPanelStep(
  state: ReviewPanelState,
  action: ReviewPanelAction,
  locale: ReviewLocale,
): { state: ReviewPanelState; event: ReviewInterestInput | null } {
  switch (action.type) {
    case "toggle": {
      const first = !state.open && !state.clicked;
      return {
        state: { ...state, open: !state.open, clicked: state.clicked || first },
        event: first ? { event: "clicked", locale } : null,
      };
    }
    case "jurisdiction":
      return { state: state.submitted ? state : { ...state, jurisdiction: action.value }, event: null };
    case "speed":
      return { state: state.submitted ? state : { ...state, speed: action.value }, event: null };
    case "submit": {
      const { jurisdiction, speed } = state;
      if (!jurisdiction || !speed || state.submitted) return { state, event: null };
      return {
        state: { ...state, submitted: { jurisdiction, speed } },
        event: { event: "answered", locale, jurisdiction, speed },
      };
    }
    case "follow-link": {
      const s = state.submitted;
      if (!s || reviewOutcome(s.jurisdiction) !== "california" || state.linked) return { state, event: null };
      return {
        state: { ...state, linked: true },
        event: { event: "california_link", locale, jurisdiction: "california", speed: s.speed },
      };
    }
  }
}

type SessionStore = Pick<Storage, "getItem" | "setItem">;

/**
 * True the first time a deal's line is shown in this browser session, so
 * reloads do not count it again. The deal id stays in the browser's
 * session storage; it is never sent. Without storage (private mode,
 * blocked) it counts once per page load.
 */
export function claimShownOnce(store: SessionStore | null | undefined, dealId: string): boolean {
  const key = `dealroom.reviewInterest.shown.${dealId}`;
  try {
    if (!store) return true;
    if (store.getItem(key)) return false;
    store.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

export const REVIEW_INTEREST_COPY = {
  en: {
    line: "Would you like a lawyer to review this DPA?",
    whereLabel: "Where is your business?",
    jurisdictions: {
      california: "California",
      us_other: "Another US state",
      eu: "European Union",
      uk: "United Kingdom",
      elsewhere: "Elsewhere",
    },
    speedLabel: "How soon do you need it?",
    speeds: { two_hours: "Within 2 hours", same_day: "The same day", this_week: "This week" },
    continue: "Continue",
    california: "North End Law, a California law firm, reviews DPAs. Continue to its request form →",
    notOffered: "We do not offer this in your jurisdiction yet. Thank you: your answer helps us decide where to offer it.",
  },
  es: {
    line: "¿Quieres que un abogado revise este DPA?",
    whereLabel: "¿Dónde está tu empresa?",
    jurisdictions: {
      california: "California",
      us_other: "Otro estado de EE. UU.",
      eu: "Unión Europea",
      uk: "Reino Unido",
      elsewhere: "Otro lugar",
    },
    speedLabel: "¿Para cuándo lo necesitas?",
    speeds: { two_hours: "En 2 horas", same_day: "En el día", this_week: "Esta semana" },
    continue: "Continuar",
    california: "North End Law, un despacho de California, revisa DPA. Continúa en su formulario →",
    notOffered: "Todavía no lo ofrecemos en tu jurisdicción. Gracias: tu respuesta nos ayuda a decidir dónde ofrecerlo.",
  },
} satisfies Record<
  ReviewLocale,
  {
    line: string;
    whereLabel: string;
    jurisdictions: Record<ReviewJurisdiction, string>;
    speedLabel: string;
    speeds: Record<ReviewSpeed, string>;
    continue: string;
    california: string;
    notOffered: string;
  }
>;
