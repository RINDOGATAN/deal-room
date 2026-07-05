"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, Brain, Globe, FileSignature } from "lucide-react";
import StartupProductPage from "./components/StartupProductPage";
import StartupsHeader from "./components/StartupsHeader";
import StartupsFooter from "./components/StartupsFooter";
import en from "./i18n/en/dealroom-startups.json";
import es from "./i18n/es/dealroom-startups.json";
import authEn from "./i18n/en/startups-auth.json";
import authEs from "./i18n/es/startups-auth.json";

function detectLocale(): "en" | "es" {
  if (typeof window === "undefined") return "en";
  const params = new URLSearchParams(window.location.search);
  const lang = params.get("lang");
  if (lang === "es" || lang === "en") return lang;
  const match = document.cookie.match(/(?:^|; )locale=([^;]*)/);
  if (match?.[1] === "es") return "es";
  return "en";
}

function setLocaleCookie(locale: string) {
  const maxAge = 365 * 24 * 60 * 60;
  const domain = window.location.hostname.endsWith(".todo.law") ? ";domain=.todo.law" : "";
  document.cookie = `locale=${locale};path=/;max-age=${maxAge};SameSite=Lax${domain}`;
  document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=${maxAge};SameSite=Lax${domain}`;
}

export default function LandingPage() {
  const [locale, setLocale] = useState<"en" | "es">("en");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- locale detection reads cookies/navigator, which must happen after hydration; running it during render would mismatch the server-rendered markup
    setLocale(detectLocale());
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale((prev) => {
      const next = prev === "en" ? "es" : "en";
      setLocaleCookie(next);
      return next;
    });
  }, []);

  const dict = locale === "es" ? es : en;
  const authDict = locale === "es" ? authEs : authEn;
  const t = (key: string) => (dict as Record<string, string>)[key] ?? key;
  const tAuth = (key: string) => (authDict as Record<string, string>)[key] ?? key;

  const features = [
    {
      id: "enc",
      icon: Lock,
      title: t("feat.enc.title"),
      headline: t("feat.enc.headline"),
      description: t("feat.enc.desc"),
      highlights: [t("feat.enc.h1"), t("feat.enc.h2"), t("feat.enc.h3"), t("feat.enc.h4")],
    },
    {
      id: "ai",
      icon: Brain,
      title: t("feat.ai.title"),
      headline: t("feat.ai.headline"),
      description: t("feat.ai.desc"),
      highlights: [t("feat.ai.h1"), t("feat.ai.h2"), t("feat.ai.h3"), t("feat.ai.h4")],
    },
    {
      id: "cross",
      icon: Globe,
      title: t("feat.cross.title"),
      headline: t("feat.cross.headline"),
      description: t("feat.cross.desc"),
      highlights: [t("feat.cross.h1"), t("feat.cross.h2"), t("feat.cross.h3"), t("feat.cross.h4")],
    },
    {
      id: "export",
      icon: FileSignature,
      title: t("feat.export.title"),
      headline: t("feat.export.headline"),
      description: t("feat.export.desc"),
      highlights: [t("feat.export.h1"), t("feat.export.h2"), t("feat.export.h3"), t("feat.export.h4")],
    },
  ];

  const workflowSteps = [1, 2, 3, 4, 5].map((n) => ({
    title: t(`workflow.s${n}.title`),
    desc: t(`workflow.s${n}.desc`),
  }));

  const valueProps = [1, 2, 3, 4].map((n) => ({
    title: t(`value.v${n}.title`),
    desc: t(`value.v${n}.desc`),
  }));

  return (
    <>
      <StartupsHeader
        t={t}
        locale={locale}
        onLocaleToggle={toggleLocale}
        onSignup={() => window.location.href = "/sign-in"}
      />
      <StartupProductPage
        t={t}
        tAuth={tAuth}
        features={features}
        workflowSteps={workflowSteps}
        valueProps={valueProps}
        heroVideo="/hero-dealroom-bg.mp4"
        callbackUrl="/deals"
      />
      <StartupsFooter t={t} />
    </>
  );
}
