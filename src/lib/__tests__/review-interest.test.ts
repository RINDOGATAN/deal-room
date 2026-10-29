// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The lawyer-review interest line on a finished DPA: where it shows, the
 * two outcomes of the panel, the events each step counts, and "shown" at
 * most once per deal per browser session.
 */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/trpc", () => ({ trpc: {} }));

import {
  INITIAL_REVIEW_PANEL,
  NORTH_END_LAW_DPA_REVIEW_URL,
  REVIEW_INTEREST_COPY,
  claimShownOnce,
  reviewPanelStep,
  showsReviewInterest,
  type ReviewInterestInput,
  type ReviewPanelAction,
  type ReviewPanelState,
} from "../review-interest";
import { ReviewInterestPanel } from "@/components/review-interest/ReviewInterest";

function run(actions: ReviewPanelAction[], locale: "en" | "es" = "en") {
  let state: ReviewPanelState = INITIAL_REVIEW_PANEL;
  const events: ReviewInterestInput[] = [];
  for (const a of actions) {
    const next = reviewPanelStep(state, a, locale);
    state = next.state;
    if (next.event) events.push(next.event);
  }
  return { state, events };
}

const render = (state: ReviewPanelState, locale: "en" | "es" = "en") =>
  renderToStaticMarkup(createElement(ReviewInterestPanel, { locale, onEvent: () => {}, initialState: state }));

describe("where the line shows", () => {
  it("only on a DPA that is a finished draft", () => {
    expect(showsReviewInterest("DPA", "AGREED")).toBe(true);
    expect(showsReviewInterest("DPA", "SIGNING")).toBe(true);
    expect(showsReviewInterest("DPA", "COMPLETED")).toBe(true);
    expect(showsReviewInterest("DPA", "DRAFT")).toBe(false);
    expect(showsReviewInterest("DPA", "NEGOTIATING")).toBe(false);
    expect(showsReviewInterest("NDA", "AGREED")).toBe(false);
    expect(showsReviewInterest(undefined, "AGREED")).toBe(false);
  });
});

describe("the panel flow", () => {
  it("starts as one line, closed", () => {
    const html = render(INITIAL_REVIEW_PANEL);
    expect(html).toContain("Would you like a lawyer to review this DPA?");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Where is your business?");
  });

  it("California: counts the click, the answers and the link, and shows the firm's form", () => {
    const { state, events } = run([
      { type: "toggle" },
      { type: "submit" }, // nothing chosen yet: ignored
      { type: "jurisdiction", value: "california" },
      { type: "submit" }, // speed missing: ignored
      { type: "speed", value: "same_day" },
      { type: "submit" },
      { type: "follow-link" },
      { type: "follow-link" }, // counted once per view
    ]);
    expect(events).toEqual([
      { event: "clicked", locale: "en" },
      { event: "answered", locale: "en", jurisdiction: "california", speed: "same_day" },
      { event: "california_link", locale: "en", jurisdiction: "california", speed: "same_day" },
    ]);
    const html = render(state);
    expect(html).toContain('data-testid="review-interest-california"');
    expect(html).toContain(`href="${NORTH_END_LAW_DPA_REVIEW_URL.replace(/&/g, "&amp;")}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain("North End Law, a California law firm, reviews DPAs. Continue to its request form →");
    expect(NORTH_END_LAW_DPA_REVIEW_URL).toBe("https://northend.law/submit-a-matter?category=commercial-dpa-terms&source=dealroom");
  });

  it("anywhere else: counts the answers and thanks the user, with no link", () => {
    const { state, events } = run(
      [
        { type: "toggle" },
        { type: "jurisdiction", value: "eu" },
        { type: "speed", value: "this_week" },
        { type: "submit" },
        { type: "submit" },
        { type: "follow-link" },
      ],
      "es",
    );
    expect(events).toEqual([
      { event: "clicked", locale: "es" },
      { event: "answered", locale: "es", jurisdiction: "eu", speed: "this_week" },
    ]);
    const html = render(state, "es");
    expect(html).toContain(REVIEW_INTEREST_COPY.es.notOffered);
    expect(html).not.toContain("northend.law");
  });

  it("counts the click once, however often the panel is opened and closed", () => {
    const { state, events } = run([{ type: "toggle" }, { type: "toggle" }, { type: "toggle" }]);
    expect(state.open).toBe(true);
    expect(events).toHaveLength(1);
  });

  it("shows both questions and their options in each language", () => {
    const open = { ...INITIAL_REVIEW_PANEL, open: true, clicked: true };
    const en = render(open);
    for (const t of ["Where is your business?", "Another US state", "European Union", "United Kingdom", "Elsewhere", "How soon do you need it?", "Within 2 hours", "The same day", "This week", "Continue"]) {
      expect(en).toContain(t);
    }
    const es = render(open, "es");
    for (const t of ["¿Quieres que un abogado revise este DPA?", "¿Dónde está tu empresa?", "Otro estado de EE. UU.", "Unión Europea", "Reino Unido", "Otro lugar", "¿Para cuándo lo necesitas?", "En 2 horas", "En el día", "Esta semana", "Continuar"]) {
      expect(es).toContain(t);
    }
    expect(es).not.toMatch(/usted|—/);
  });
});

describe("shown once per deal per browser session", () => {
  it("claims a deal the first time only", () => {
    const map = new Map<string, string>();
    const store = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    expect(claimShownOnce(store, "deal-1")).toBe(true);
    expect(claimShownOnce(store, "deal-1")).toBe(false);
    expect(claimShownOnce(store, "deal-2")).toBe(true);
  });

  it("counts once per page load when storage is unavailable", () => {
    expect(claimShownOnce(null, "deal-1")).toBe(true);
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    };
    expect(claimShownOnce(throwing, "deal-1")).toBe(true);
  });
});
