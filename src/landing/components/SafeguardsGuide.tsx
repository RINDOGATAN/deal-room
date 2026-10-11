"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The safeguards guide, ported from AI Sentinel's landing (itself the TODO.LAW
 * storefront's SafeguardsWizard): a calm block after the hosting boxes ("Not sure which
 * to choose?") that opens in place into six questions and recommends one way. The logic,
 * the level table and the copy live in src/landing/config/safeguards.ts; the way names
 * are this landing's own box titles (`<locale>.ways.wN.title`). Three ways in both
 * languages: the TODO.LAW cloud, the managed virtual server and your own hardware.
 *
 * The state (open, answers) belongs to the hosting section, which marks the recommended
 * box from it; this component only draws it. The result links to that box on the page.
 */

import { useId } from "react";
import {
  COPY,
  QUESTIONS,
  WAY_CARD,
  optionsFor,
  recommend,
  type Answers,
  type Locale,
  type QuestionId,
  type Recommendation,
  type WayId,
} from "../config/safeguards";

type T = (key: string) => string;

/** The id of a way's box on the page, so the guide can link to it. */
export const wayBoxId = (p: Locale, n: number) => `${p}-way-${n}`;

interface SafeguardsGuideProps {
  t: T;
  p: Locale;
  open: boolean;
  answers: Answers;
  onToggle: () => void;
  onAnswer: (q: QuestionId, value: string) => void;
  onReset: () => void;
}

