// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The safeguards guide on the Dealroom landing: six questions, each answer sets a minimum
 * level, the guide takes the highest level any answer asks for and picks one way at that
 * level. Unanswered questions count as the lightest answer.
 *
 *   Level 0  TODO.LAW cloud
 *   Level 1  Managed instance (Asturias, Spain; open-weight models can run on the instance)
 *   Level 2  Your own hardware
 *
 * The questions, the tick matrix and the copy are shared word for word with the TODO.LAW
 * storefront and the other product landings (see the CANONICAL WIZARD CONTENT note above
 * COPY, and safeguards.canonical.test.ts). The copy is worded to be true for every product:
 * AI features are off until an administrator turns them on, and while off there is no AI
 * call at all. The one line that differs per product is the cloud's hosting location
 * (HOSTING, outside the canonical content).
 * Copy rules: no prices, no certification logos, no competitor names, no long dashes.
 */

export type Locale = "en" | "es";
export type WayId = "cloud" | "managed" | "deploy";
export type QuestionId = "loc" | "data" | "ai" | "iso" | "it" | "cert";
export type Answers = Partial<Record<QuestionId, string>>;
type Level = 0 | 1 | 2;

/**
 * The number of each way's box on this landing (`<locale>.ways.wN.title`), so the guide
 * names a way exactly as its box does. Three boxes in both languages.
 */
export const WAY_CARD: Record<Locale, Partial<Record<WayId, number>>> = {
  es: { cloud: 1, managed: 2, deploy: 3 },
  en: { cloud: 1, managed: 2, deploy: 3 },
};

/** Lightest to strictest: "one step stricter / lighter" follows this order. */
export const LADDER: Record<Locale, WayId[]> = {
  es: ["cloud", "managed", "deploy"],
  en: ["cloud", "managed", "deploy"],
};

type Option = { value: string; level: Level; only?: Locale };

export const QUESTIONS: { id: QuestionId; options: Option[] }[] = [
  {
    id: "loc",
    options: [
      { value: "any", level: 0 },
      { value: "servers", level: 2 },
      { value: "office", level: 2, only: "en" },
    ],
  },
  {
    id: "data",
    options: [
      { value: "test", level: 0 },
      { value: "real", level: 0 },
      { value: "special", level: 1 },
    ],
  },
  {
    id: "ai",
    options: [
      { value: "none", level: 0 },
      { value: "ext", level: 0 },
      { value: "key", level: 1 },
      { value: "local", level: 1 },
    ],
  },
  {
    id: "iso",
    options: [
      { value: "yes", level: 1 },
      { value: "no", level: 0 },
    ],
  },
  {
    id: "it",
    options: [
      { value: "yes", level: 0 },
      { value: "no", level: 0 },
    ],
  },
  {
    id: "cert",
    options: [
      { value: "yes", level: 2 },
      { value: "no", level: 0 },
    ],
  },
];

/** The options a visitor in this market is offered. */
export const optionsFor = (q: (typeof QUESTIONS)[number], locale: Locale) => q.options.filter((o) => !o.only || o.only === locale);

/** The answers that are requirements, and which ways meet them (the tick matrix). */
export type SafeguardKey = "loc:servers" | "loc:office" | "data:real" | "data:special" | "ai:none" | "ai:key" | "ai:local" | "iso:yes" | "it:no" | "cert:yes";

const MET: Record<SafeguardKey, Record<WayId, boolean>> = {
  "loc:servers": { cloud: false, managed: false, deploy: true },
  "loc:office": { cloud: false, managed: false, deploy: true },
  "data:real": { cloud: true, managed: true, deploy: true },
  "data:special": { cloud: false, managed: true, deploy: true },
  "ai:none": { cloud: true, managed: true, deploy: true },
  "ai:key": { cloud: false, managed: true, deploy: true },
  "ai:local": { cloud: false, managed: true, deploy: true },
  "iso:yes": { cloud: false, managed: true, deploy: true },
  "it:no": { cloud: true, managed: true, deploy: true },
  "cert:yes": { cloud: false, managed: false, deploy: true },
};

/** The level the answers ask for: the highest any answer sets. */
export function levelOf(answers: Answers, locale: Locale): Level {
  let level: Level = 0;
  for (const q of QUESTIONS) {
    const o = optionsFor(q, locale).find((x) => x.value === answers[q.id]);
    if (o && o.level > level) level = o.level;
  }
  return level;
}

