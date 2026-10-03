// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Fixed wording of the public contract pages, by URL language (the pages
 * are prerendered per language, so they do not use the cookie-based
 * messages of the rest of the app).
 */

import type { PageLocale } from "@/lib/contract-pages-paths";

export const CONTRACT_COPY = {
  en: {
    navContracts: "Contracts",
    navDocs: "Docs",
    navPricing: "Pricing",
    signIn: "Sign in",
    myDeals: "My deals",
    otherLanguage: "Español",
    home: "Dealroom",
    indexTitle: "Contract templates and guides",
    indexMetaTitle: "Contract templates and guides: NDA, DPA, SaaS, MSA and more",
    indexDescription:
      "Plain-language guides to every contract Dealroom drafts and negotiates: NDA, DPA, SaaS, MSA, BAA, employment, consulting, startup documents and more.",
    indexLead:
      "Each guide explains what the contract is for, who signs it, its key clauses and the points the two sides usually negotiate. You can then prepare the contract yourself in Dealroom or have your AI agent draft and negotiate it.",
    contents: "On this page",
    jurisdictions: "Jurisdictions",
    languages: "Contract languages",
    makeTitle: "Two ways to make it",
    makeSelfTitle: "Create it in Dealroom",
    makeSelfText:
      "Choose the jurisdiction and language, answer a few questions and negotiate each clause with the other side, or prepare it alone.",
    makeSelfButton: "Start in Dealroom",
    makeAgentTitle: "Have your agent draft and negotiate it",
    makeAgentText:
      "If you use an AI agent or your own software, it can read the clause library and create this contract for you, without opening the website.",
    makeAgentDocs: "Read the agent API guide",
    devSummary: "For developers: the API calls",
    devIntro:
      "These are the requests a program sends to read this contract's clauses and create a draft. You do not need them to use Dealroom in the browser. They need a Dealroom API key in place of drk_YOUR_KEY; the agent API guide explains the rest.",
    devTools: "MCP tools:",
    faqTitle: "Frequently asked questions",
    relatedTitle: "Related contracts",
    allContracts: "All contracts",
    disclaimer: "This page explains how the contract usually works. It is general information, not legal advice.",
    priceFree: "Drafting and negotiating are free.",
    pricePaid: (price: string) =>
      `Drafting and negotiating are free. Each contract costs ${price}, paid once, when it is first downloaded or its signature starts.`,
    pricePaidNoAmount:
      "Drafting and negotiating are free. Each contract is paid once, when it is first downloaded or its signature starts.",
    priceSelfHost: "Drafting, negotiating and downloading are free on this instance.",
    pricingLink: "Pricing",
    readGuide: "Read the guide",
  },
  es: {
    navContracts: "Contratos",
    navDocs: "Documentación",
    navPricing: "Precios",
    signIn: "Iniciar sesión",
    myDeals: "Mis negociaciones",
    otherLanguage: "English",
    home: "Dealroom",
    indexTitle: "Modelos y guías de contratos",
    indexMetaTitle: "Modelos de contrato y guías: confidencialidad, encargo, SaaS",
    indexDescription:
      "Guías claras de cada contrato que Dealroom redacta y negocia: confidencialidad, encargo del tratamiento, SaaS, contrato marco, laboral, pacto de socios y más.",
    indexLead:
      "Cada guía explica para qué sirve el contrato, quién lo firma, sus cláusulas principales y los puntos que las partes suelen negociar. Después puede preparar el contrato usted mismo en Dealroom o encargar a su agente de IA que lo redacte y lo negocie.",
    contents: "En esta página",
    jurisdictions: "Jurisdicciones",
    languages: "Idiomas del contrato",
    makeTitle: "Dos formas de prepararlo",
    makeSelfTitle: "Créelo en Dealroom",
    makeSelfText:
      "Elija la jurisdicción y el idioma, responda a unas pocas preguntas y negocie cada cláusula con la otra parte, o prepárelo usted solo.",
    makeSelfButton: "Empezar en Dealroom",
    makeAgentTitle: "Encargue a su agente que lo redacte y lo negocie",
    makeAgentText:
      "Si usa un agente de IA o su propio programa, puede consultar la biblioteca de cláusulas y crear este contrato por usted, sin abrir la web.",
    makeAgentDocs: "Leer la guía de la API para agentes",
    devSummary: "Para desarrolladores: las llamadas a la API",
    devIntro:
      "Son las peticiones que envía un programa para leer las cláusulas de este contrato y crear un borrador. No las necesita para usar Dealroom en el navegador. Requieren una clave de la API de Dealroom en lugar de drk_YOUR_KEY; la guía de la API para agentes explica el resto.",
    devTools: "Herramientas MCP:",
    faqTitle: "Preguntas frecuentes",
    relatedTitle: "Contratos relacionados",
    allContracts: "Todos los contratos",
    disclaimer:
      "Esta página explica cómo funciona habitualmente este contrato. Es información general, no asesoramiento jurídico.",
    priceFree: "Redactar y negociar es gratis.",
    pricePaid: (price: string) =>
      `Redactar y negociar es gratis. Cada contrato cuesta ${price} y se paga una sola vez, cuando se descarga por primera vez o se inicia su firma.`,
    pricePaidNoAmount:
      "Redactar y negociar es gratis. Cada contrato se paga una sola vez, cuando se descarga por primera vez o se inicia su firma.",
    priceSelfHost: "En esta instancia, redactar, negociar y descargar es gratis.",
    pricingLink: "Precios",
    readGuide: "Leer la guía",
  },
} satisfies Record<PageLocale, Record<string, unknown>>;

export type ContractCopy = (typeof CONTRACT_COPY)[PageLocale];

/** Jurisdiction names as the pages show them. */
export const JURISDICTION_NAMES: Record<string, Record<PageLocale, string>> = {
  CALIFORNIA: { en: "California", es: "California" },
  DELAWARE: { en: "Delaware", es: "Delaware" },
  ENGLAND_WALES: { en: "England and Wales", es: "Inglaterra y Gales" },
  NEW_YORK: { en: "New York", es: "Nueva York" },
  SPAIN: { en: "Spain", es: "España" },
};

export const LANGUAGE_NAMES: Record<string, Record<PageLocale, string>> = {
  en: { en: "English", es: "Inglés" },
  es: { en: "Spanish", es: "Español" },
};
