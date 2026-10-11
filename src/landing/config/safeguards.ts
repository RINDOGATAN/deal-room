// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The safeguards guide on the Dealroom home (owner, 10 Oct 2026: the same guide as the
 * DPO Central and AI Sentinel landings, at the foot of the page). Ported from AI
 * Sentinel's src/landing/config/safeguards.ts (itself the storefront's PR 59 logic): six
 * questions, each answer sets a minimum level, the guide takes the highest level any
 * answer asks for and picks one way at that level. Unanswered questions count as the
 * lightest answer.
 *
 *   Level 0  In the TODO.LAW cloud
 *   Level 1  Managed virtual server (Asturias, Spain)
 *   Level 2  Your own hardware
 *
 * Two changes for this product:
 *  - The cloud is Dealroom's paid public service (pay per contract), not a test pilot, so
 *    real contracts belong there in both languages ("data:real" is level 0 and met by the
 *    cloud). Special-category data and privileged information still ask for managed.
 *  - The copy speaks of contracts and deals, and of the clause text an AI explanation uses
 *    (src/server/services/ai/prompts). AI features are off until a platform administrator
 *    turns them on (src/server/services/ai/posture.ts requireAi), and while off there is
 *    no AI call at all.
 *
 * Copy rules: no prices, no certification logos, no competitor names, no long dashes, no
 * "no certification" lines, no hosting location for the cloud (the copy does not claim
 * one), and the external AI provider may be outside the EU.
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

type Option = { value: string; level: Level; only?: Locale; /** A different level in one market (none on this landing). */ levelIn?: Partial<Record<Locale, Level>> };

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
    const l = o ? (o.levelIn?.[locale] ?? o.level) : 0;
    if (l > level) level = l;
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

