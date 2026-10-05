"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The Dealroom home page (owner, 3 October 2026): what Dealroom does at a
 * glance and one call to action, in the manner of the contract template
 * sites. A headline, a "which contract do you need?" search over the public
 * contract guides (the same matcher as the new-deal wizard, so "NDA",
 * "SAFE" or "arrendamiento" find their contract), the popular contracts,
 * three steps and the price. No video, no scroll animations, and the header
 * sits in the page flow, so the top of the page is always reachable.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import StartupsHeader from "./components/StartupsHeader";
import StartupsFooter from "./components/StartupsFooter";
import en from "./i18n/en/dealroom-startups.json";
import es from "./i18n/es/dealroom-startups.json";
import { cleanUpLocaleCookie, readLocaleCookie, writeLocaleCookie } from "@/lib/locale-cookie";
import { contractPath, type PageLocale } from "@/lib/contract-pages-paths";
import { searchContracts } from "@/lib/contract-search";
import { signInHref } from "@/lib/sign-in-next";
import { PriceLine } from "@/components/contracts/PriceLine";

export interface LandingContract {
  slug: string;
  contractType: string;
  name: Record<PageLocale, string>;
  summary: Record<PageLocale, string>;
}

/** The tiles under the search, most asked for first, per language. */
const POPULAR: Record<PageLocale, string[]> = {
  en: [
    "nda",
    "consulting-agreement",
    "employment-agreement",
    "safe-agreement",
    "data-processing-agreement",
    "saas-agreement",
    "founders-agreement",
    "master-services-agreement",
  ],
  es: [
    "nda",
    "services-agreement-spain",
    "employment-contract-spain",
    "residential-lease-spain",
    "data-processing-agreement",
    "shareholders-agreement-spain",
    "ip-assignment-spain",
    "safe-agreement",
  ],
};

const COPY = {
  en: {
    title: "Contracts, drafted and agreed online",
    lead: "Choose a contract, answer a few questions and agree each clause with the other side in one shared place. No more Word files by email.",
    searchLabel: "Which contract do you need?",
    searchPlaceholder: "For example: NDA, SAFE, consulting",
    noMatch: "No contract matches that.",
    start: "Start a contract",
    seeAll: (n: number) => `See all ${n} contracts`,
    popular: "Popular contracts",
    howTitle: "How it works",
    steps: [
      ["Choose", "Pick the contract, the governing law and the language."],
      [
        "Agree",
        "Each side marks its preferred option for every clause. Where you differ, a published formula proposes a middle ground.",
      ],
      ["Sign", "Download the agreed contract or sign it online."],
    ],
    finalTitle: "Ready when you are",
    login: "Already have an account? Log in",
  },
  es: {
    title: "Contratos redactados y acordados en línea",
    lead: "Elige un contrato, responde a unas pocas preguntas y acuerda cada cláusula con la otra parte en un único espacio compartido. Sin enviar archivos de Word por correo.",
    searchLabel: "¿Qué contrato necesitas?",
    searchPlaceholder: "Por ejemplo: NDA, contrato laboral, arrendamiento",
    noMatch: "Ningún contrato coincide.",
    start: "Empezar un contrato",
    seeAll: (n: number) => `Ver los ${n} contratos`,
    popular: "Contratos más usados",
    howTitle: "Cómo funciona",
    steps: [
      ["Elige", "Escoge el contrato, la ley aplicable y el idioma."],
      [
        "Acuerda",
        "Cada parte marca su opción preferida en cada cláusula. Donde difieren, una fórmula publicada propone un punto intermedio.",
      ],
      ["Firma", "Descarga el contrato acordado o fírmalo en línea."],
    ],
    finalTitle: "Empieza cuando quieras",
    login: "¿Ya tienes cuenta? Inicia sesión",
  },
} as const;

function detectLocale(): PageLocale {
  if (typeof window === "undefined") return "en";
  const lang = new URLSearchParams(window.location.search).get("lang");
  if (lang === "es" || lang === "en") return lang;
  return readLocaleCookie() ?? "en";
}

