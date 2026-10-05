// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Wording of the developer quick start (`/developers`, `/es/developers`),
 * by URL language, like the contract guides. Spanish is Castilian and
 * addresses the reader as "tú". No long dashes anywhere.
 */

import type { PageLocale } from "@/lib/contract-pages-paths";

export const DEVELOPERS_COPY = {
  en: {
    metaTitle: "Dealroom for developers: make contracts through the API or MCP",
    metaDescription:
      "Make a contract in one call from your code or your AI agent: get an API key, buy credits and call the Dealroom API or MCP server. Setup for Claude, Cursor and VS Code.",
    breadcrumb: "Developers",
    title: "Dealroom for developers",
    lead: "Dealroom drafts and negotiates contracts. Your program or AI agent can make a contract in one call, through the API or through MCP, and the people involved can then read it in Dealroom.",

    whatTitle: "What it does",
    what: [
      "It makes a complete contract from a template written by lawyers. You send the contract type, your details and, if you have them, the other side's details.",
      "Every clause you do not choose takes the standard option of the template.",
      "It returns the contract as PDF, DOCX or TXT, and a link to read it in Dealroom.",
      "It can also negotiate a contract clause by clause, between two agents or two people, with a published compromise formula.",
    ],
    whatLimit:
      "The contracts come from templates. Read each contract before you sign it. Dealroom does not give legal advice.",

    priceTitle: "Price",
    priceFree: "Drafting and negotiating are free.",
    pricePaid: (price: string) =>
      `Drafting and negotiating are free. Each contract costs ${price}, the same on the website, through the API or through MCP.`,
    pricePaidNoAmount:
      "Drafting and negotiating are free. Each contract is paid once, at the same price on the website, through the API or through MCP.",
    pricePack: (size: number, price: string) =>
      `Agents pay with prepaid credits, one credit per contract. Credits are sold in packs of ${size}: ${price} a pack.`,
    pricePackNoAmount: (size: number) =>
      `Agents pay with prepaid credits, one credit per contract. Credits are sold in packs of ${size}.`,
    priceSelfHost: "Payments are off on this instance. Every contract is free.",
    pricingLink: "See the pricing page",

    stepsTitle: "Three steps",
    steps: [
      {
        title: "Get an API key",
        body: "Sign in to Dealroom and open Settings, API keys. Choose Create key and copy the key. It starts with drk_ and is shown only once.",
        link: "Open Settings, API keys",
      },
      {
        title: "Buy credits",
        body: "On the same page, choose Buy credits to buy a pack. Each contract made through the API or MCP spends one credit. Your agent can also open the payment page itself with the buy_credits tool. On a self-hosted Dealroom with payments off, skip this step.",
        link: null,
      },
      {
        title: "Make the call",
        body: "Send the contract type, your side's details and, if you know them, the other side's details. The answer gives the deal number, a link to read the contract in Dealroom and the links to download it.",
        link: null,
      },
    ],

    callTitle: "The one call",
    callIntro: "With curl. Replace drk_YOUR_KEY with your key.",
    answerTitle: "The answer",
    callNotesTitle: "Good to know",
    callNotes: [
      "contractType takes the code (NDA) or the address of the contract's guide (nda).",
      "governingLaw is needed only when the contract is offered under more than one law.",
      "Some contracts ask for more facts, such as a city or an amount. GET /api/v1/agent/contract-types lists them for every contract, with no key needed. Send them in terms.",
      "If you leave out counterparty, the other side's block stays blank for them to complete.",
      "With no credit left, the answer is HTTP 402 and nothing is created.",
      "When you retry, send the same Idempotency-Key header. The retry returns the first answer and is not charged again.",
      "The link to read the contract in Dealroom works for the person whose e-mail owns the API key, once signed in.",
    ],

    mcpTitle: "Connect an AI agent through MCP",
    mcpIntro:
      "This is the address of the Dealroom MCP server. Your key goes in the Authorization header. Your agent then sees the tools list_contract_types, generate_contract, download_contract, buy_credits and get_credit_balance, and the negotiation tools.",
    clients: {
      claudeCode: { name: "Claude Code", note: "Run this in a terminal:" },
      claudeDesktop: {
        name: "Claude Desktop",
        note: "Claude Desktop reaches remote servers through the mcp-remote bridge, which needs Node.js. Add this to claude_desktop_config.json and restart Claude Desktop:",
      },
      cursor: { name: "Cursor", note: "Add this to ~/.cursor/mcp.json, or to .cursor/mcp.json in a project:" },
      vscode: {
        name: "VS Code",
        note: "Add this to .vscode/mcp.json. VS Code asks for the key the first time and keeps it:",
      },
      generic: { name: "Other clients", note: "Most MCP clients accept this shape:" },
    },

    restTitle: "Without MCP: the REST API",
    restIntro:
      "Any language that can send HTTP requests works. First list the contract types and what each one needs (no key needed), then make the contract.",
    restDocs: "Read the full agent API guide",

    typesTitle: "Contract types",
    typesIntro:
      "Each contract has a guide that explains it in plain words. The code is what you send as contractType.",
    codeLabel: "Code",

    moreTitle: "For machines",
    more: [
      { label: "Contract types and the facts each one needs", path: "/api/v1/agent/contract-types" },
      { label: "MCP tools with their REST endpoints", path: "/api/v1/agent/mcp" },
      { label: "Agent card", path: "/.well-known/agent.json" },
      { label: "Summary for AI models", path: "/llms.txt" },
    ],

    disclaimer:
      "This page explains how to use Dealroom from your own software. It is general information, not legal advice.",
    howToName: "Make a contract with the Dealroom API",
  },
  es: {
    metaTitle: "Dealroom para desarrolladores: crea contratos con la API o MCP",
    metaDescription:
      "Crea un contrato en una sola llamada desde tu código o tu agente de IA: consigue una clave API, compra créditos y llama a la API o al servidor MCP de Dealroom. Configuración para Claude, Cursor y VS Code.",
    breadcrumb: "Desarrolladores",
    title: "Dealroom para desarrolladores",
    lead: "Dealroom redacta y negocia contratos. Tu programa o tu agente de IA puede crear un contrato en una sola llamada, con la API o con MCP, y las personas implicadas pueden leerlo después en Dealroom.",

    whatTitle: "Qué hace",
    what: [
      "Crea un contrato completo a partir de un modelo redactado por abogados. Envías el tipo de contrato, tus datos y, si los tienes, los de la otra parte.",
      "Cada cláusula que no elijas toma la opción estándar del modelo.",
      "Devuelve el contrato en PDF, DOCX o TXT, y un enlace para leerlo en Dealroom.",
      "También puede negociar un contrato cláusula por cláusula, entre dos agentes o dos personas, con una fórmula de compromiso publicada.",
    ],
    whatLimit:
      "Los contratos salen de modelos. Lee cada contrato antes de firmarlo. Dealroom no presta asesoramiento jurídico.",

    priceTitle: "Precio",
    priceFree: "Redactar y negociar es gratis.",
    pricePaid: (price: string) =>
      `Redactar y negociar es gratis. Cada contrato cuesta ${price}, lo mismo en la web, con la API o con MCP.`,
    pricePaidNoAmount:
      "Redactar y negociar es gratis. Cada contrato se paga una sola vez, al mismo precio en la web, con la API o con MCP.",
    pricePack: (size: number, price: string) =>
      `Los agentes pagan con créditos de prepago, un crédito por contrato. Los créditos se venden en packs de ${size}: ${price} el pack.`,
    pricePackNoAmount: (size: number) =>
      `Los agentes pagan con créditos de prepago, un crédito por contrato. Los créditos se venden en packs de ${size}.`,
    priceSelfHost: "En esta instancia los pagos están desactivados. Todos los contratos son gratis.",
    pricingLink: "Ver la página de precios",

    stepsTitle: "Tres pasos",
    steps: [
      {
        title: "Consigue una clave API",
        body: "Inicia sesión en Dealroom y abre Ajustes, Claves API. Elige Crear clave y copia la clave. Empieza por drk_ y solo se muestra una vez.",
        link: "Abrir Ajustes, Claves API",
      },
      {
        title: "Compra créditos",
        body: "En la misma página, elige Comprar créditos para comprar un pack. Cada contrato creado con la API o con MCP gasta un crédito. Tu agente también puede abrir él mismo la página de pago con la herramienta buy_credits. En un Dealroom propio con los pagos desactivados, sáltate este paso.",
        link: null,
      },
      {
        title: "Haz la llamada",
        body: "Envía el tipo de contrato, los datos de tu parte y, si los conoces, los de la otra parte. La respuesta incluye el número del acuerdo, un enlace para leer el contrato en Dealroom y los enlaces para descargarlo.",
        link: null,
      },
    ],

    callTitle: "La llamada",
    callIntro: "Con curl. Sustituye drk_YOUR_KEY por tu clave.",
    answerTitle: "La respuesta",
    callNotesTitle: "Conviene saber",
    callNotes: [
      "contractType admite el código (NDA) o la dirección de la guía del contrato (nda).",
      "governingLaw solo hace falta cuando el contrato se ofrece con más de una ley aplicable.",
      "Algunos contratos piden más datos, como una ciudad o un importe. GET /api/v1/agent/contract-types los indica para cada contrato, sin necesidad de clave. Envíalos en terms.",
      "Si no envías counterparty, el bloque de la otra parte queda en blanco para que lo complete ella.",
      "Si no te quedan créditos, la respuesta es HTTP 402 y no se crea nada.",
      "Cuando repitas una llamada, envía la misma cabecera Idempotency-Key. La repetición devuelve la primera respuesta y no se cobra otra vez.",
      "El enlace para leer el contrato en Dealroom funciona para la persona cuyo correo es el titular de la clave API, una vez que inicia sesión.",
    ],

    mcpTitle: "Conecta un agente de IA con MCP",
    mcpIntro:
      "Esta es la dirección del servidor MCP de Dealroom. Tu clave va en la cabecera Authorization. Tu agente verá entonces las herramientas list_contract_types, generate_contract, download_contract, buy_credits y get_credit_balance, y las de negociación.",
    clients: {
      claudeCode: { name: "Claude Code", note: "Ejecuta esto en un terminal:" },
      claudeDesktop: {
        name: "Claude Desktop",
        note: "Claude Desktop se conecta a servidores remotos mediante el puente mcp-remote, que necesita Node.js. Añade esto a claude_desktop_config.json y reinicia Claude Desktop:",
      },
      cursor: { name: "Cursor", note: "Añade esto a ~/.cursor/mcp.json, o a .cursor/mcp.json en un proyecto:" },
      vscode: {
        name: "VS Code",
        note: "Añade esto a .vscode/mcp.json. VS Code te pide la clave la primera vez y la guarda:",
      },
      generic: { name: "Otros clientes", note: "La mayoría de los clientes MCP aceptan esta forma:" },
    },

    restTitle: "Sin MCP: la API REST",
    restIntro:
      "Sirve cualquier lenguaje que pueda enviar peticiones HTTP. Primero consulta los tipos de contrato y lo que pide cada uno (sin clave), y después crea el contrato.",
    restDocs: "Leer la guía completa de la API de agentes",

    typesTitle: "Tipos de contrato",
    typesIntro:
      "Cada contrato tiene una guía que lo explica con palabras sencillas. El código es lo que envías como contractType.",
    codeLabel: "Código",

    moreTitle: "Para máquinas",
    more: [
      { label: "Tipos de contrato y los datos que pide cada uno", path: "/api/v1/agent/contract-types?lang=es" },
      { label: "Herramientas MCP con sus endpoints REST", path: "/api/v1/agent/mcp" },
      { label: "Tarjeta del agente", path: "/.well-known/agent.json" },
      { label: "Resumen para modelos de IA", path: "/llms.txt" },
    ],

    disclaimer:
      "Esta página explica cómo usar Dealroom desde tu propio software. Es información general, no asesoramiento jurídico.",
    howToName: "Crear un contrato con la API de Dealroom",
  },
} satisfies Record<PageLocale, Record<string, unknown>>;

export type DevelopersCopy = (typeof DEVELOPERS_COPY)[PageLocale];