/** The way that meets the answers, from the ways offered in this market. */
export function pickWay(answers: Answers, locale: Locale): WayId {
  const level = levelOf(answers, locale);
  if (level === 0) return "cloud";
  if (level === 1) return "managed";
  return "deploy";
}

/** The chosen answers that are requirements, in question order. */
export function requirementsOf(answers: Answers, locale: Locale): SafeguardKey[] {
  return QUESTIONS.flatMap((q) => {
    const v = answers[q.id];
    if (!v || !optionsFor(q, locale).some((o) => o.value === v)) return [];
    const key = `${q.id}:${v}`;
    return key in MET ? [key as SafeguardKey] : [];
  });
}

/** Which ways meet a safeguard (the same in both languages; the locale keeps the shared signature). */
export const meets = (way: WayId, key: SafeguardKey, _locale?: Locale) => MET[key][way];

export type Recommendation = {
  level: Level;
  way: WayId;
  checks: { key: SafeguardKey; met: boolean }[];
  /** The next way up and down the ladder, with the chosen safeguards each would not meet. */
  up: { way: WayId; missing: SafeguardKey[] } | null;
  down: { way: WayId; missing: SafeguardKey[] } | null;
};

/** The whole result, or null while nothing is answered. */
export function recommend(answers: Answers, locale: Locale): Recommendation | null {
  if (!QUESTIONS.some((q) => answers[q.id])) return null;
  const way = pickWay(answers, locale);
  const reqs = requirementsOf(answers, locale);
  const ladder = LADDER[locale];
  const i = ladder.indexOf(way);
  const near = (w: WayId | undefined) => (w ? { way: w, missing: reqs.filter((k) => !meets(w, k, locale)) } : null);
  return {
    level: levelOf(answers, locale),
    way,
    checks: reqs.map((key) => ({ key, met: meets(way, key, locale) })),
    up: near(ladder[i + 1]),
    down: near(ladder[i - 1]),
  };
}

/* ------------------------------------------------------------------ copy */

/*
 * CANONICAL WIZARD CONTENT. The questions (QUESTIONS), the tick matrix for the three ways
 * (MET: cloud, managed, deploy), the names of the three ways (WAY_NAMES) and everything
 * below (COPY) are identical, word for word, in four places, and must change together:
 *   - todolaw          src/content/safeguards.ts
 *   - dpocentral       src/landing/content/safeguards.ts
 *   - aisentinel       src/landing/config/safeguards.ts
 *   - deal-room        src/landing/config/safeguards.ts
 * A test next to this file hashes the normalised content (SHA-256) and fails when it
 * changes alone: edit all four copies, then update the hash in all four tests.
 */

/** The names of the three ways, the same on every site, in the guide and on the ways boxes. */
export type GuideWay = "cloud" | "managed" | "deploy";
export const WAY_NAMES: Record<Locale, Record<GuideWay, string>> = {
  en: { cloud: "TODO.LAW cloud", managed: "Managed instance", deploy: "Your own hardware" },
  es: { cloud: "En la nube de TODO.LAW", managed: "Instancia gestionada", deploy: "Tu propio hardware" },
};

/**
 * The cloud's hosting location: one line each site fills in (HOSTING, after COPY), shown
 * under the cloud's summary. It is not part of the canonical content. EU hosting is named
 * only on Spanish pages or to visitors in the EU, never to other visitors; null shows nothing.
 */
export type HostingLine = { es: string | null; enEu: string | null; enOther: string | null };
export const hostingLine = (h: HostingLine, locale: Locale, eu: boolean): string | null =>
  locale === "es" ? h.es : eu ? h.enEu : h.enOther;

type Notes = Partial<Record<WayId, string>>;

export type SafeguardsCopy = {
  heading: string;
  lead: string;
  open: string;
  close: string;
  formLegend: string;
  formSub: string;
  reset: string;
  empty: string;
  rec: string;
  meets: string;
  none: string;
  up: string;
  down: string;
  top: string;
  bottom: string;
  all: string;
  miss: string;
  met: string;
  notMet: string;
  see: string;
  seeResult: string;
  whyH: string;
  whyP: string;
  questions: Record<QuestionId, { label: string; hint?: string; options: Record<string, string> }>;
  safeguards: Record<SafeguardKey, string>;
  notes: Record<SafeguardKey, Notes>;
  summaries: Partial<Record<WayId, string>>;
};