export default function SafeguardsGuide({ t, p, open, answers, onToggle, onAnswer, onReset }: SafeguardsGuideProps) {
  const c = COPY[p];
  const uid = useId();
  const rec = open ? recommend(answers, p) : null;

  const card = (w: WayId) => WAY_CARD[p][w] as number;
  const name = (w: WayId) => t(`${p}.ways.w${card(w)}.title`);
  const headingId = `${uid}-h`;
  const panelId = `${uid}-panel`;
  const cardId = `${uid}-result`;

  const neighbour = (kind: string, n: Recommendation["up"], edge: string) => (
    <div className="rounded-xl border border-border p-3 text-sm font-body">
      <span className="block text-muted-foreground text-xs uppercase tracking-wider">{kind}</span>
      {n ? (
        <>
          <span className="block font-medium mt-0.5 mb-1">{name(n.way)}</span>
          <span className="text-muted-foreground">
            {n.missing.length ? `${c.miss}${n.missing.map((k) => c.safeguards[k]).join("; ")}.` : c.all}
          </span>
        </>
      ) : (
        <span className="block text-muted-foreground mt-0.5">{edge}</span>
      )}
    </div>
  );

  return (
    <section
      aria-labelledby={headingId}
      data-testid="safeguards-guide"
      className="mt-10 max-w-6xl mx-auto rounded-2xl border border-border bg-card p-5 sm:p-7"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h3 id={headingId} className="text-xl md:text-2xl font-display leading-tight mb-1.5">
            {c.heading}
          </h3>
          <p className="text-muted-foreground text-sm md:text-base font-body leading-relaxed max-w-[62ch] m-0">{c.lead}</p>
        </div>
        <button
          type="button"
          className="shrink-0 self-start sm:self-center inline-flex items-center rounded-full border border-accent/60 px-5 py-2.5 text-sm font-medium font-body text-accent hover:bg-accent/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          {open ? c.close : c.open}
        </button>
      </div>

      {open && (
        <div id={panelId} className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
          <form aria-label={c.formLegend} onSubmit={(e) => e.preventDefault()} className="min-w-0 pb-4 lg:pb-0 font-body">
            <p className="text-muted-foreground text-sm mt-0 mb-2">{c.formSub}</p>
            {QUESTIONS.map((q, n) => {
              const qc = c.questions[q.id];
              const hintId = qc.hint ? `${uid}-${q.id}-hint` : undefined;
              return (
                <fieldset key={q.id} className="border-0 border-t border-border m-0 px-0 pt-4 pb-2 min-w-0" aria-describedby={hintId}>
                  <legend className="float-left w-full p-0 mb-2 font-medium text-[0.95rem]">
                    <span className="text-accent mr-1.5">{n + 1}.</span>
                    {qc.label}
                  </legend>
                  <div className="clear-both flex flex-col gap-1.5">
                    {optionsFor(q, p).map((o) => {
                      const id = `${uid}-${q.id}-${o.value}`;
                      return (
                        <label
                          key={o.value}
                          htmlFor={id}
                          className="flex gap-2.5 items-start rounded-[10px] border border-transparent px-2.5 py-2 cursor-pointer text-sm hover:bg-secondary/40 has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
                        >
                          <input
                            type="radio"
                            id={id}
                            name={`${uid}-${q.id}`}
                            value={o.value}
                            checked={answers[q.id] === o.value}
                            onChange={() => onAnswer(q.id, o.value)}
                            className="scroll-mb-24 lg:scroll-mb-0 mt-[3px] w-4 h-4 shrink-0 accent-[var(--accent)] focus:outline-none"
                          />
                          <span className="min-w-0">{qc.options[o.value]}</span>
                        </label>
                      );
                    })}
                  </div>
                  {qc.hint && (
                    <p id={hintId} className="clear-both text-muted-foreground text-[0.82rem] mt-1.5 mb-0 ml-0.5">
                      {qc.hint}
                    </p>
                  )}
                </fieldset>
              );
            })}
            <button
              type="button"
              onClick={onReset}
              className="mt-3 text-sm text-muted-foreground border border-border rounded-full px-4 py-1.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {c.reset}
            </button>
          </form>

          {/*
            Phone and tablet: the result card sits below the six questions, so a compact bar
            follows the visitor down the form (sticky inside the guide, never over the result
            card). It does not announce: the status in the card already does.
          */}
          {rec && (
            <div
              data-testid="safeguards-bar"
              className="lg:hidden sticky bottom-3 z-10 -mt-2 flex items-center justify-between gap-3 rounded-xl border border-accent bg-card px-4 py-2.5 shadow-[0_-6px_18px_rgba(0,0,0,0.45),0_8px_24px_-8px_rgba(83,174,204,0.35)]"
            >
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-[0.72rem] uppercase tracking-wider text-accent font-body">{c.rec}</span>
                <span className="block font-display text-base leading-tight">{name(rec.way)}</span>
              </span>
              <a
                href={`#${cardId}`}
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById(cardId);
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  el?.focus({ preventScroll: true });
                }}
                className="shrink-0 max-w-[9rem] text-right text-accent text-sm font-body leading-snug underline underline-offset-4"
              >
                {c.seeResult}
              </a>
            </div>
          )}

          <div className="flex flex-col gap-4 min-w-0 lg:sticky lg:top-24 font-body">
            <div id={cardId} tabIndex={-1} className="rounded-2xl border border-border bg-background p-5 scroll-mt-24 focus:outline-none">
              <div role="status" aria-live="polite" aria-atomic="true">
                <p className="text-xs uppercase tracking-wider text-accent m-0 mb-1">{c.rec}</p>
                {rec ? (
                  <p className="font-display text-2xl leading-tight m-0 mb-2.5">{name(rec.way)}</p>
                ) : (
                  <p className="text-muted-foreground text-sm m-0">{c.empty}</p>
                )}
              </div>
              {rec && (
                <>
                  <p className="text-muted-foreground text-sm leading-relaxed mt-0 mb-4">{c.summaries[rec.way]}</p>
                  <p className="text-xs uppercase tracking-wider text-accent m-0 mb-2">{c.meets}</p>
                  {rec.checks.length === 0 ? (
                    <p className="text-muted-foreground text-sm mt-0 mb-4">{c.none}</p>
                  ) : (
                    <ul className="list-none m-0 mb-4 p-0 flex flex-col gap-2">
                      {rec.checks.map(({ key, met }) => (
                        <li key={key} className="grid grid-cols-[22px_minmax(0,1fr)] gap-1.5 text-sm">
                          <span aria-hidden="true" className={`font-bold ${met ? "text-[#5cc794]" : "text-[#e8735f]"}`}>
                            {met ? "✓" : "✗"}
                          </span>
                          <span>
                            <span className="sr-only">{met ? c.met : c.notMet}: </span>
                            {c.safeguards[key]}
                            <small className="block text-muted-foreground text-[0.82rem]">{c.notes[key][rec.way]}</small>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2">
                    {neighbour(c.up, rec.up, c.top)}
                    {neighbour(c.down, rec.down, c.bottom)}
                  </div>
                  <a
                    href={`#${wayBoxId(p, card(rec.way))}`}
                    className="inline-block mt-4 text-accent text-sm underline underline-offset-4 hover:no-underline"
                  >
                    {c.see}: {name(rec.way)} →
                  </a>
                </>
              )}
            </div>
            <div className="border-l-[3px] border-accent pl-3.5 py-1">
              <h4 className="text-base font-medium m-0 mb-1.5">{c.whyH}</h4>
              <p className="text-muted-foreground text-sm leading-relaxed m-0">{c.whyP}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