/** Which ways meet a safeguard (the same in both markets here; the locale keeps the shared signature). */
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
      "Many tools with built-in AI send your text to an external AI provider. Here you choose. AI features are off until an administrator turns them on, and while they are off the product makes no AI calls at all. On the managed instance or on your own servers, AI features can use open-weight models hosted there, so the text does not leave that system.",
    questions: {
      loc: {
        label: "Where must your data stay?",
        options: { any: "Anywhere in the cloud: for now we only want to try it", servers: "On our own servers", office: "Inside our office" },
      },
      data: {
        label: "What will your contracts contain?",
        options: { test: "Test contracts only", real: "Real contracts with clients or business partners", special: "Contracts with special-category data (health, for example) or privileged information" },
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
        hint: "On your own servers, the system sits inside your perimeter, so your own controls and certifications apply.",
        options: { yes: "Yes", no: "No" },
      },
    },
    safeguards: {
      "loc:servers": "Data on your own servers",
      "loc:office": "Data inside your office",
      "data:real": "Real contracts",
      "data:special": "Special-category data or privileged information",
      "ai:none": "No AI calls unless they are turned on",
      "ai:key": "AI only with your own provider key",
      "ai:local": "AI on local models only",
      "iso:yes": "An instance isolated from other customers",
      "it:no": "No IT team of your own",
      "cert:yes": "Your own controls and certifications cover the system",
    },
    notes: {
      "loc:servers": { cloud: "Hosted by us, on a shared service.", managed: "Hosted by us, on an instance for you alone.", deploy: "Installed on your servers." },
      "loc:office": { cloud: "Hosted by us.", managed: "Hosted by us, outside your office.", deploy: "On your servers, in your office if they are there." },
      "data:real": { cloud: "Our public service: each party sees only the deals it takes part in.", managed: "An instance for your organization alone.", deploy: "Your contracts stay on your servers." },
      "data:special": { cloud: "For these contracts, choose the managed instance.", managed: "An instance for your organization alone.", deploy: "Your contracts stay on your servers." },
      "ai:none": { cloud: AI_OFF_EN, managed: AI_OFF_EN, deploy: AI_OFF_EN },
      "ai:key": { cloud: "We set the AI provider for the whole service; you cannot use your own key.", managed: "The instance can be set up with your own key.", deploy: "We set up AI with your own key." },
      "ai:local": { cloud: "With AI on, the clause text each AI explanation uses goes to the service's external AI provider, which may be outside the EU.", managed: "Open-weight models can run on the instance itself, so the clause text does not leave it.", deploy: "We can set up an open-weight model on your servers, if they have the capacity." },
      "iso:yes": { cloud: "A shared service: each party sees only its own deals, but the system is shared.", managed: "An isolated instance for you alone.", deploy: "Your own installation." },
      "it:no": { cloud: "We run it.", managed: "We run it for you.", deploy: "We install it with you, with our on-site or remote help." },
      "cert:yes": { cloud: "It works under our controls.", managed: "It works under our controls.", deploy: PERIMETER_EN },
    },
    summaries: {
      cloud:
        "Hosted by us, as a public service: drafting and negotiating are free, and each contract is paid once, when it is first downloaded or its signature starts. It is shared with other users, and each party sees only the deals it takes part in. If AI features are on, the clause text each AI explanation uses goes to the external AI provider set up on the service, which may be outside the EU.",
      managed:
        "An isolated instance we run for your organization alone, hosted in Asturias, Spain. Your contracts stay on that instance. AI features stay off until you turn them on, and can use open-weight models hosted on the instance itself, so the clause text does not leave it, or your own provider key.",
      deploy:
        "Dealroom installed on your own servers, with our on-site or remote help. Your contracts stay inside your perimeter, under your own controls. For AI features, we can set up an open-weight model on your servers, if they have the capacity, or your own key.",
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
      "Muchas herramientas con IA integrada envían tu texto a un proveedor de IA externo. Aquí eliges tú. Las funciones de IA están desactivadas hasta que un administrador las activa y, mientras lo están, el producto no hace ninguna llamada a una IA. En la instancia gestionada o si lo instalas en tus servidores, las funciones de IA pueden usar modelos de pesos abiertos alojados allí mismo, de modo que el texto no sale de ese sistema.",
    questions: {
      loc: {
        label: "¿Dónde deben estar tus datos?",
        options: { any: "En cualquier nube: de momento solo queremos probar", servers: "En nuestros propios servidores o en nuestra oficina" },
      },
      data: {
        label: "¿Qué van a contener tus contratos?",
        options: {
          test: "Solo contratos de prueba",
          real: "Contratos reales con clientes o socios de negocio",
          special: "Contratos con datos de categorías especiales (de salud, por ejemplo) o información sujeta a secreto profesional",
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
      "data:real": "Contratos reales",
      "data:special": "Datos de categorías especiales o información sujeta a secreto profesional",
      "ai:none": "Ninguna llamada a una IA salvo que se active",
      "ai:key": "IA solo con tu propia clave",
      "ai:local": "IA solo con modelos locales",
      "iso:yes": "Una instancia aislada de otros clientes",
      "it:no": "Sin equipo informático propio",
      "cert:yes": "Tus propios controles y certificaciones cubren el sistema",
    },
    notes: {
      "loc:servers": { cloud: "Lo alojamos nosotros, en un servicio compartido.", managed: "Lo alojamos nosotros, en una instancia solo para ti.", deploy: "Instalado en tus servidores." },
      "loc:office": {},
      "data:real": { cloud: "Nuestro servicio público: cada parte solo ve las negociaciones en las que participa.", managed: "Una instancia solo para tu organización.", deploy: "Tus contratos se quedan en tus servidores." },
      "data:special": { cloud: "Para estos contratos, elige la instancia gestionada.", managed: "Una instancia solo para tu organización.", deploy: "Tus contratos se quedan en tus servidores." },
      "ai:none": { cloud: AI_OFF_ES, managed: AI_OFF_ES, deploy: AI_OFF_ES },
      "ai:key": { cloud: "El proveedor de IA lo configuramos nosotros para todo el servicio; no puedes usar tu clave.", managed: "La instancia se puede configurar con tu propia clave.", deploy: "Configuramos la IA con tu propia clave." },
      "ai:local": { cloud: "Con la IA activada, el texto de las cláusulas que usa cada explicación de IA va al proveedor de IA externo del servicio, que puede estar fuera de la UE.", managed: "Los modelos de pesos abiertos pueden funcionar en la propia instancia, de modo que el texto de las cláusulas no sale de ella.", deploy: "Podemos configurar un modelo de pesos abiertos en tus servidores, si tienen capacidad." },
      "iso:yes": { cloud: "Es un servicio compartido: cada parte solo ve sus propias negociaciones, pero el sistema es común.", managed: "Una instancia aislada solo para ti.", deploy: "Tu propia instalación." },
      "it:no": { cloud: "Lo mantenemos nosotros.", managed: "Lo mantenemos nosotros para ti.", deploy: "Lo instalamos contigo, con nuestra asistencia presencial o remota." },
      "cert:yes": { cloud: "Funciona bajo nuestros controles.", managed: "Funciona bajo nuestros controles.", deploy: "Queda dentro de tu perímetro, bajo tus propios controles y certificaciones." },
    },
    summaries: {
      cloud:
        "Lo alojamos nosotros, como servicio público: redactar y negociar es gratis, y cada contrato se paga una sola vez, cuando se descarga por primera vez o se inicia su firma. Lo comparten otros usuarios, y cada parte solo ve las negociaciones en las que participa. Si las funciones de IA están activadas, el texto de las cláusulas que usa cada explicación de IA va al proveedor de IA externo configurado en el servicio, que puede estar fuera de la UE.",
      managed:
        "Una instancia aislada que operamos nosotros, solo para tu organización, alojada en Asturias (España). Tus contratos se quedan en esa instancia. Las funciones de IA están desactivadas hasta que las activas, y pueden usar modelos de pesos abiertos alojados en la propia instancia, de modo que el texto de las cláusulas no sale de ella, o la clave de tu propio proveedor.",
      deploy:
        "Dealroom instalado en tus propios servidores, con nuestra asistencia presencial o remota. Tus contratos se quedan dentro de tu perímetro, bajo tus propios controles. Para las funciones de IA, podemos configurar un modelo de pesos abiertos alojado en tus servidores, si tienen capacidad, o tu propia clave.",
    },
  },
};