const AI_OFF_EN = "AI is off by default; while off, no AI calls are made.";
const AI_OFF_ES = "La IA viene desactivada; mientras lo está, no hay llamadas a una IA.";
const PERIMETER_EN = "It sits inside your perimeter, under your own controls and certifications.";
const SUBPROCESSORS_EN = "Accepted: all our sub-processors have the necessary safeguards and certifications.";
const SUBPROCESSORS_ES = "Se admiten: todos nuestros subencargados cuentan con las certificaciones y garantías necesarias.";

export const COPY: Record<Locale, SafeguardsCopy> = {
  en: {
    heading: "Not sure which to choose?",
    lead: "Answer six short questions about the safeguards you need, and we show which way meets them.",
    open: "Answer the questions",
    close: "Hide the questions",
    formLegend: "Your safeguards",
    formSub: "The recommendation updates as you answer.",
    reset: "Start again",
    empty: "Answer any question to see the recommended way.",
    rec: "Recommended way",
    meets: "Which safeguards it meets",
    none: "You have not chosen a strict safeguard: the cloud is enough.",
    up: "One step stricter",
    down: "One step lighter",
    top: "This is the strictest way available.",
    bottom: "This is the lightest way.",
    all: "Meets everything you chose.",
    miss: "Does not meet: ",
    met: "Meets",
    notMet: "Does not meet",
    see: "See this way",
    seeResult: "See the result",
    whyH: "Why this matters",
    whyP:
      "Many tools with built-in AI send your text to an external AI provider. Here you choose. AI features are off until an administrator turns them on, and while they are off the product makes no AI calls at all. On a managed instance or on your own servers, AI features can use open-weight models hosted there, so the text does not leave that system.",
    questions: {
      loc: {
        label: "Where must your data stay?",
        options: { any: "We could use a SaaS, provided that all sub-processors have the necessary safeguards and certifications", servers: "On our own servers", office: "Inside our office" },
      },
      data: {
        label: "What data will you keep in it?",
        options: { test: "Test records or pseudonyms only", real: "Real client or business data", special: "Special-category data (health, for example) or privileged information" },
      },
      ai: {
        label: "May AI features send content to an external AI provider?",
        options: { none: "We do not need AI features", ext: "Yes, they may", key: "Only with our own provider key", local: "Never: local models only" },
      },
      iso: {
        label: "Must your instance be isolated from other customers?",
        options: { yes: "Yes", no: "No, a shared service is fine to start" },
      },
      it: {
        label: "Do you have your own IT team to maintain it?",
        options: { yes: "Yes", no: "No" },
      },
      cert: {
        label: "Must your own controls and certifications (for example ISO 27001) cover the system?",
        hint: "On your own servers or hardware, the system sits inside your perimeter, so your own controls and certifications apply.",
        options: { yes: "Yes", no: "No" },
      },
    },
    safeguards: {
      "loc:servers": "Data on your own servers",
      "loc:office": "Data inside your office",
      "data:real": "Real client data",
      "data:special": "Special-category data or privileged information",
      "ai:none": "No AI calls unless you turn them on",
      "ai:key": "AI only with your own provider key",
      "ai:local": "AI on local models only",
      "iso:yes": "An instance isolated from other customers",
      "it:no": "No IT team of your own",
      "cert:yes": "Your own controls and certifications cover the system",
    },
    notes: {
      "loc:servers": { cloud: "Hosted by us, on a shared service.", managed: "Hosted by us, on an instance for you alone.", deploy: "Installed on your servers." },
      "loc:office": { cloud: "Hosted by us.", managed: "Hosted by us, outside your office.", deploy: "On your servers, in your office if they are there." },
      "data:real": { cloud: SUBPROCESSORS_EN, managed: "An instance for your organization alone.", deploy: "Your records stay on your servers." },
      "data:special": { cloud: "For this data, choose the managed instance.", managed: "An instance for your organization alone.", deploy: "Your records stay on your servers." },
      "ai:none": { cloud: AI_OFF_EN, managed: AI_OFF_EN, deploy: AI_OFF_EN },
      "ai:key": { cloud: "We set the AI provider for the whole service; you cannot use your own key.", managed: "The instance can be set up with your own key.", deploy: "We set up AI with your own key." },
      "ai:local": { cloud: "With AI on, the details of the record being drafted go to the service's external AI provider.", managed: "Open-weight models can run on the instance itself, so the text does not leave it.", deploy: "We can set up an open-weight model on your servers, if they have the capacity." },
      "iso:yes": { cloud: "A shared service: each organization's records are kept apart, but the system is shared.", managed: "An isolated instance for you alone.", deploy: "Your own installation." },
      "it:no": { cloud: "We run it.", managed: "We run it for you.", deploy: "We install it with you, with our on-site or remote help." },
      "cert:yes": { cloud: "It works under our controls.", managed: "It works under our controls, on an instance for you alone.", deploy: PERIMETER_EN },
    },
    summaries: {
      cloud:
        "Hosted by us, on a shared service: each organization's records are kept apart. You can start free and use it with real client data: all our sub-processors have the necessary safeguards and certifications. If an administrator turns AI features on, the details of the record being drafted go to the external AI provider set up on the service.",
      managed: "An isolated instance we run for your organization alone, hosted in Asturias, Spain. Your records stay on that instance. AI features stay off until you turn them on, and can use open-weight models hosted on the instance itself, so the text does not leave it, or your own provider key.",
      deploy:
        "Installed on your own servers, with our on-site or remote help. Your records stay inside your perimeter, under your own controls. For AI features, we can set up an open-weight model on your servers, if they have the capacity, or your own key.",
    },
  },
  es: {
    heading: "¿No sabes cuál elegir?",
    lead: "Responde a seis preguntas breves sobre las garantías que necesitas y te indicamos qué modalidad las cumple.",
    open: "Responder a las preguntas",
    close: "Ocultar las preguntas",
    formLegend: "Tus garantías",
    formSub: "La recomendación cambia mientras respondes.",
    reset: "Empezar de nuevo",
    empty: "Responde a alguna pregunta para ver la modalidad recomendada.",
    rec: "Modalidad recomendada",
    meets: "Qué garantías cumple",
    none: "No has marcado ninguna garantía estricta: la nube basta.",
    up: "Un paso más estricto",
    down: "Un paso más ligero",
    top: "Es la modalidad más estricta disponible.",
    bottom: "Es la modalidad más ligera.",
    all: "Cumple todo lo que has marcado.",
    miss: "No cumple: ",
    met: "Cumple",
    notMet: "No cumple",
    see: "Ver esta modalidad",
    seeResult: "Ver el resultado",
    whyH: "Por qué importa",
    whyP:
      "Muchas herramientas con IA integrada envían tu texto a un proveedor de IA externo. Aquí eliges tú. Las funciones de IA están desactivadas hasta que un administrador las activa y, mientras lo están, el producto no hace ninguna llamada a una IA. En una instancia gestionada o en tus propios servidores, las funciones de IA pueden usar modelos de pesos abiertos alojados allí mismo, de modo que el texto no sale de ese sistema.",
    questions: {
      loc: {
        label: "¿Dónde deben estar tus datos?",
        options: { any: "Pueden estar en nube siempre y cuando todos los subencargados cuenten con las certificaciones y garantías necesarias", servers: "En nuestros propios servidores o en nuestra oficina" },
      },
      data: {
        label: "¿Qué datos vas a guardar?",
        options: {
          test: "Solo registros de prueba o seudónimos",
          real: "Datos reales de clientes o de la empresa",
          special: "Datos de categorías especiales (de salud, por ejemplo) o información sujeta a secreto profesional",
        },
      },
      ai: {
        label: "¿Pueden las funciones de IA enviar contenido a un proveedor de IA externo?",
        options: { none: "No necesitamos funciones de IA", ext: "Sí, pueden", key: "Solo con la clave de nuestro propio proveedor", local: "Nunca: solo modelos locales" },
      },
      iso: {
        label: "¿Debe tu instancia estar aislada de la de otros clientes?",
        options: { yes: "Sí", no: "No, un servicio compartido nos sirve para empezar" },
      },
      it: {
        label: "¿Tienes un equipo informático propio que pueda mantenerlo?",
        options: { yes: "Sí", no: "No" },
      },
      cert: {
        label: "¿Deben tus propios controles y certificaciones (por ejemplo, ISO 27001) cubrir el sistema?",
        hint: "En tus servidores, el sistema queda dentro de tu perímetro, así que se aplican tus propios controles y certificaciones.",
        options: { yes: "Sí", no: "No" },
      },
    },
    safeguards: {
      "loc:servers": "Datos en tus propios servidores o en tu oficina",
      "loc:office": "",
      "data:real": "Datos reales de clientes",
      "data:special": "Datos de categorías especiales o información sujeta a secreto profesional",
      "ai:none": "Ninguna llamada a una IA salvo que la actives",
      "ai:key": "IA solo con tu propia clave",
      "ai:local": "IA solo con modelos locales",
      "iso:yes": "Una instancia aislada de otros clientes",
      "it:no": "Sin equipo informático propio",
      "cert:yes": "Tus propios controles y certificaciones cubren el sistema",
    },
    notes: {
      "loc:servers": { cloud: "Lo alojamos nosotros, en un servicio compartido.", managed: "Lo alojamos nosotros, en una instancia solo para ti.", deploy: "Instalado en tus servidores." },
      "loc:office": {},
      "data:real": { cloud: SUBPROCESSORS_ES, managed: "Una instancia solo para tu organización.", deploy: "Tus registros se quedan en tus servidores." },
      "data:special": { cloud: "Para estos datos, elige la instancia gestionada.", managed: "Una instancia solo para tu organización.", deploy: "Tus registros se quedan en tus servidores." },
      "ai:none": { cloud: AI_OFF_ES, managed: AI_OFF_ES, deploy: AI_OFF_ES },
      "ai:key": { cloud: "El proveedor de IA lo configuramos nosotros para todo el servicio; no puedes usar tu clave.", managed: "La instancia se puede configurar con tu propia clave.", deploy: "Configuramos la IA con tu propia clave." },
      "ai:local": { cloud: "Con la IA activada, los datos del registro que se redacta van al proveedor de IA externo del servicio, que puede estar fuera de la UE.", managed: "Los modelos de pesos abiertos pueden funcionar en la propia instancia, de modo que el texto no sale de ella.", deploy: "Podemos configurar un modelo de pesos abiertos en tus servidores, si tienen capacidad." },
      "iso:yes": { cloud: "Es un servicio compartido: los registros de cada organización están separados, pero el sistema es común.", managed: "Una instancia aislada solo para ti.", deploy: "Tu propia instalación." },
      "it:no": { cloud: "Lo mantenemos nosotros.", managed: "Lo mantenemos nosotros para ti.", deploy: "Lo instalamos contigo, con nuestra asistencia presencial o remota." },
      "cert:yes": { cloud: "Funciona bajo nuestros controles.", managed: "Funciona bajo nuestros controles, en una instancia solo para ti.", deploy: "Queda dentro de tu perímetro, bajo tus propios controles y certificaciones." },
    },
    summaries: {
      cloud:
        "Lo alojamos nosotros, en un servicio compartido: los registros de cada organización están separados. Puedes empezar gratis y usarlo con datos reales de clientes: todos nuestros subencargados cuentan con las certificaciones y garantías necesarias. Si un administrador activa las funciones de IA, los datos del registro que se redacta van al proveedor de IA externo configurado en el servicio, que puede estar fuera de la UE.",
      managed: "Una instancia aislada que operamos nosotros, solo para tu organización, alojada en Asturias (España). Tus registros se quedan en esa instancia. Las funciones de IA están desactivadas hasta que las activas, y pueden usar modelos de pesos abiertos alojados en la propia instancia, de modo que el texto no sale de ella, o la clave de tu propio proveedor.",
      deploy:
        "Instalado en tus propios servidores, con nuestra asistencia presencial o remota. Los registros se quedan dentro de tu perímetro, bajo tus propios controles. Para las funciones de IA, podemos configurar un modelo de pesos abiertos alojado en tus servidores, si tienen capacidad, o tu propia clave.",
    },
  },
};

/**
 * This site's hosting line for the cloud (not canonical: each copy fills in its own).
 * Checked 12 Oct 2026: vercel.json sets no region, so the functions run in Vercel's default iad1 (United States).
 */
export const HOSTING: HostingLine = {
  es: "En la nube de TODO.LAW, Dealroom funciona en Estados Unidos.",
  enEu: "On the TODO.LAW cloud, Dealroom runs in the United States.",
  enOther: "On the TODO.LAW cloud, Dealroom runs in the United States.",
};
