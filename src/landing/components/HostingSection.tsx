"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Where Dealroom runs, at the foot of the home (owner, 10 Oct 2026): the three
 * ways the storefront and the DPO Central and AI Sentinel landings offer (the
 * TODO.LAW cloud, a managed virtual server, your own hardware), with the
 * owner's wording, no prices, and the safeguards guide beneath. The cloud box
 * starts a contract; the other two write to us. The boxes stay still under
 * the pointer, so nothing moves as the page scrolls.
 */

import { useState } from "react";
import { Cloud, HardDrive, Mail, Server, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { brand } from "@/config/brand";
import SafeguardsGuide, { wayBoxId } from "./SafeguardsGuide";
import { WAY_CARD, recommend, type Answers, type Locale, type QuestionId } from "../config/safeguards";

type T = (key: string) => string;

const WAYS: { icon: LucideIcon; action: "start" | "mail" }[] = [
  { icon: Cloud, action: "start" },
  { icon: Server, action: "mail" },
  { icon: HardDrive, action: "mail" },
];

const LETTERS = "abc";

/** A box the guide recommends: the accent border and a soft glow, nothing added inside. */
const WAY_ON = " !border-accent shadow-[0_0_0_1px_rgba(83,174,204,0.25),0_20px_60px_-20px_rgba(83,174,204,0.45)]";

const linkClass =
  "mt-auto inline-flex items-center gap-2 self-start text-sm font-medium text-accent hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";

export interface GuideState {
  open: boolean;
  answers: Answers;
}

export default function HostingSection({
  t,
  locale,
  startHref,
  initialGuide = { open: false, answers: {} },
}: {
  t: T;
  locale: Locale;
  /** Where the cloud box leads: a new contract (through sign-in). */
  startHref: string;
  /** For tests; the page starts with the guide closed and nothing answered. */
  initialGuide?: GuideState;
}) {
  const p = locale;
  const k = `${p}.ways`;
  const [open, setOpen] = useState(initialGuide.open);
  const [answers, setAnswers] = useState<Answers>(initialGuide.answers);
  const rec = open ? recommend(answers, p) : null;
  const marked = rec ? WAY_CARD[p][rec.way] : null;

  return (
    <section className="py-16 md:py-24" aria-labelledby={`${k}-heading`} data-testid="hosting">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-10 md:mb-14">
          <span className="text-xs uppercase tracking-wider text-accent font-semibold">{t(`${k}.label`)}</span>
          <h2 id={`${k}-heading`} className="text-2xl md:text-4xl font-bold mt-2 mb-4">
            {t(`${k}.heading.prefix`)}
            <span className="text-accent">{t(`${k}.heading.accent`)}</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">{t(`${k}.sub`)}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {WAYS.map(({ icon: Icon, action }, i) => {
            const n = i + 1;
            const title = t(`${k}.w${n}.title`);
            return (
              <article
                key={n}
                id={wayBoxId(p, n)}
                className={`bg-card border border-border rounded-2xl p-6 flex flex-col scroll-mt-24${marked === n ? WAY_ON : ""}`}
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
                    <Icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <span className="text-3xl font-bold text-muted-foreground" aria-hidden="true">
                    {LETTERS[i]}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">{t(`${k}.w${n}.desc`)}</p>
                {action === "start" ? (
                  <a href={startHref} className={linkClass}>
                    {t(`${k}.start`)}
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </a>
                ) : (
                  <a
                    href={`mailto:${brand.contactEmail}?subject=${encodeURIComponent(t(`${k}.w${n}.subject`))}`}
                    className={linkClass}
                  >
                    <Mail className="w-4 h-4" aria-hidden="true" />
                    {t(`${k}.request`)}
                    <span className="sr-only">: {title}</span>
                  </a>
                )}
              </article>
            );
          })}
        </div>

        <SafeguardsGuide
          t={t}
          p={p}
          open={open}
          answers={answers}
          onToggle={() => setOpen((o) => !o)}
          onAnswer={(q: QuestionId, v: string) => setAnswers((a) => ({ ...a, [q]: v }))}
          onReset={() => setAnswers({})}
        />
      </div>
    </section>
  );
}
