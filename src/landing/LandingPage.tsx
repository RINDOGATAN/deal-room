"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The Dealroom home page, under the header every public page shares
 * (PublicHeader). It opens with the hero (HomeHero: the background video, the
 * headline and the sign-up card), then the contract index: a "which contract
 * do you need?" search over the public contract guides (the same matcher as
 * the new-deal wizard, so "NDA", "SAFE" or "arrendamiento" find their
 * contract) and one plain link per guide, grouped as on /contracts, so every
 * guide is linked from the server-rendered home. Then the core product page:
 * why Dealroom, a link to the documentation, how it works, the core
 * capabilities, the links for developers and AI agents (Dealroom is one
 * service for everyone, not an instance per customer), and at the foot the
 * three ways to host it with the safeguards guide. Spanish shows euros only.
 * No scroll animations: nothing moves as the page scrolls.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, Check, Code, Globe, Lock, Scale, FileSignature, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import HostingSection from "./components/HostingSection";
import CustomerLogos from "./components/CustomerLogos";
import HomeHero from "./components/HomeHero";
import en from "./i18n/en/dealroom-startups.json";
import es from "./i18n/es/dealroom-startups.json";
import authEn from "./i18n/en/startups-auth.json";
import authEs from "./i18n/es/startups-auth.json";
import { cleanUpLocaleCookie, readLocaleCookie, writeLocaleCookie } from "@/lib/locale-cookie";
import {
  CONTRACT_GROUPS,
  contractPath,
  developersPath,
  type ContractGroupId,
  type PageLocale,
} from "@/lib/contract-pages-paths";
import { AGENTS_PATH } from "@/components/public/nav-copy";
import { searchContracts } from "@/lib/contract-search";
import { signInHref } from "@/lib/sign-in-next";
import { PriceLine } from "@/components/contracts/PriceLine";

export interface LandingContract {
  slug: string;
  contractType: string;
  group: ContractGroupId;
  name: Record<PageLocale, string>;
  summary: Record<PageLocale, string>;
}

const COPY = {
  en: {
    title: "Contracts, drafted and agreed online",
    lead: "Choose a contract, answer a few questions and agree each clause with the other side in one shared place. No more Word files by email.",
    searchLabel: "Which contract do you need?",
    searchPlaceholder: "For example: NDA, SAFE, consulting",
    noMatch: "No contract matches that.",
    start: "Start a contract",
    seeAll: (n: number) => `See all ${n} contracts`,
    howTitle: "How it works",
    steps: [
      ["Choose", "Pick the contract, the governing law and the language."],
      [
        "Agree",
        "Each side marks its preferred option for every clause. Where you differ, a published formula proposes a middle ground.",
      ],
      ["Sign", "Download the agreed contract or sign it online."],
    ],
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
    howTitle: "Cómo funciona",
    steps: [
      ["Elige", "Escoge el contrato, la ley aplicable y el idioma."],
      [
        "Acuerda",
        "Cada parte marca su opción preferida en cada cláusula. Donde difieren, una fórmula publicada propone un punto intermedio.",
      ],
      ["Firma", "Descarga el contrato acordado o fírmalo en línea."],
    ],
    login: "¿Ya tienes cuenta? Inicia sesión",
  },
} as const;

/** The core capabilities, by their keys in the landing dictionary (`feat.<id>.*`). */
const FEATURES: { id: string; icon: LucideIcon }[] = [
  { id: "ai", icon: Scale },
  { id: "cross", icon: Globe },
  { id: "export", icon: FileSignature },
  { id: "enc", icon: Lock },
];

/** A still card: no lift under the pointer, so nothing moves as the page scrolls. */
const CARD = "bg-card border border-border rounded-2xl p-6";

