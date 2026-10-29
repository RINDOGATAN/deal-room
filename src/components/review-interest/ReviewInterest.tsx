"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * One small line under a finished DPA asking whether the user wants a
 * lawyer to review it. Clicking opens an inline panel (never a modal) with
 * two questions; Continue shows either the California firm's link or a
 * thank-you note. Each step is counted anonymously through
 * `reviewInterest.record`; "shown" once per deal per browser session. The
 * flow itself is `reviewPanelStep` in `@/lib/review-interest`.
 */

import { useEffect, useId, useState } from "react";
import { Scale } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  INITIAL_REVIEW_PANEL,
  NORTH_END_LAW_DPA_REVIEW_URL,
  REVIEW_INTEREST_COPY,
  REVIEW_JURISDICTIONS,
  REVIEW_SPEEDS,
  claimShownOnce,
  reviewOutcome,
  reviewPanelStep,
  type ReviewInterestInput,
  type ReviewLocale,
  type ReviewPanelAction,
  type ReviewPanelState,
} from "@/lib/review-interest";

type EventSink = (input: ReviewInterestInput) => void;

function sessionStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Wired to the counter; the panel itself is `ReviewInterestPanel`. */
export function ReviewInterest({ dealId, locale }: { dealId: string; locale: string }) {
  const lang: ReviewLocale = locale === "es" ? "es" : "en";
  const { mutate } = trpc.reviewInterest.record.useMutation();
  // Counting never blocks or interrupts the page: failures are ignored.
  const send: EventSink = (input) => mutate(input, { onError: () => {} });

  useEffect(() => {
    if (claimShownOnce(sessionStore(), dealId)) {
      mutate({ event: "shown", locale: lang }, { onError: () => {} });
    }
  }, [dealId, lang, mutate]);

  return <ReviewInterestPanel locale={lang} onEvent={send} />;
}

/** The line, the questions and the outcome, with no data access. */
export function ReviewInterestPanel({
  locale,
  onEvent,
  initialState = INITIAL_REVIEW_PANEL,
}: {
  locale: ReviewLocale;
  onEvent: EventSink;
  initialState?: ReviewPanelState;
}) {
  const copy = REVIEW_INTEREST_COPY[locale];
  const id = useId();
  const [state, setState] = useState(initialState);

  const dispatch = (action: ReviewPanelAction) => {
    const next = reviewPanelStep(state, action, locale);
    setState(next.state);
    if (next.event) onEvent(next.event);
  };

  const pill =
    "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/10";

  return (
    <div data-testid="review-interest" className="text-sm">
      <button
        type="button"
        onClick={() => dispatch({ type: "toggle" })}
        aria-expanded={state.open}
        aria-controls={`${id}-panel`}
        className="inline-flex items-center gap-2 text-primary hover:underline text-left"
      >
        <Scale className="w-4 h-4 shrink-0" aria-hidden />
        {copy.line}
      </button>

      {state.open && (
        <div id={`${id}-panel`} className="mt-3 border border-border rounded-lg bg-card p-4">
          {state.submitted ? (
            reviewOutcome(state.submitted.jurisdiction) === "california" ? (
              <p data-testid="review-interest-california">
                <a
                  href={NORTH_END_LAW_DPA_REVIEW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  onClick={() => dispatch({ type: "follow-link" })}
                >
                  {copy.california}
                </a>
              </p>
            ) : (
              <p data-testid="review-interest-not-offered" className="text-muted-foreground">
                {copy.notOffered}
              </p>
            )
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                dispatch({ type: "submit" });
              }}
              className="space-y-4"
            >
              <fieldset>
                <legend className="font-semibold mb-2">{copy.whereLabel}</legend>
                <div className="flex flex-wrap gap-2">
                  {REVIEW_JURISDICTIONS.map((j) => (
                    <label key={j} className={pill}>
                      <input
                        type="radio"
                        name={`${id}-jurisdiction`}
                        value={j}
                        checked={state.jurisdiction === j}
                        onChange={() => dispatch({ type: "jurisdiction", value: j })}
                        className="accent-primary"
                      />
                      {copy.jurisdictions[j]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="font-semibold mb-2">{copy.speedLabel}</legend>
                <div className="flex flex-wrap gap-2">
                  {REVIEW_SPEEDS.map((s) => (
                    <label key={s} className={pill}>
                      <input
                        type="radio"
                        name={`${id}-speed`}
                        value={s}
                        checked={state.speed === s}
                        onChange={() => dispatch({ type: "speed", value: s })}
                        className="accent-primary"
                      />
                      {copy.speeds[s]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="submit"
                disabled={!state.jurisdiction || !state.speed}
                className="btn-brutal disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copy.continue}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