export default function LandingPage({ contracts }: { contracts: LandingContract[] }) {
  const [locale, setLocale] = useState<PageLocale>("en");
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- locale detection reads cookies, which must happen after hydration; running it during render would mismatch the server-rendered markup
    setLocale(detectLocale());
    cleanUpLocaleCookie();
  }, []);

  const toggleLocale = useCallback(() => {
    const next = locale === "en" ? "es" : "en";
    writeLocaleCookie(next);
    setLocale(next);
  }, [locale]);

  const dict = locale === "es" ? es : en;
  const t = (key: string) => (dict as Record<string, string>)[key] ?? key;
  const copy = COPY[locale];
  const startHref = signInHref("/deals/new");

  const matches = useMemo(
    () =>
      query.trim()
        ? searchContracts(query, contracts, (c) => ({
            codes: [c.contractType],
            names: [c.name.en, c.name.es],
            descriptions: [c.summary.en, c.summary.es],
          })).slice(0, 6)
        : [],
    [query, contracts],
  );

  const popular = POPULAR[locale]
    .map((slug) => contracts.find((c) => c.slug === slug))
    .filter((c): c is LandingContract => Boolean(c));

  return (
    <>
      <StartupsHeader
        t={t}
        locale={locale}
        onLocaleToggle={toggleLocale}
        onSignup={() => router.push(startHref)}
      />
      <main lang={locale} className="px-6">
        {/* Headline, search and the one call to action */}
        <section className="max-w-3xl mx-auto pt-10 pb-12 md:pt-16">
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">{copy.title}</h1>
          <p className="mt-4 text-lg text-muted-foreground">{copy.lead}</p>

          <form
            className="mt-8"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(matches[0] ? contractPath(locale, matches[0].slug) : contractPath(locale));
            }}
          >
            <label htmlFor="contract-search" className="block text-sm font-semibold mb-2">
              {copy.searchLabel}
            </label>
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
                aria-hidden
              />
              <input
                id="contract-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={copy.searchPlaceholder}
                autoComplete="off"
                className="w-full h-14 pl-12 pr-4 rounded-xl border border-border bg-card text-base focus:outline-none focus:border-primary"
              />
            </div>
            {query.trim() && (
              <ul className="mt-2 rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {matches.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground">
                    {copy.noMatch}{" "}
                    <Link href={contractPath(locale)} className="text-primary hover:underline">
                      {copy.seeAll(contracts.length)}
                    </Link>
                  </li>
                ) : (
                  matches.map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={contractPath(locale, c.slug)}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/50"
                      >
                        <span className="font-medium">{c.name[locale]}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            )}
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a href={startHref} className="btn-primary inline-flex items-center gap-2 py-3 px-6">
              {copy.start}
              <ArrowRight className="w-4 h-4" aria-hidden />
            </a>
            <Link href={contractPath(locale)} className="text-sm text-primary hover:underline">
              {copy.seeAll(contracts.length)}
            </Link>
          </div>
          <div className="mt-4">
            <PriceLine locale={locale} />
          </div>
        </section>

        {/* Popular contracts */}
        <section className="max-w-5xl mx-auto pb-14">
          <h2 className="text-2xl font-bold mb-4">{copy.popular}</h2>
          <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {popular.map((c) => (
              <li key={c.slug}>
                <Link
                  href={contractPath(locale, c.slug)}
                  className="flex h-full items-center justify-between gap-3 border border-border rounded-xl bg-card px-4 py-4 hover:border-primary transition-colors"
                >
                  <span className="font-semibold leading-snug">{c.name[locale]}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section className="max-w-5xl mx-auto pb-14">
          <h2 className="text-2xl font-bold mb-4">{copy.howTitle}</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {copy.steps.map(([title, text], i) => (
              <li key={title} className="border border-border rounded-xl bg-card p-5">
                <span className="text-sm font-semibold text-primary">{i + 1}</span>
                <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* The one call to action, again */}
        <section className="max-w-3xl mx-auto pb-16 text-center">
          <h2 className="text-2xl font-bold">{copy.finalTitle}</h2>
          <div className="mt-5 flex justify-center">
            <a href={startHref} className="btn-primary inline-flex items-center gap-2 py-3 px-6">
              {copy.start}
              <ArrowRight className="w-4 h-4" aria-hidden />
            </a>
          </div>
          <p className="mt-4 text-sm">
            <a href="/sign-in" className="text-muted-foreground hover:text-foreground">
              {copy.login}
            </a>
          </p>
          <div className="mt-3 flex justify-center">
            <PriceLine locale={locale} />
          </div>
        </section>
      </main>
      <StartupsFooter t={t} />
    </>
  );
}