function SectionHead({ label, prefix, accent, sub }: { label: string; prefix: string; accent: string; sub?: string }) {
  return (
    <div className="max-w-3xl mx-auto text-center mb-8 md:mb-12">
      <span className="text-xs uppercase tracking-wider text-accent font-semibold">{label}</span>
      <h2 className="text-2xl md:text-4xl font-bold mt-2">
        {prefix}
        <span className="text-accent">{accent}</span>
      </h2>
      {sub && <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">{sub}</p>}
    </div>
  );
}

function detectLocale(): PageLocale {
  if (typeof window === "undefined") return "en";
  const lang = new URLSearchParams(window.location.search).get("lang");
  if (lang === "es" || lang === "en") return lang;
  return readLocaleCookie() ?? "en";
}

export default function LandingPage({
  contracts,
  initialLocale = "en",
}: {
  contracts: LandingContract[];
  /** The language the server chose (`?lang=`, then the cookie). */
  initialLocale?: PageLocale;
}) {
  const [locale, setLocale] = useState<PageLocale>(initialLocale);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    // The server already chose the language; this only catches a cookie it
    // could not see (the same value in practice, so no re-render).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- locale detection reads cookies, which must happen after hydration; running it during render would mismatch the server-rendered markup
    setLocale(detectLocale());
    cleanUpLocaleCookie();
  }, []);

  // <html lang> follows the text shown (the root layout reads only the cookie).
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const toggleLocale = useCallback(() => {
    const next = locale === "en" ? "es" : "en";
    writeLocaleCookie(next);
    setLocale(next);
  }, [locale]);

  const dict = locale === "es" ? es : en;
  const t = (key: string) => (dict as Record<string, string>)[key] ?? key;
  const authDict = locale === "es" ? authEs : authEn;
  const tAuth = (key: string) => (authDict as Record<string, string>)[key] ?? key;
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

  // Every contract, in the groups of the contract index.
  const groups = CONTRACT_GROUPS.map((g) => ({
    ...g,
    items: contracts.filter((c) => c.group === g.id),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <PublicHeader locale={locale} onLanguageToggle={toggleLocale} />
      <main lang={locale}>
        {/* The hero: background video, headline and the sign-up card */}
        <HomeHero t={t} tAuth={tAuth} callbackUrl="/deals" />

        <div className="px-6">
          {/* Every contract: a search over the public guides and one plain link per guide */}
          <section id="contracts" className="max-w-6xl mx-auto pt-14 pb-14 scroll-mt-24" data-testid="landing-contracts">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-2xl md:text-4xl font-bold leading-tight">{copy.title}</h2>
              <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">{copy.lead}</p>
            </div>

            <form
              className="mt-8 max-w-2xl mx-auto"
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

            <ul className="mt-10 columns-1 md:columns-2 lg:columns-3 gap-4">
              {groups.map(({ id, name, items }) => (
                <li key={id} className="mb-4 break-inside-avoid border border-border rounded-2xl bg-card p-5">
                  <h3 className="text-xs uppercase tracking-wider text-accent font-semibold">{name[locale]}</h3>
                  <ul className="mt-3 divide-y divide-border">
                    {items.map((c) => (
                      <li key={c.slug}>
                        <Link
                          href={contractPath(locale, c.slug)}
                          className="group flex items-center justify-between gap-3 py-2 text-sm hover:text-primary"
                        >
                          <span className="leading-snug">{c.name[locale]}</span>
                          <ArrowRight
                            className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <a href={startHref} className="btn-primary inline-flex items-center gap-2 py-3 px-6">
                {copy.start}
                <ArrowRight className="w-4 h-4" aria-hidden />
              </a>
              <Link href={contractPath(locale)} className="text-sm text-primary hover:underline">
                {copy.seeAll(contracts.length)}
              </Link>
            </div>
            <div className="mt-4 flex justify-center">
              <PriceLine locale={locale} />
            </div>
          </section>

          {/* Why Dealroom, and the documentation */}
          <section className="max-w-6xl mx-auto py-14 border-t border-border" data-testid="landing-value">
            <SectionHead label={t("value.label")} prefix={t("value.heading.prefix")} accent={t("value.heading.accent")} />
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((n) => (
                <li key={n} className={CARD}>
                  <h3 className="text-lg font-semibold leading-snug">{t(`value.v${n}.title`)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t(`value.v${n}.desc`)}</p>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-center">
              {/* The docs take their language from the cookie: set it to the page's first. */}
              <a
                href="/docs"
                data-testid="landing-docs-link"
                onClick={() => writeLocaleCookie(locale)}
                className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
              >
                {t("value.docs")}
                <ArrowRight className="w-4 h-4" aria-hidden />
              </a>
            </p>
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

          {/* Core capabilities */}
          <section className="max-w-6xl mx-auto py-14 border-t border-border">
            <SectionHead label={t("feat.label")} prefix={t("feat.heading.prefix")} accent={t("feat.heading.accent")} />
            <ul className="grid gap-4 md:grid-cols-2">
              {FEATURES.map(({ id, icon: Icon }) => (
                <li key={id} className={CARD}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" aria-hidden />
                    </span>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{t(`feat.${id}.title`)}</span>
                  </div>
                  <h3 className="text-lg font-semibold">{t(`feat.${id}.headline`)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t(`feat.${id}.desc`)}</p>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {[1, 2, 3, 4].map((n) => (
                      <li key={n} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 mt-0.5 text-accent shrink-0" aria-hidden />
                        <span>{t(`feat.${id}.h${n}`)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          {/* For developers and AI agents: one service for everyone */}
          <section className="max-w-6xl mx-auto py-14 border-t border-border" data-testid="landing-build">
            <SectionHead label={t("build.label")} prefix={t("build.heading")} accent="" sub={t("build.sub")} />
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { k: "dev", icon: Code, href: developersPath(locale), cookie: false },
                { k: "agents", icon: Bot, href: AGENTS_PATH, cookie: true },
              ].map(({ k, icon: Icon, href, cookie }) => (
                <div key={k} className={`${CARD} flex flex-col`}>
                  <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" aria-hidden />
                  </span>
                  <h3 className="text-lg font-semibold">{t(`build.${k}.title`)}</h3>
                  <p className="mt-2 mb-5 text-sm text-muted-foreground leading-relaxed">{t(`build.${k}.desc`)}</p>
                  <a
                    href={href}
                    onClick={cookie ? () => writeLocaleCookie(locale) : undefined}
                    className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  >
                    {t(`build.${k}.link`)}
                    <ArrowRight className="w-4 h-4" aria-hidden />
                  </a>
                </div>
              ))}
            </div>
          </section>

          {/* The three ways to host it, and the safeguards guide (keyed by language: the toggle starts it afresh) */}
          <div className="border-t border-border">
            <HostingSection key={locale} t={t} locale={locale} startHref={startHref} />
          </div>

          {/* Customer logos, "Trusted by" (11 Oct 2026): near the bottom, never above the fold */}
          <CustomerLogos label={t("logos.label")} />

          {/* The one call to action, again: no heading, the button and the price */}
          <section className="max-w-3xl mx-auto pb-16 text-center">
            <div className="flex justify-center">
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
        </div>
      </main>
      <PublicFooter locale={locale} />
    </>
  );
}
