// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Wording of the developer quick start (`/developers`, `/es/developers` and
 * their Markdown twins), by URL language. Spanish is Castilian and
 * addresses the reader as "tú". No long dashes anywhere.
 */

import type { PageLocale } from "@/lib/contract-pages-paths";
import { features } from "@/config/features";

/**
 * The startup-coverage tools and routes (owner's decisions of 6 October
 * 2026), listed only while `features.startupCoverage` is on, so the page
 * names exactly the live tools.
 */
export const COVERAGE_COPY = {
  en: {
    tools: [
      { name: "find_template", text: "Describe the matter; get the matching templates, or \"No template covers this. Such matters are usually handled by a lawyer.\" Matching by words, no AI model. No key needed." },
      { name: "explain_options", text: "The options of one clause, with each side's pros and cons as the template states them. Nothing is recommended." },
      { name: "list_obligations", text: "The duties and the dates a contract states: term, renewal, notice and date inputs." },
      { name: "get_deadlines", text: "Public statutory dates (83(b), Form D, Delaware 1 March), each with its official source to verify. No key needed." },
      { name: "share_with_attorney", text: "Invite any lawyer you choose to review a contract in Dealroom. The lawyer works for you and bills you directly; Dealroom takes no fee and makes no recommendation." },
    ],
    restRows: [
      { method: "GET", path: "/api/v1/agent/find-template?q=...", what: "The templates that match a description", key: false },
      { method: "GET", path: "/api/v1/agent/templates/{code}/options?clause=...", what: "The options of one clause, from both sides", key: true },
      { method: "GET", path: "/api/v1/agent/deals/{dealId}/obligations", what: "The duties and dates of a contract", key: true },
      { method: "GET", path: "/api/v1/agent/deadlines", what: "Public statutory dates with their sources", key: false },
      { method: "POST", path: "/api/v1/agent/deals/{dealId}/attorney", what: "Invite your own lawyer to review", key: true },
    ],
  },
  es: {
    tools: [
      { name: "find_template", text: "Describe el asunto y recibe las plantillas que coinciden, o \"Ninguna plantilla cubre esto. De estos asuntos suele ocuparse un abogado o una abogada.\" Búsqueda por palabras, sin modelo de IA. Sin clave." },
      { name: "explain_options", text: "Las opciones de una cláusula, con las ventajas e inconvenientes de cada parte tal como los recoge la plantilla. No se recomienda ninguna." },
      { name: "list_obligations", text: "Las obligaciones y las fechas que fija un contrato: duración, renovación, preaviso y fechas indicadas." },
      { name: "get_deadlines", text: "Fechas legales públicas (83(b), Form D, Delaware 1 de marzo), cada una con su fuente oficial para comprobarla. Sin clave." },
      { name: "share_with_attorney", text: "Invita al abogado o la abogada que elijas a revisar un contrato en Dealroom. Trabaja para ti y te factura directamente; Dealroom no cobra nada por ello ni hace recomendaciones." },
    ],
    restRows: [
      { method: "GET", path: "/api/v1/agent/find-template?q=...", what: "Las plantillas que coinciden con una descripción", key: false },
      { method: "GET", path: "/api/v1/agent/templates/{code}/options?clause=...", what: "Las opciones de una cláusula, desde las dos partes", key: true },
      { method: "GET", path: "/api/v1/agent/deals/{dealId}/obligations", what: "Las obligaciones y fechas de un contrato", key: true },
      { method: "GET", path: "/api/v1/agent/deadlines", what: "Fechas legales públicas con sus fuentes", key: false },
      { method: "POST", path: "/api/v1/agent/deals/{dealId}/attorney", what: "Invitar a tu propio abogado o abogada a revisar", key: true },
    ],
  },
} satisfies Record<PageLocale, { tools: { name: string; text: string }[]; restRows: { method: string; path: string; what: string; key: boolean }[] }>;

export type SectionId =
  | "steps"
  | "one-call"
  | "mcp"
  | "agents"
  | "rest"
  | "contract-types"
  | "formats"
  | "pricing"
  | "machines";

export const SECTION_ORDER: SectionId[] = [
  "steps",
  "one-call",
  "mcp",
  "agents",
  "rest",
  "contract-types",
  "formats",
  "pricing",
  "machines",
];

export const DEVELOPERS_COPY = {
  en: {
    metaTitle: "Dealroom for developers: make contracts through the API or MCP",
    metaDescription:
      "Make a contract in one call from your code or your AI agent: get an API key, buy credits and call the Dealroom API or MCP server. Output as Markdown, HTML, PDF, DOCX or text.",
    breadcrumb: "Developers",
    title: "Dealroom for developers",
    lead: "Make a contract in one call from your code or your AI agent, through the API or MCP, and read it in Dealroom.",
    tocTitle: "On this page",
    sections: {
      steps: "Three steps",
      "one-call": "The one call",
      mcp: "Connect an AI agent through MCP",
      agents: "Contracts for AI agents",
      rest: "REST API",
      "contract-types": "Contract types",
      formats: "Formats",
      pricing: "Price",
      machines: "For machines",
    } satisfies Record<SectionId, string>,
    tocLabels: {
      steps: "Three steps",
      "one-call": "The one call",
      mcp: "MCP",
      agents: "Contracts for agents",
      rest: "REST API",
      "contract-types": "Contract types",
      formats: "Formats",
      pricing: "Price",
      machines: "For machines",
    } satisfies Record<SectionId, string>,

    steps: [
      {
        title: "Get an API key",
        body: "Sign in, open Settings, API keys and choose Create key. Copy the key: it starts with drk_ and is shown once.",
        link: "Open Settings, API keys",
      },
      {
        title: "Buy credits",
        body: "On the same page, choose Buy credits. Each contract made through the API or MCP spends one credit.",
        link: null,
      },
      {
        title: "Make the call",
        body: "Send the contract type and your details. The answer holds the contract and the links to read and download it.",
        link: null,
      },
    ],

    oneCallIntro: "With curl. Replace drk_YOUR_KEY with your key.",
    requestTitle: "Request",
    fieldsTitle: "Fields",
    fields: [
      { name: "contractType", text: "Required. The code (NDA) or the address of the contract's guide (nda). See Contract types below." },
      { name: "party", text: "Required. Your side: legalName (required), address, taxId, signatoryName, signatoryTitle, email." },
      { name: "counterparty", text: "The other side, same fields. Left out, its block stays blank for them to complete." },
      { name: "governingLaw", text: "CALIFORNIA, NEW_YORK, ENGLAND_WALES or SPAIN. Needed only when the contract is offered under more than one." },
      { name: "language", text: "en or es, where the contract is offered in both. Default en." },
      { name: "terms", text: "Facts the contract asks for, by input id, such as a city or an amount. Inputs left out take their default." },
      { name: "clauses", text: "Optional clause choices: clause id to option code. Clauses left out take the standard option." },
      { name: "role", text: "DPA and BAA only: the role you take, such as PROCESSOR or CONTROLLER." },
      { name: "inline", text: "md, html or txt: the contract itself in the answer. Through MCP the default is md." },
      { name: "title", text: "A name for the deal. Made from the parties when left out." },
    ],
    answerTitle: "Answer",
    notesTitle: "Good to know",
    notes: [
      "With no credit left, the answer is HTTP 402 and nothing is created.",
      "When you retry, send the same Idempotency-Key header: the retry returns the first answer and is not charged again.",
      "Every format of a paid contract can be downloaded again for free.",
      "The dealUrl link opens for the person whose e-mail owns the API key, once signed in.",
    ],

    mcpIntro: "The MCP server address. Your key goes in the Authorization header.",
    clientsTitle: "Setup by client",
    clients: {
      claudeCode: { name: "Claude Code", note: "Run this in a terminal." },
      claudeDesktop: {
        name: "Claude Desktop",
        note: "Claude Desktop reaches remote servers through the mcp-remote bridge, which needs Node.js. Add this to claude_desktop_config.json and restart Claude Desktop.",
      },
      cursor: { name: "Cursor", note: "Add this to ~/.cursor/mcp.json, or to .cursor/mcp.json in a project." },
      vscode: { name: "VS Code", note: "Add this to .vscode/mcp.json. VS Code asks for the key the first time and keeps it." },
      generic: { name: "Other clients", note: "Most MCP clients accept this shape." },
    },
    toolsTitle: "Tools",
    tools: [
      { name: "list_contract_types", text: "Every contract type and the facts it needs. No key needed." },
      { name: "generate_contract", text: "Make a contract in one call. Returns it as Markdown, with the links." },
      { name: "download_contract", text: "One contract as Markdown, HTML, PDF, DOCX or TXT." },
      { name: "get_deal", text: "A deal's clauses and status." },
      { name: "delete_deal", text: "Delete one of your single-party deals and its data." },
      { name: "buy_credits", text: "A payment link for a pack of credits, for a person to open." },
      { name: "get_credit_balance", text: "Credits left on the account." },
      { name: "get_subscriptions", text: "Earlier per-skill subscriptions and their status. Every template is now included." },
      { name: "list_templates, get_template", text: "Clauses and options of each contract, and of the A2A_ agent-to-agent protocol types." },
      { name: "create_playbook, initiate_negotiation, join_negotiation", text: "Negotiate a contract between two agents, including the A2A_ protocol types (negotiation only)." },

      ...(features.startupCoverage ? COVERAGE_COPY.en.tools : []),
    ],

    restIntro: "Any language that can send HTTP requests works. All paths start with https://dealroom.todo.law.",
    restColumns: { method: "Method", path: "Path", what: "What it does", key: "Key" },
    restRows: [
      { method: "GET", path: "/api/v1/agent/contract-types", what: "Contract types and the facts each needs", key: false },
      { method: "POST", path: "/api/v1/agent/contracts", what: "Make a contract in one call", key: true },
      { method: "GET", path: "/api/v1/agent/deals/{dealId}/document/md", what: "The contract as Markdown (also /html, /txt, /docx; PDF without suffix)", key: true },
      { method: "GET", path: "/api/v1/agent/deals/{dealId}", what: "A deal's clauses and status", key: true },
      { method: "DELETE", path: "/api/v1/agent/deals/{dealId}", what: "Delete one of your single-party deals and its data", key: true },
      { method: "GET", path: "/api/v1/agent/credits/balance", what: "Credits left", key: true },
      { method: "POST", path: "/api/v1/agent/credits/checkout", what: "A payment link for a pack of credits", key: true },
      { method: "GET", path: "/api/v1/agent/templates/{code}", what: "Clauses and options of one contract", key: true },
      { method: "POST", path: "/api/v1/agent/negotiate", what: "Start a negotiation between two agents", key: true },
      { method: "POST", path: "/api/v1/agent/mcp", what: "The MCP server", key: true },

      ...(features.startupCoverage ? COVERAGE_COPY.en.restRows : []),
    ],
    keyYes: "Yes",
    keyNo: "No",
    restExampleTitle: "Example",
    restDocs: "Read the full agent API guide",

    agentsIntro:
      "The contracts agents make most often, in order. Each link opens the contract's guide at its one-call example, filled in with its code and required inputs. Every other contract is under Contract types below.",
    agentsCaption: "The most common contracts, with the code to send and the one-call example of each",
    agentsColumns: { rank: "#", name: "Contract", code: "Code", inputs: "Required inputs", call: "One call" },
    agentsCallLink: "See the call",
    commonNames: {
      NDA: "Non-disclosure agreement (NDA)",
      DPA: "Data processing agreement (DPA)",
      MSA: "Master services agreement (MSA)",
      SAAS: "SaaS subscription agreement",
      CONSULTING: "Consulting agreement",
      EMPLOYMENT: "Employment agreement",
      IP_ASSIGNMENT: "IP assignment agreement",
      SAFE: "SAFE (simple agreement for future equity)",
      CONVERTIBLE_NOTE: "Convertible note",
      ADVISORY: "Advisory agreement",
      PRIVACY_NOTICE: "Privacy notice",
    } as Record<string, string>,

    typesIntro:
      "Every contract the one call can make, grouped as in the contract guides. Send the code as contractType. Send every required input in terms. A required input with a default can be left out: the default is applied.",
    typesCaption: "Contract types, with the code to send and the facts each one needs",
    typesColumns: { name: "Contract", code: "Code", laws: "Governing laws", languages: "Languages", inputs: "Required inputs" },
    inputsNone: "None",
    typesEmpty: "The list of contract types could not be loaded. GET /api/v1/agent/contract-types returns it.",

    formatsIntro:
      "One contract, five formats, all from the same text. A paid contract can be downloaded in every format at no extra cost.",
    formatsColumns: { format: "Format", type: "Media type", for: "Best for", how: "How to get it" },
    formats: [
      { format: "Markdown", type: "text/markdown", for: "AI agents and tools that read text", how: "inline: \"md\", or /document/md" },
      { format: "HTML", type: "text/html", for: "Web pages, previews and screen readers; one file, no outside assets", how: "inline: \"html\", or /document/html" },
      { format: "Text", type: "text/plain", for: "Plain text systems", how: "inline: \"txt\", or /document/txt" },
      { format: "PDF", type: "application/pdf", for: "Reading and printing", how: "/document" },
      { format: "DOCX", type: "Word document", for: "Editing in a word processor", how: "/document/docx" },
    ],

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

    machines: [
      { label: "This page as Markdown", path: "/developers.md" },
      { label: "Contract types and the facts each one needs (JSON)", path: "/api/v1/agent/contract-types" },
      { label: "MCP tools with their REST endpoints (JSON)", path: "/api/v1/agent/mcp" },
      { label: "Agent card", path: "/.well-known/agent.json" },
      { label: "MCP server card", path: "/.well-known/mcp/server-card.json" },
      { label: "MCP discovery", path: "/.well-known/mcp.json" },
      { label: "Summary for AI models", path: "/llms.txt" },
      { label: "Every contract type with its code and inputs, for AI models", path: "/llms-full.txt" },
    ],

    disclaimer:
      "The contracts come from templates written by lawyers. Read each contract before you sign it. This page is general information, not legal advice.",
    howToName: "Make a contract with the Dealroom API",
    apiName: "Dealroom agent API",
    apiDescription: "Make a contract in one call, download it as Markdown, HTML, PDF, DOCX or text, or negotiate it between two agents.",
  },
  es: {
    metaTitle: "Dealroom para desarrolladores: crea contratos con la API o MCP",
    metaDescription:
      "Crea un contrato en una sola llamada desde tu código o tu agente de IA: consigue una clave API, compra créditos y llama a la API o al servidor MCP de Dealroom. Resultado en Markdown, HTML, PDF, DOCX o texto.",
    breadcrumb: "Desarrolladores",
    title: "Dealroom para desarrolladores",
    lead: "Crea un contrato en una sola llamada desde tu código o tu agente de IA, con la API o con MCP, y léelo en Dealroom.",
    tocTitle: "En esta página",
    sections: {
      steps: "Tres pasos",
      "one-call": "La llamada",
      mcp: "Conecta un agente de IA con MCP",
      agents: "Contratos para agentes de IA",
      rest: "API REST",
      "contract-types": "Tipos de contrato",
      formats: "Formatos",
      pricing: "Precio",
      machines: "Para máquinas",
    } satisfies Record<SectionId, string>,
    tocLabels: {
      steps: "Tres pasos",
      "one-call": "La llamada",
      mcp: "MCP",
      agents: "Contratos para agentes",
      rest: "API REST",
      "contract-types": "Tipos de contrato",
      formats: "Formatos",
      pricing: "Precio",
      machines: "Para máquinas",
    } satisfies Record<SectionId, string>,

    steps: [
      {
        title: "Consigue una clave API",
        body: "Inicia sesión, abre Ajustes, Claves API y elige Crear clave. Cópiala: empieza por drk_ y solo se muestra una vez.",
        link: "Abrir Ajustes, Claves API",
      },
      {
        title: "Compra créditos",
        body: "En la misma página, elige Comprar créditos. Cada contrato creado con la API o con MCP gasta un crédito.",
        link: null,
      },
      {
        title: "Haz la llamada",
        body: "Envía el tipo de contrato y tus datos. La respuesta incluye el contrato y los enlaces para leerlo y descargarlo.",
        link: null,
      },
    ],

    oneCallIntro: "Con curl. Sustituye drk_YOUR_KEY por tu clave.",
    requestTitle: "Petición",
    fieldsTitle: "Campos",
    fields: [
      { name: "contractType", text: "Obligatorio. El código (NDA) o la dirección de la guía del contrato (nda). Consulta Tipos de contrato más abajo." },
      { name: "party", text: "Obligatorio. Tu parte: legalName (obligatorio), address, taxId, signatoryName, signatoryTitle, email." },
      { name: "counterparty", text: "La otra parte, con los mismos campos. Si no lo envías, su bloque queda en blanco para que lo complete ella." },
      { name: "governingLaw", text: "CALIFORNIA, NEW_YORK, ENGLAND_WALES o SPAIN. Solo hace falta cuando el contrato se ofrece con más de una." },
      { name: "language", text: "en o es, cuando el contrato se ofrece en los dos. Por defecto, en." },
      { name: "terms", text: "Los datos que pide el contrato, por id, como una ciudad o un importe. Los que no envíes toman su valor por defecto." },
      { name: "clauses", text: "Elección de cláusulas opcional: id de la cláusula y código de la opción. Las que no indiques toman la opción estándar." },
      { name: "role", text: "Solo DPA y BAA: el papel que asumes, como PROCESSOR o CONTROLLER." },
      { name: "inline", text: "md, html o txt: el propio contrato en la respuesta. Con MCP, md por defecto." },
      { name: "title", text: "Un nombre para el acuerdo. Si no lo envías, se forma con las partes." },
    ],
    answerTitle: "Respuesta",
    notesTitle: "Conviene saber",
    notes: [
      "Si no te quedan créditos, la respuesta es HTTP 402 y no se crea nada.",
      "Cuando repitas una llamada, envía la misma cabecera Idempotency-Key: la repetición devuelve la primera respuesta y no se cobra otra vez.",
      "Un contrato pagado se puede volver a descargar gratis en cualquier formato.",
      "El enlace dealUrl se abre para la persona cuyo correo es el titular de la clave API, una vez que inicia sesión.",
    ],

    mcpIntro: "La dirección del servidor MCP. Tu clave va en la cabecera Authorization.",
    clientsTitle: "Configuración por cliente",
    clients: {
      claudeCode: { name: "Claude Code", note: "Ejecuta esto en un terminal." },
      claudeDesktop: {
        name: "Claude Desktop",
        note: "Claude Desktop se conecta a servidores remotos mediante el puente mcp-remote, que necesita Node.js. Añade esto a claude_desktop_config.json y reinicia Claude Desktop.",
      },
      cursor: { name: "Cursor", note: "Añade esto a ~/.cursor/mcp.json, o a .cursor/mcp.json en un proyecto." },
      vscode: { name: "VS Code", note: "Añade esto a .vscode/mcp.json. VS Code te pide la clave la primera vez y la guarda." },
      generic: { name: "Otros clientes", note: "La mayoría de los clientes MCP aceptan esta forma." },
    },
    toolsTitle: "Herramientas",
    tools: [
      { name: "list_contract_types", text: "Todos los tipos de contrato y los datos que pide cada uno. Sin clave." },
      { name: "generate_contract", text: "Crea un contrato en una sola llamada. Lo devuelve en Markdown, con los enlaces." },
      { name: "download_contract", text: "Un contrato en Markdown, HTML, PDF, DOCX o TXT." },
      { name: "get_deal", text: "Las cláusulas y el estado de un acuerdo." },
      { name: "delete_deal", text: "Elimina uno de tus acuerdos de una sola parte y sus datos." },
      { name: "buy_credits", text: "Un enlace de pago de un pack de créditos, para que lo abra una persona." },
      { name: "get_credit_balance", text: "Los créditos que quedan en la cuenta." },
      { name: "get_subscriptions", text: "Las suscripciones anteriores por skill y su estado. Hoy todas las plantillas están incluidas." },
      { name: "list_templates, get_template", text: "Las cláusulas y opciones de cada contrato, y de los tipos de protocolo entre agentes A2A_." },
      { name: "create_playbook, initiate_negotiation, join_negotiation", text: "Negociar un contrato entre dos agentes, también los tipos de protocolo A2A_ (solo por negociación)." },

      ...(features.startupCoverage ? COVERAGE_COPY.es.tools : []),
    ],

    restIntro: "Sirve cualquier lenguaje que pueda enviar peticiones HTTP. Todas las rutas empiezan por https://dealroom.todo.law.",
    restColumns: { method: "Método", path: "Ruta", what: "Qué hace", key: "Clave" },
    restRows: [
      { method: "GET", path: "/api/v1/agent/contract-types", what: "Tipos de contrato y los datos que pide cada uno", key: false },
      { method: "POST", path: "/api/v1/agent/contracts", what: "Crear un contrato en una sola llamada", key: true },
      { method: "GET", path: "/api/v1/agent/deals/{dealId}/document/md", what: "El contrato en Markdown (también /html, /txt, /docx; PDF sin sufijo)", key: true },
      { method: "GET", path: "/api/v1/agent/deals/{dealId}", what: "Las cláusulas y el estado de un acuerdo", key: true },
      { method: "DELETE", path: "/api/v1/agent/deals/{dealId}", what: "Eliminar uno de tus acuerdos de una sola parte y sus datos", key: true },
      { method: "GET", path: "/api/v1/agent/credits/balance", what: "Créditos que quedan", key: true },
      { method: "POST", path: "/api/v1/agent/credits/checkout", what: "Un enlace de pago de un pack de créditos", key: true },
      { method: "GET", path: "/api/v1/agent/templates/{code}", what: "Cláusulas y opciones de un contrato", key: true },
      { method: "POST", path: "/api/v1/agent/negotiate", what: "Iniciar una negociación entre dos agentes", key: true },
      { method: "POST", path: "/api/v1/agent/mcp", what: "El servidor MCP", key: true },
      ...(features.startupCoverage ? COVERAGE_COPY.es.restRows : []),
    ],
    keyYes: "Sí",
    keyNo: "No",
    restExampleTitle: "Ejemplo",
    restDocs: "Leer la guía completa de la API de agentes",

    agentsIntro:
      "Los contratos que más crean los agentes, por orden. Cada enlace abre la guía del contrato en su ejemplo de la llamada, ya rellenado con su código y sus datos obligatorios. El resto de contratos está en Tipos de contrato, más abajo.",
    agentsCaption: "Los contratos más habituales, con el código que hay que enviar y el ejemplo de la llamada de cada uno",
    agentsColumns: { rank: "N.º", name: "Contrato", code: "Código", inputs: "Datos obligatorios", call: "La llamada" },
    agentsCallLink: "Ver la llamada",
    commonNames: {
      NDA: "Acuerdo de confidencialidad (NDA)",
      DPA: "Contrato de encargo del tratamiento (DPA)",
      MSA: "Contrato marco de prestación de servicios (MSA)",
      SAAS: "Contrato de suscripción SaaS",
      CONSULTING: "Contrato de consultoría",
      EMPLOYMENT: "Contrato de trabajo",
      IP_ASSIGNMENT: "Contrato de cesión de propiedad intelectual",
      SAFE: "Acuerdo SAFE (acuerdo simple de capital futuro)",
      CONVERTIBLE_NOTE: "Préstamo convertible",
      ADVISORY: "Contrato de asesoramiento",
      PRIVACY_NOTICE: "Aviso de privacidad",
    } as Record<string, string>,

    typesIntro:
      "Todos los contratos que puede crear la llamada, agrupados como en las guías de contratos. Envía el código como contractType. Envía en terms todos los datos obligatorios. Un dato obligatorio con valor por defecto puede omitirse: se aplica ese valor.",
    typesCaption: "Tipos de contrato, con el código que hay que enviar y los datos que pide cada uno",
    typesColumns: { name: "Contrato", code: "Código", laws: "Leyes aplicables", languages: "Idiomas", inputs: "Datos obligatorios" },
    inputsNone: "Ninguno",
    typesEmpty: "No se ha podido cargar la lista de tipos de contrato. GET /api/v1/agent/contract-types la devuelve.",

    formatsIntro:
      "Un contrato, cinco formatos, todos a partir del mismo texto. Un contrato pagado se puede descargar en todos los formatos sin coste adicional.",
    formatsColumns: { format: "Formato", type: "Tipo de medio", for: "Para qué", how: "Cómo obtenerlo" },
    formats: [
      { format: "Markdown", type: "text/markdown", for: "Agentes de IA y herramientas que leen texto", how: "inline: \"md\", o /document/md" },
      { format: "HTML", type: "text/html", for: "Páginas web, vistas previas y lectores de pantalla; un solo archivo, sin recursos externos", how: "inline: \"html\", o /document/html" },
      { format: "Texto", type: "text/plain", for: "Sistemas de texto plano", how: "inline: \"txt\", o /document/txt" },
      { format: "PDF", type: "application/pdf", for: "Leer e imprimir", how: "/document" },
      { format: "DOCX", type: "Documento de Word", for: "Editar en un procesador de textos", how: "/document/docx" },
    ],

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

    machines: [
      { label: "Esta página en Markdown", path: "/es/developers.md" },
      { label: "Tipos de contrato y los datos que pide cada uno (JSON)", path: "/api/v1/agent/contract-types?lang=es" },
      { label: "Herramientas MCP con sus endpoints REST (JSON)", path: "/api/v1/agent/mcp" },
      { label: "Tarjeta del agente", path: "/.well-known/agent.json" },
      { label: "Tarjeta del servidor MCP", path: "/.well-known/mcp/server-card.json" },
      { label: "Descubrimiento MCP", path: "/.well-known/mcp.json" },
      { label: "Resumen para modelos de IA", path: "/llms.txt" },
      { label: "Todos los tipos de contrato con su código y sus datos, para modelos de IA", path: "/llms-full.txt" },
    ],

    disclaimer:
      "Los contratos salen de modelos redactados por abogados. Lee cada contrato antes de firmarlo. Esta página es información general, no asesoramiento jurídico.",
    howToName: "Crear un contrato con la API de Dealroom",
    apiName: "API de agentes de Dealroom",
    apiDescription: "Crea un contrato en una sola llamada, descárgalo en Markdown, HTML, PDF, DOCX o texto, o negócialo entre dos agentes.",
  },
} satisfies Record<PageLocale, Record<string, unknown>>;

export type DevelopersCopy = (typeof DEVELOPERS_COPY)[PageLocale];
