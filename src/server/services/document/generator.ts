// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Contract Document Generator Service
 *
 * Compiles deal room data into structured contract data for PDF generation.
 */

import prisma from "@/lib/prisma";
import { roleRequiresSwap } from "@/lib/contractRoles";
import { resolveLocalizedString } from "@/server/services/skills/i18n";
import {
  interpolateParameters,
  buildBoilerplateVariables,
  type ParameterSchema,
} from "@/lib/parameters";
import { certificationService } from "@/lib/certification-client";
import { createLogger } from "@/lib/logger";

const logger = createLogger("doc-generator");

export interface PartyData {
  name: string;
  email: string;
  company?: string;
  legalName?: string;
  address?: string;
  taxId?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  /** Typed signature string (the name the party typed at signing). */
  signature?: string;
  /** Wall-clock timestamp the signature was recorded. */
  signedAt?: Date;
}

export interface ClauseData {
  title: string;
  category: string;
  agreedOption: string;
  legalText: string;
  /** True 1-based section number in the final agreement. Only consumed when the
   *  boilerplate opts into sequential numbering (see BoilerplateData.sequentialNumbering);
   *  ignored for the default grouped "Negotiated Terms" layout. */
  sectionNumber?: number;
}

export interface Definition {
  term: string;
  definition: string;
}

export interface StandardClause {
  title: string;
  text: string;
  /** True 1-based section number in the final agreement. Present only for
   *  boilerplates that opt into sequential numbering; ignored otherwise. */
  sectionNumber?: number;
  /** Statutory citation for this clause ("LAU 29/1994 art. 9", "Housing Act
   *  2004 ss. 212-215"), rendered as a small line under the body. Used by
   *  skills whose standard clauses reproduce mandatory law — it shows the
   *  reader the app is restating the statute rather than inventing terms.
   *  Optional: skills without it render exactly as before. */
  source?: string;
}

export interface BoilerplateData {
  contractTitle: string;
  preamble: string;
  background?: string;
  definitions: Definition[];
  standardClauses: StandardClause[];
  generalProvisions: StandardClause[];
  jurisdictionProvision: StandardClause | null;
  jurisdictionProvisions?: StandardClause[]; // Multi-jurisdiction (e.g., Privacy Notice)
  signatureBlock: string;
  partyLabels?: { partyA: string; partyB: string };
  /** Annexes/Schedules rendered on their own pages AFTER the signature blocks (e.g. DPA Annex I/II). */
  annexes?: StandardClause[];
  /** Opt-in flag (BAA): render the whole body as ONE continuous, sequentially
   *  numbered agreement — negotiable clauses and fixed standardClauses merged
   *  into a single list ordered by their true section number, each heading
   *  "N. Title" with no "Negotiated Terms" group and no margin re-numbering.
   *  Absent/false → the historical grouped layout (DPA/NDA/etc. unaffected). */
  sequentialNumbering?: boolean;
}

/** One heading+body section in the merged, sequentially-numbered layout. */
export interface SequentialSection {
  sectionNumber: number;
  title: string;
  body: string;
}

/**
 * Merge fixed standardClauses and negotiable clauses into a single list sorted
 * by true section number, for the sequential-numbering (BAA) layout. Shared by
 * all three renderers so the ordering is defined in exactly one place.
 */
export function buildSequentialSections(data: ContractData): SequentialSection[] {
  const bp = data.boilerplate;
  if (!bp) return [];
  const merged: SequentialSection[] = [
    ...bp.standardClauses.map((c) => ({
      sectionNumber: c.sectionNumber ?? 0,
      title: c.title,
      body: c.text,
    })),
    ...data.clauses.map((c) => ({
      sectionNumber: c.sectionNumber ?? 0,
      title: c.title,
      body: c.legalText,
    })),
  ];
  return merged.sort((a, b) => a.sectionNumber - b.sectionNumber);
}

export interface CertificationData {
  ceremonyId: string;
  documentHash: string;
  certified: boolean;
  timestamps: Array<{
    partyRole: string;
    rfc3161Timestamp: string;
    signedAt: string;
    signerIp?: string;
  }>;
  verificationUrl?: string;
  auditCertificateUrl?: string;
}

export interface ContractData {
  dealName: string;
  contractType: string;
  governingLaw: string;
  governingLawKey: string;
  createdAt: Date;
  partyA: PartyData;
  partyB: PartyData | null;
  clauses: ClauseData[];
  /** Governing-law-and-jurisdiction article (negotiated forum), rendered as its
   *  own top-level article rather than under "Negotiated Terms". */
  governingLawArticle?: { title: string; text: string };
  /** Display names for the cover-page A/B slots, already reflecting the solo
   *  Controller/Processor swap. Falls back to the party objects when absent. */
  coverPartyAName?: string;
  coverPartyBName?: string;
  boilerplate: BoilerplateData | null;
  language: string;
  /** Present when document has been certified via Cloud API */
  certification?: CertificationData;
  /** Present when deal is from agent negotiation with attorney attestation */
  agentAttestation?: {
    attorneyName: string;
    barNumber: string;
    uetaPreamble: string;
    attestationFooter: string;
  };
}

const GOVERNING_LAW_DISPLAY: Record<string, Record<string, string>> = {
  CALIFORNIA: {
    en: "State of California, United States of America",
    es: "Estado de California, EE.UU.",
  },
  NEW_YORK: {
    en: "State of New York, United States of America",
    es: "Estado de Nueva York, EE.UU.",
  },
  ENGLAND_WALES: {
    en: "England and Wales, United Kingdom",
    es: "Inglaterra y Gales, Reino Unido",
  },
  SPAIN: {
    en: "Kingdom of Spain",
    es: "Reino de España",
  },
};

/**
 * Interpolate variables in boilerplate text
 */
function interpolateText(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] || match;
  });
}

/**
 * Compose the closing sections of the DPA's SCC-incorporation annex
 * ({transferAddendaSections}): §6 United Kingdom — either incorporating the
 * ICO's International Data Transfer Addendum by reference (Part 1 tables
 * completed by cross-reference to this DPA, Table 4 electing that either
 * party may end it under its Section 19) or, when declined, the historical
 * "execute separately" notice — and, when elected, §7 Swiss FADP
 * adaptations. Both operative sections are drafted to apply only to the
 * extent transfers subject to the UK GDPR / FADP exist, so including them
 * in a purely EU-facing DPA is inert (the big-vendor DPA convention).
 * Exported for unit tests.
 */
export function buildTransferAddendaSections(
  dealParams: Record<string, string>,
  language: string
): string {
  const isES = language === "es";
  const ukIncorporated = (dealParams["include-uk-addendum"] || "yes") === "yes";
  const swiss = (dealParams["include-swiss-adaptations"] || "yes") === "yes";

  const uk = ukIncorporated
    ? (isES
        ? "6. TRANSFERENCIAS DEL REINO UNIDO\nRespecto de las transferencias de Datos Personales sujetas al RGPD del Reino Unido, las partes incorporan por referencia el Anexo de Transferencia Internacional de Datos a las Cláusulas Contractuales Tipo de la Comisión Europea, emitido por el Information Commissioner del Reino Unido al amparo del artículo 119A de la Data Protection Act 2018 (versión B1.0, en vigor desde el 21 de marzo de 2022) (el «UK Addendum»), cuya Parte 2 (Cláusulas Obligatorias) modifica en consecuencia las Cláusulas Contractuales Tipo. A los efectos de la Parte 1 del UK Addendum: la Tabla 1 (Partes) se completa con la información del preámbulo y del Anexo I de este acuerdo; la Tabla 2 (CCT, Módulos y Cláusulas seleccionadas) se remite a las Cláusulas Contractuales Tipo tal como quedan incorporadas y completadas en este Anexo; la Tabla 3 (Información de los Apéndices) se completa con los Anexos I y II de este acuerdo y los Subencargados autorizados conforme a este acuerdo; y en la Tabla 4 (terminación cuando cambie el Addendum aprobado), cualquiera de las partes podrá poner fin al UK Addendum conforme a su Sección 19. Respecto de dichas transferencias, la autoridad de control competente es el Information Commissioner del Reino Unido. Esta Sección se aplica únicamente en la medida en que existan transferencias sujetas al RGPD del Reino Unido."
        : "6. UNITED KINGDOM TRANSFERS\nIn respect of transfers of Personal Data subject to the UK GDPR, the parties incorporate by reference the International Data Transfer Addendum to the EU Commission Standard Contractual Clauses issued by the UK Information Commissioner under section 119A of the Data Protection Act 2018 (version B1.0, in force 21 March 2022) (the \"UK Addendum\"), whose Part 2 (Mandatory Clauses) amends the Standard Contractual Clauses accordingly. For the purposes of Part 1 of the UK Addendum: Table 1 (Parties) is completed with the information in the preamble and Annex I of this DPA; Table 2 (Selected SCCs, Modules and Selected Clauses) refers to the Standard Contractual Clauses as incorporated and completed in this Annex; Table 3 (Appendix Information) is completed with Annexes I and II of this DPA and the Sub-processors authorised under this DPA; and for Table 4 (ending when the Approved Addendum changes), either party may end the UK Addendum as set out in its Section 19. In respect of such transfers, the competent supervisory authority is the UK Information Commissioner. This Section applies only to the extent transfers subject to the UK GDPR take place.")
    : (isES
        ? "6. TRANSFERENCIAS DEL REINO UNIDO\nLas transferencias sujetas al RGPD del Reino Unido no quedan cubiertas por este Anexo; requieren el Anexo de Transferencias Internacionales de Datos del Reino Unido (UK Addendum), que las partes suscribirán por separado cuando proceda."
        : "6. UNITED KINGDOM TRANSFERS\nTransfers subject to the UK GDPR are not covered by this Annex; they require the UK International Data Transfer Addendum, which the parties shall execute separately where applicable.");

  const ch = swiss
    ? (isES
        ? "\n\n7. TRANSFERENCIAS SUIZAS\nRespecto de las transferencias de Datos Personales sujetas a la Ley Federal suiza de Protección de Datos («LPD»), las Cláusulas Contractuales Tipo se aplican con las siguientes adaptaciones: (a) las referencias al RGPD se entenderán hechas, en lo que respecta a dichas transferencias, a la LPD; (b) la autoridad de control competente conforme a la Cláusula 13 es el Encargado Federal suizo de Protección de Datos y Transparencia (PFPDT); (c) las referencias a un Estado miembro de la UE no se interpretarán en el sentido de impedir que los Interesados con residencia habitual en Suiza ejerzan sus derechos en su lugar de residencia habitual, conforme a la Cláusula 18, letra c); y (d) la ley aplicable y el foro elegidos conforme a las Cláusulas 17 y 18 permanecen inalterados. Esta Sección se aplica únicamente en la medida en que existan transferencias sujetas a la LPD."
        : "\n\n7. SWISS TRANSFERS\nIn respect of transfers of Personal Data subject to the Swiss Federal Act on Data Protection (\"FADP\"), the Standard Contractual Clauses apply with the following adaptations: (a) references to the GDPR shall, insofar as such transfers are concerned, be read as references to the FADP; (b) the competent supervisory authority under Clause 13 is the Swiss Federal Data Protection and Information Commissioner (FDPIC); (c) references to an EU Member State shall not be interpreted as preventing Data Subjects habitually resident in Switzerland from enforcing their rights in their place of habitual residence, in accordance with Clause 18(c); and (d) the governing law and forum elected under Clauses 17 and 18 remain unchanged. This Section applies only to the extent transfers subject to the FADP take place.")
    : "";

  return uk + ch;
}

/**
 * Documented importer-status conclusions for the Transfer Impact
 * Assessment's Section 2 ({tiaEcspStatement} / {tiaRequestHistoryStatement}).
 * The TIA must answer what it poses: instead of stating that the parties
 * "have considered" the importer's ECSP status and request history without
 * recording an outcome, these render the wizard's direct answers as
 * conclusions — with a prudent-assumption fallback when undetermined.
 * Exported for unit tests.
 */
export function buildTiaImporterStatements(
  dealParams: Record<string, string>,
  language: string
): {
  tiaEcspStatement: string;
  tiaRequestHistoryStatement: string;
  tiaBreachHistoryStatement: string;
} {
  const isES = language === "es";
  const hosted = (dealParams["tia-importer-hosted"] || "yes").trim();
  const history = (dealParams["tia-gov-requests-received"] || "unknown").trim();
  const breaches = (dealParams["tia-breach-history"] || "unknown").trim();

  const ecsp =
    hosted === "no"
      ? (isES
          ? "El importador de datos no presta a terceros servicios alojados de almacenamiento o comunicaciones, por lo que es improbable que pueda calificarse como «electronic communication service provider» a los efectos de la FISA 702; la exposición residual se reduce en consecuencia, sin perjuicio de que los análisis anteriores de la EO 12333 y de la CLOUD Act siguen siendo pertinentes."
          : "The data importer does not provide hosted storage or communications services to third parties and is therefore unlikely to qualify as an \"electronic communication service provider\" within the meaning of FISA 702; the residual exposure is correspondingly reduced, although the EO 12333 and CLOUD Act analyses above remain relevant.")
      : hosted === "yes"
        ? (isES
            ? "El importador de datos almacena o aloja datos de clientes como servicio, por lo que probablemente pueda calificarse como proveedor de «remote computing service» en el sentido del 18 U.S.C. § 2711 y, en consecuencia, como «electronic communication service provider» potencialmente sujeto a directivas dictadas al amparo de la FISA 702; la evaluación siguiente asume, por tanto, que el importador queda dentro del alcance de dicha potestad."
            : "The data importer stores or hosts customer data as a service and is therefore likely to qualify as a provider of \"remote computing service\" within the meaning of 18 U.S.C. § 2711, and consequently as an \"electronic communication service provider\" potentially subject to directives under FISA 702; the assessment below therefore assumes that the importer falls within the scope of that authority.")
        : (isES
            ? "Las partes no han podido determinar de forma concluyente si el importador puede calificarse como «electronic communication service provider» a los efectos de la FISA 702; la evaluación siguiente parte, por prudencia, de la hipótesis de que sí puede serlo."
            : "The parties could not conclusively determine whether the importer qualifies as an \"electronic communication service provider\" within the meaning of FISA 702; the assessment below therefore proceeds on the prudent assumption that it may.");

  const req =
    history === "none"
      ? (isES
          ? "El importador de datos ha declarado que, a la fecha de esta evaluación, no ha recibido ninguna solicitud gubernamental de acceso a datos personales tratados por cuenta de sus clientes; esta declaración queda documentada y se renovará en cada revisión de la presente evaluación."
          : "The data importer has declared that, as at the date of this assessment, it has not received any government request for access to personal data processed for its customers; that declaration is documented here and will be refreshed at each review of this assessment.")
      : history === "some"
        ? (isES
            ? "El importador de datos ha recibido solicitudes gubernamentales de acceso en el pasado; las partes han tenido en cuenta su tramitación de dichas solicitudes y sus informes de transparencia al alcanzar la conclusión del apartado 4."
            : "The data importer has received government access requests in the past; the parties have taken the importer's handling of those requests and its transparency reporting into account in reaching the conclusion in Section 4.")
        : (isES
            ? "No se ha dispuesto de información fiable sobre el historial de solicitudes gubernamentales de acceso del importador; la evaluación procede de forma conservadora y esta carencia se abordará en la próxima revisión."
            : "No reliable information on the importer's history of government access requests was available; the assessment proceeds conservatively and this gap will be addressed at the next review.");

  const brk =
    breaches === "none"
      ? (isES
          ? "El importador ha declarado asimismo que no ha sufrido ninguna violación de datos personales que afectara a datos de clientes y exigiera notificación a una autoridad de control; esta declaración queda documentada y se renovará en cada revisión."
          : "The importer has further declared that it has suffered no personal data breach affecting customer data that required notification to a supervisory authority; that declaration is documented here and will be refreshed at each review.")
      : breaches === "some"
        ? (isES
            ? "El importador ha sufrido violaciones de datos personales en el pasado; las partes han tenido en cuenta su gestión, remediación y comunicación de dichos incidentes al evaluar sus prácticas."
            : "The importer has suffered personal data breaches in the past; the parties have taken its handling, remediation and communication of those incidents into account in assessing its practices.")
        : (isES
            ? "No se ha dispuesto de información fiable sobre el historial de violaciones de datos del importador; esta carencia se abordará en la próxima revisión."
            : "No reliable information on the importer's breach history was available; this gap will be addressed at the next review.");

  return {
    tiaEcspStatement: ecsp,
    tiaRequestHistoryStatement: req,
    tiaBreachHistoryStatement: brk,
  };
}

/**
 * Process boilerplate data with variable interpolation.
 * Exported for unit tests (annex showIf filtering); production callers stay in this module.
 */
export function processBoilerplate(
  rawBoilerplate: Record<string, unknown> | null,
  governingLawKey: string,
  variables: Record<string, string>,
  language: string = "en",
  multiJurisdictionKeys?: string[]
): BoilerplateData | null {
  if (!rawBoilerplate) {
    return null;
  }

  const bp = rawBoilerplate as Record<string, unknown>;

  // Helper: resolve i18n then interpolate variables
  const resolve = (val: unknown): string =>
    interpolateText(resolveLocalizedString(val, language), variables);

  // Get jurisdiction-specific provision(s)
  const jpMap = bp.jurisdictionProvisions as Record<string, Record<string, unknown>> | undefined;
  const jp = jpMap?.[governingLawKey];
  const jurisdictionProvision = jp
    ? { title: resolve(jp.title), text: resolve(jp.text) }
    : null;

  // Multi-jurisdiction support: collect provisions for all selected jurisdictions
  let multiJurisdictionProvisions: StandardClause[] | undefined;
  if (multiJurisdictionKeys && multiJurisdictionKeys.length > 0 && jpMap) {
    multiJurisdictionProvisions = multiJurisdictionKeys
      .map((key) => {
        const provision = jpMap[key];
        if (!provision) return null;
        return { title: resolve(provision.title), text: resolve(provision.text) };
      })
      .filter((p): p is StandardClause => p !== null);
  }

  const definitions = (bp.definitions as Array<Record<string, unknown>> || []).map((d) => ({
    term: resolveLocalizedString(d.term, language),
    definition: resolve(d.definition),
  }));

  const standardClauses = (bp.standardClauses as Array<Record<string, unknown>> || []).map((c) => ({
    title: resolveLocalizedString(c.title, language),
    text: resolve(c.text),
    sectionNumber: typeof c.sectionNumber === "number" ? c.sectionNumber : undefined,
    // Authored as a plain string today (a citation rarely translates), but
    // resolved through the same helper so a future localised one just works.
    source: c.source ? resolveLocalizedString(c.source, language) || undefined : undefined,
  }));

  const generalProvisions = (bp.generalProvisions as Array<Record<string, unknown>> || []).map((p) => ({
    title: resolveLocalizedString(p.title, language),
    text: resolve(p.text),
  }));

  // Conditional annexes and sections: an annex (or one of its `sections`)
  // may declare `showIf` — one condition or an array (ANDed) of either
  // `{ variable, in: [...] }` (exact match) or `{ variable, contains: "x" }`
  // (membership in a comma-joined multiselect value) — evaluated against the
  // interpolation variables (which include every deal parameter that
  // declares a boilerplateVariable). Absent showIf keeps the always-render
  // behaviour. Used by the DPA for the SCC/TIA annexes and to compose
  // Annex II from a modest baseline plus individually confirmed measures.
  const conditionsMet = (showIf: unknown): boolean => {
    if (!showIf) return true;
    const conditions = Array.isArray(showIf) ? showIf : [showIf];
    return (
      conditions as Array<{
        variable?: string;
        in?: string[];
        contains?: string;
        present?: boolean;
      }>
    ).every((c) => {
      if (!c.variable) return false;
      const value = variables[c.variable] ?? "";
      if (Array.isArray(c.in)) return c.in.includes(value);
      if (typeof c.contains === "string") {
        return value
          .split(",")
          .map((s) => s.trim())
          .includes(c.contains);
      }
      // `present: true` — render only when a free-text answer exists
      if (c.present === true) return value.trim() !== "";
      return false;
    });
  };

  const annexes = (bp.annexes as Array<Record<string, unknown>> || [])
    .filter((a) => conditionsMet(a.showIf))
    .map((a) => {
      const parts: string[] = [];
      if (a.text) parts.push(resolve(a.text));
      for (const s of (a.sections as Array<Record<string, unknown>> | undefined) ?? []) {
        if (conditionsMet(s.showIf)) parts.push(resolve(s.text));
      }
      return {
        title: resolveLocalizedString(a.title, language),
        text: parts.join("\n\n"),
      };
    });

  const partyLabels = bp.partyLabels as Record<string, unknown> | undefined;

  return {
    contractTitle: resolve(bp.contractTitle) || "",
    preamble: resolve(bp.preamble),
    background: bp.background ? resolve(bp.background) : undefined,
    definitions,
    standardClauses,
    generalProvisions,
    jurisdictionProvision,
    jurisdictionProvisions: multiJurisdictionProvisions,
    annexes: annexes.length > 0 ? annexes : undefined,
    sequentialNumbering: bp.sequentialNumbering === true,
    signatureBlock: resolve(bp.signatureBlock),
    partyLabels: partyLabels
      ? {
          partyA: resolveLocalizedString(partyLabels.partyA, language),
          partyB: resolveLocalizedString(partyLabels.partyB, language),
        }
      : undefined,
  };
}

/**
 * Fetches and compiles deal data into a structured contract format
 */
export async function generateContractData(
  dealRoomId: string
): Promise<ContractData | null> {
  const deal = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    include: {
      contractTemplate: true,
      parties: true,
      signingRequest: true,
      clauses: {
        include: {
          clauseTemplate: {
            include: {
              options: true,
            },
          },
          selections: {
            include: {
              option: true,
            },
          },
        },
        orderBy: {
          clauseTemplate: {
            order: "asc",
          },
        },
      },
    },
  });

  if (!deal) {
    return null;
  }

  const initiator = deal.parties.find((p) => p.role === "INITIATOR");
  const respondent = deal.parties.find((p) => p.role === "RESPONDENT");
  const isSolo = deal.dealMode === "SOLO";

  if (!initiator) {
    return null;
  }
  // respondent is null in solo mode — that's OK
  if (!respondent && !isSolo) {
    return null;
  }

  // Determine contract language
  const language = deal.contractLanguage || "en";
  const dateLocale = language === "es" ? "es-ES" : "en-US";

  // Parameter interpolation setup
  const parameterSchema = deal.contractTemplate.parameterSchema as ParameterSchema | null;
  const dealParams = (deal.parameters as Record<string, string>) || {};

  // A custom law/forum option replaces the jurisdiction-derived governing
  // law (deal.governingLaw then only records which clause library was
  // used). Every rendering of "the governing law" — the cover page, the
  // {governingLaw} boilerplate variable and the body article — must read
  // the parties' free-text choice, or the cover and the governing-law
  // section would name different laws.
  const customLawAgreed = deal.clauses.some(
    (c) =>
      ["governing-law-jurisdiction", "dispute-resolution"].includes(
        c.clauseTemplate.clauseId
      ) &&
      c.status === "AGREED" &&
      !!c.agreedOptionId &&
      ["custom", "custom-law-forum"].includes(
        c.clauseTemplate.options.find((o) => o.id === c.agreedOptionId)?.code ?? ""
      )
  );
  const customGoverningLaw = customLawAgreed
    ? (dealParams["custom-governing-law"] || "").trim()
    : "";

  // Compile clauses with agreed options
  const clauses: ClauseData[] = [];

  // The governing-law / forum clause is negotiated (the builder picks the forum)
  // but rendered as its own top-level article, not under "Negotiated Terms" — so
  // we route it to a dedicated field instead of the clause list. Two shapes:
  //  - DPA `governing-law-jurisdiction`: options already state law + forum.
  //  - MSA/NDA/SaaS `dispute-resolution`: forum-only, so we prepend a governing
  //    law sentence built from the deal's chosen jurisdiction.
  const govLawDisplay =
    GOVERNING_LAW_DISPLAY[deal.governingLaw]?.[language] ||
    GOVERNING_LAW_DISPLAY[deal.governingLaw]?.en ||
    deal.governingLaw;
  const govLawLead =
    language === "es"
      ? `El presente Acuerdo se rige e interpreta de conformidad con la legislación de ${govLawDisplay}. `
      : `This Agreement is governed by and construed in accordance with the laws of ${govLawDisplay}. `;
  let governingLawArticle: { title: string; text: string } | undefined;
  const pushClause = (entry: ClauseData, clauseId: string, optionCode?: string) => {
    if (clauseId === "governing-law-jurisdiction") {
      governingLawArticle = { title: entry.title, text: entry.legalText };
    } else if (clauseId === "dispute-resolution") {
      // The custom law/forum option states its own free-text governing law,
      // so the jurisdiction-derived lead sentence would contradict it.
      const lead = optionCode === "custom-law-forum" ? "" : govLawLead;
      governingLawArticle = { title: entry.title, text: lead + entry.legalText };
    } else {
      clauses.push(entry);
    }
  };

  for (const clause of deal.clauses) {
    if (clause.status !== "AGREED" || !clause.agreedOptionId) {
      continue;
    }

    // Resolve localized clause title and category
    const ctLocalized = clause.clauseTemplate.localizedContent as Record<string, Record<string, string>> | null;
    const clauseTitle = ctLocalized?.title
      ? resolveLocalizedString(ctLocalized.title, language)
      : clause.clauseTemplate.title;
    const clauseCategory = ctLocalized?.category
      ? resolveLocalizedString(ctLocalized.category, language)
      : clause.clauseTemplate.category;

    // Find the agreed option from the clause template options
    const agreedOption = clause.clauseTemplate.options.find(
      (opt) => opt.id === clause.agreedOptionId
    );

    if (!agreedOption) {
      // Fallback: try to find from selection if agreedOptionId doesn't match
      const selection = clause.selections[0];
      if (selection?.option) {
        const selLocalized = selection.option.localizedContent as Record<string, unknown> | null;
        let legalText = selLocalized?.legalText
          ? resolveLocalizedString(selLocalized.legalText, language)
          : selection.option.legalText;

        // Interpolate deal parameters into clause legalText
        legalText = interpolateParameters(
          legalText, dealParams, parameterSchema,
          clause.clauseTemplate.clauseId, language
        );

        // Optional clauses whose agreed option carries no legal text (e.g. a
        // "None — not applicable" choice) are omitted from the document entirely.
        if (legalText && legalText.trim()) {
          pushClause({
            title: clauseTitle,
            category: clauseCategory,
            agreedOption: selLocalized?.label
              ? resolveLocalizedString(selLocalized.label, language)
              : selection.option.label,
            legalText,
            sectionNumber: clause.clauseTemplate.order,
          }, clause.clauseTemplate.clauseId, selection.option.code);
        }
      }
      continue;
    }

    // Resolve localized option fields
    const optLocalized = agreedOption.localizedContent as Record<string, unknown> | null;

    let legalText = optLocalized?.legalText
      ? resolveLocalizedString(optLocalized.legalText, language)
      : agreedOption.legalText;

    // Interpolate deal parameters into clause legalText
    legalText = interpolateParameters(
      legalText, dealParams, parameterSchema,
      clause.clauseTemplate.clauseId, language
    );

    // Optional clauses whose agreed option carries no legal text (e.g. a
    // "None — not applicable" choice) are omitted from the document entirely.
    if (legalText && legalText.trim()) {
      pushClause({
        title: clauseTitle,
        category: clauseCategory,
        agreedOption: optLocalized?.label
          ? resolveLocalizedString(optLocalized.label, language)
          : agreedOption.label,
        legalText,
        sectionNumber: clause.clauseTemplate.order,
      }, clause.clauseTemplate.clauseId, agreedOption.code);
    }
  }

  // Format date for boilerplate
  const effectiveDate = deal.createdAt.toLocaleDateString(dateLocale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Extract signing details
  const sdA = initiator.signingDetails as { legalName?: string; address?: string; taxId?: string; signatoryName?: string; signatoryTitle?: string } | null;
  const sdB = respondent?.signingDetails as { legalName?: string; address?: string; taxId?: string; signatoryName?: string; signatoryTitle?: string } | null;

  // Build party names with signing details → company → name fallback.
  // A login email is never a party or signatory name: a signable document
  // with "alice@example.com" on the signature line reads as an assembly
  // artifact, so emails fall through to the fill-in placeholder instead.
  const namePlaceholder = "[_________________]";
  const nonEmail = (v?: string | null) => (v && !v.includes("@") ? v : undefined);
  const partyAName =
    sdA?.legalName || initiator.company || nonEmail(initiator.name) || namePlaceholder;
  const partyBName = respondent
    ? sdB?.legalName || respondent.company || nonEmail(respondent.name) || namePlaceholder
    : namePlaceholder;

  const partyAAddress = sdA?.address || "[Address]";
  const partyBAddress = respondent ? (sdB?.address || "[Address]") : namePlaceholder;
  const partyASignatoryName = sdA?.signatoryName || nonEmail(initiator.name) || namePlaceholder;
  const partyBSignatoryName = respondent
    ? sdB?.signatoryName || nonEmail(respondent.name) || namePlaceholder
    : namePlaceholder;
  const partyASignatoryTitle = sdA?.signatoryTitle || "[_________________]";
  const partyBSignatoryTitle = respondent ? (sdB?.signatoryTitle || "[_________________]") : "[_________________]";

  // Variables for boilerplate interpolation
  const variables: Record<string, string> = {
    effectiveDate,
    governingLaw:
      customGoverningLaw ||
      GOVERNING_LAW_DISPLAY[deal.governingLaw]?.[language] ||
      GOVERNING_LAW_DISPLAY[deal.governingLaw]?.en ||
      deal.governingLaw,
    partyAName,
    partyBName,
    partyAAddress,
    partyBAddress,
    partyAId: sdA?.taxId || "",
    partyBId: sdB?.taxId || "",
    partyAShortName: "Party A",
    partyBShortName: "Party B",
    partyASignatureBlock: `For and on behalf of ${partyAName}:\n\nSignature: _______________________________\n\nName: ${partyASignatoryName}\n\nTitle: ${partyASignatoryTitle}\n\nDate: ___________________________________`,
    partyBSignatureBlock: `For and on behalf of ${partyBName}:\n\nSignature: _______________________________\n\nName: ${partyBSignatoryName}\n\nTitle: ${partyBSignatoryTitle}\n\nDate: ___________________________________`,
  };

  // Merge deal parameter boilerplate variables into the variables dict
  const paramBoilerplateVars = buildBoilerplateVariables(dealParams, parameterSchema);
  Object.assign(variables, paramBoilerplateVars);

  // DPA Annex I data categories: turn the selected canonical keys into a
  // localized, lettered list, appending any free-text "other" entries. This
  // overrides the raw comma value that buildBoilerplateVariables produced for
  // {dataCategoriesList}.
  const dcParam = parameterSchema?.parameters?.find((p) => p.id === "data-categories");
  if (dcParam) {
    const keys = (dealParams["data-categories"] || "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const labels = keys.map((k) =>
      dcParam.optionLabels?.[k]
        ? resolveLocalizedString(dcParam.optionLabels[k], language)
        : k
    );
    const other = (dealParams["data-categories-other"] || "").trim();
    if (other) {
      labels.push(...other.split(";").map((s) => s.trim()).filter(Boolean));
    }
    const letters = "abcdefghijklmnopqrstuvwxyz";
    variables.dataCategoriesList = labels.length
      ? labels.map((l, i) => `(${letters[i] || i + 1}) ${l};`).join("\n")
      : (language === "es"
          ? "(según se describa con más detalle en el Acuerdo Principal)"
          : "(as further described in the Principal Agreement)");
  }

  // Annex II inherited-controls attribution: only measures BOTH confirmed
  // and marked inherited count — an inherited claim over an unconfirmed
  // control would attribute a measure the document never asserts. Override
  // {tomsInherited} with the intersection so the section's presence
  // condition reflects it, then build the lettered list from the confirmed
  // controls' full labels.
  const tomsParam = parameterSchema?.parameters?.find((p) => p.id === "toms-confirmed");
  const confirmedToms = (dealParams["toms-confirmed"] || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const inheritedToms = (dealParams["toms-inherited"] || "")
    .split(",").map((s) => s.trim()).filter(Boolean)
    .filter((k) => confirmedToms.includes(k));
  variables.tomsInherited = inheritedToms.join(",");
  if (inheritedToms.length && tomsParam) {
    const itLetters = "abcdefghijklmnopqrstuvwxyz";
    variables.tomsInheritedList = inheritedToms
      .map((k, i) =>
        `(${itLetters[i] || i + 1}) ${
          tomsParam.optionLabels?.[k]
            ? resolveLocalizedString(tomsParam.optionLabels[k], language)
            : k
        };`
      )
      .join("\n");
  }

  // DPA international transfers (Annex III/IV). Derived variables for the
  // SCC-incorporation and Transfer Impact Assessment annexes:
  //  - {processorEstablishmentDisplay}: localized wording for the recorded
  //    place of establishment.
  //  - {dpfStatement}: the operative transfer-mechanism paragraph —
  //    DPF-adequacy-primary with SCC fallback when the parties recorded an
  //    active Data Privacy Framework certification, SCC-primary otherwise.
  //  - {tiaSafeguardsList}: lettered localized list of the supplementary
  //    measures selected in the TIA builder.
  //  - {tiaConclusion}: EDPB-aligned conclusion. Contractual/organizational
  //    measures alone cannot support an unqualified essential-equivalence
  //    finding (Recommendations 01/2020, Annex 2) — without at least one
  //    technical measure the conclusion documents residual risk instead.
  const establishment = (dealParams["processor-establishment"] || "").trim();
  if (establishment) {
    const isES = language === "es";
    const estDisplay: Record<string, { en: string; es: string }> = {
      EEA: { en: "the European Economic Area", es: "el Espacio Económico Europeo" },
      UK: { en: "the United Kingdom", es: "el Reino Unido" },
      US: { en: "the United States of America", es: "los Estados Unidos de América" },
      OTHER: { en: "a third country outside the EEA", es: "un tercer país fuera del EEE" },
    };
    variables.processorEstablishmentDisplay =
      (estDisplay[establishment] ?? estDisplay.OTHER)[isES ? "es" : "en"];

    const dpfCertified = (dealParams["processor-dpf-certified"] || "") === "yes";
    variables.dpfStatement = dpfCertified
      ? (isES
          ? "El Encargado ha declarado que mantiene una certificación activa en el Marco de Privacidad de Datos UE-EE.UU. (EU-U.S. Data Privacy Framework, «DPF»; registro verificable en dataprivacyframework.gov). Mientras dicha certificación permanezca activa y cubra las categorías de datos tratadas, las transferencias se amparan en la decisión de adecuación de la Comisión Europea de 10 de julio de 2023. Las Cláusulas Contractuales Tipo incorporadas en este Anexo se pactan como mecanismo subsidiario y surtirán efectos automáticamente si la certificación caduca, se retira o la decisión de adecuación deja de ser válida."
          : "The Processor has declared that it maintains an active certification under the EU-U.S. Data Privacy Framework (\"DPF\"; verifiable at dataprivacyframework.gov). For so long as that certification remains active and covers the categories of data processed, transfers rely on the European Commission's adequacy decision of 10 July 2023. The Standard Contractual Clauses incorporated in this Annex are agreed as a fallback mechanism and shall take effect automatically if the certification lapses, is withdrawn, or the adequacy decision ceases to be valid.")
      : (isES
          ? "El Encargado no ha declarado una certificación activa en el Marco de Privacidad de Datos UE-EE.UU. En consecuencia, las Cláusulas Contractuales Tipo incorporadas en este Anexo constituyen el mecanismo de transferencia aplicable con arreglo al artículo 46, apartado 2, letra c), del RGPD."
          : "The Processor has not declared an active certification under the EU-U.S. Data Privacy Framework. Accordingly, the Standard Contractual Clauses incorporated in this Annex constitute the applicable transfer mechanism under Article 46(2)(c) GDPR.");

    const sgParam = parameterSchema?.parameters?.find((p) => p.id === "tia-safeguards");
    // Contractual supplementary measures are representations about the DPA's
    // own content, so they are DERIVED from the agreed government-access
    // clause rather than read from wizard checkboxes: a checked box without
    // the clause would make Annex IV assert commitments the document doesn't
    // contain. Technical/organizational selections pass through as answered.
    const sgKeys = (dealParams["tia-safeguards"] || "")
      .split(",").map((s) => s.trim()).filter(Boolean)
      .filter((k) => !k.startsWith("contract-"));
    const govClause = deal.clauses.find(
      (c) =>
        c.clauseTemplate.clauseId === "government-access-requests" &&
        c.status === "AGREED" &&
        c.agreedOptionId
    );
    const govCommitments =
      govClause?.clauseTemplate.options.find((o) => o.id === govClause.agreedOptionId)
        ?.code === "commitments";
    if (sgParam) {
      const sgLabels = sgKeys.map((k) =>
        sgParam.optionLabels?.[k]
          ? resolveLocalizedString(sgParam.optionLabels[k], language)
          : k
      );
      if (govCommitments) {
        sgLabels.push(
          isES
            ? "Contractual — compromisos sobre solicitudes de acceso gubernamentales recogidos en la cláusula «Solicitudes de acceso gubernamentales» de este ATD (notificación e impugnación, divulgación mínima, documentación e informes agregados de transparencia; garantía de ausencia de puertas traseras y de órdenes de acceso masivo recibidas)"
            : "Contractual — government-access commitments under the \"Government access requests\" clause of this DPA (notification and challenge, minimum disclosure, documentation and aggregate transparency reporting; warranty of no back doors and no bulk-access orders received)"
        );
      }
      const letters = "abcdefghijklmnopqrstuvwxyz";
      variables.tiaSafeguardsList = sgLabels.length
        ? sgLabels.map((l, i) => `(${letters[i] || i + 1}) ${l};`).join("\n")
        : (isES
            ? "(no se han seleccionado medidas suplementarias específicas)"
            : "(no specific supplementary measures selected)");
    }
    // EEA data residency is a statement about where processing happens, so
    // when claimed it must surface in the processing description (Annex I §2
    // and Annex IV §1), not only as a TIA bullet.
    if (sgKeys.includes("tech-eu-residency") && variables.processingPurpose) {
      variables.processingPurpose +=
        (isES
          ? "\nTodo el almacenamiento y tratamiento de los Datos Personales se realiza en regiones de centros de datos situadas en el EEE."
          : "\nAll storage and processing of the Personal Data takes place in data-center regions located within the EEA.");
    }
    const hasTechnicalMeasure = sgKeys.some((k) => k.startsWith("tech-"));
    variables.tiaConclusion = hasTechnicalMeasure
      ? (isES
          ? "Teniendo en cuenta las circunstancias de la transferencia, la legislación y la práctica del país de destino y las medidas suplementarias adoptadas (incluidas medidas técnicas), las partes concluyen que los datos personales transferidos gozarán de un nivel de protección esencialmente equivalente al garantizado en el EEE. Esta evaluación se revisará al menos cada doce (12) meses y ante cualquier cambio relevante de derecho o de práctica, y la transferencia se suspenderá si dicho nivel dejara de estar garantizado."
          : "Having regard to the circumstances of the transfer, the law and practice of the destination country and the supplementary measures adopted (including technical measures), the parties conclude that the personal data transferred will enjoy a level of protection essentially equivalent to that guaranteed within the EEA. This assessment will be reviewed at least every twelve (12) months and upon any material change of law or practice, and the transfer will be suspended if that level of protection can no longer be ensured.")
      : (isES
          ? "Las partes hacen constar que las medidas suplementarias adoptadas son de carácter contractual y organizativo. Conforme a las Recomendaciones 01/2020 del CEPD, tales medidas no bastan por sí solas para impedir el acceso de las autoridades públicas del país de destino. Las partes documentan el riesgo residual correspondiente, se comprometen a evaluar la adopción de medidas técnicas adicionales y revisarán esta evaluación al menos cada doce (12) meses, suspendiendo la transferencia si el riesgo dejara de ser aceptable."
          : "The parties record that the supplementary measures adopted are contractual and organizational in nature. In line with EDPB Recommendations 01/2020, such measures cannot by themselves prevent access by public authorities of the destination country. The parties document the corresponding residual risk, undertake to evaluate the adoption of additional technical measures, and will review this assessment at least every twelve (12) months, suspending the transfer should the risk cease to be acceptable.");

    variables.transferAddendaSections = buildTransferAddendaSections(dealParams, language);
    Object.assign(variables, buildTiaImporterStatements(dealParams, language));
  }

  // Asymmetric-role contract (DPA: Controller vs Processor; BAA: Business
  // Associate vs Covered Entity): Party A is the first-declared role slot by
  // boilerplate convention (DPA → Controller; BAA → Business Associate/Company).
  // When the initiator / filling party chose the OTHER role (the Party-B role:
  // Processor or Covered Entity), swap the A/B boilerplate variables so the
  // preamble, signature blocks and cover all place them under their chosen role
  // and the counterparty under the opposite. The variable swap is identical for
  // solo and two-party; the party-object swap below differs (solo blanks the
  // absent role, two-party exchanges the two real parties).
  // A Party-A-role or undefined keeps the historical behaviour, so symmetric
  // deals are untouched. Source of truth is the deal's soloFillRole column (set
  // at creation, editable at signing); fall back to the legacy per-party
  // signingDetails.fillRole for deals created before the column existed.
  const fillRole =
    deal.soloFillRole ?? (sdA as { fillRole?: string } | null)?.fillRole;
  const swapRoles = roleRequiresSwap(fillRole);
  if (swapRoles) {
    for (const [a, b] of [
      ["partyAName", "partyBName"],
      ["partyAAddress", "partyBAddress"],
      ["partyAId", "partyBId"],
      ["partyASignatureBlock", "partyBSignatureBlock"],
    ]) {
      const tmp = variables[a];
      variables[a] = variables[b];
      variables[b] = tmp;
    }
  }

  // Cover-page party names follow the same A/B slots as the boilerplate text,
  // including the solo Processor swap above — so a processor's details show
  // under "Processor", not "Controller", on the cover.
  const coverPartyAName = variables.partyAName;
  const coverPartyBName = variables.partyBName;

  // Check for multi-jurisdiction parameters (e.g., Privacy Notice)
  const multiJurisdictionKeys = dealParams.jurisdictions
    ? dealParams.jurisdictions.split(",").map((j: string) => j.trim()).filter(Boolean)
    : undefined;

  // Process boilerplate with variable interpolation and i18n
  const boilerplate = processBoilerplate(
    deal.contractTemplate.boilerplate as Record<string, unknown> | null,
    deal.governingLaw,
    variables,
    language,
    multiJurisdictionKeys
  );

  // Check for agent deal attestation
  const agentDeal = await prisma.agentDealRoom.findFirst({
    where: { dealRoomId },
  });

  let agentAttestation: ContractData["agentAttestation"];
  if (agentDeal) {
    const uetaPreamble = `This agreement was formed by the interaction of electronic agents of the parties pursuant to the Uniform Electronic Transactions Act § 14 and the Electronic Signatures in Global and National Commerce Act (15 U.S.C. § 7001 et seq.). Each party authorized its electronic agent to negotiate and accept the terms herein.`;

    if (agentDeal.attestingBarNumber && agentDeal.attestingAttorneyName) {
      agentAttestation = {
        attorneyName: agentDeal.attestingAttorneyName,
        barNumber: agentDeal.attestingBarNumber,
        uetaPreamble,
        attestationFooter: `The legal provisions in this contract have been reviewed and attested by ${agentDeal.attestingAttorneyName} (Bar No. ${agentDeal.attestingBarNumber}) pursuant to UETA § 14 and the federal E-SIGN Act.`,
      };
    } else {
      // Still include UETA preamble for agent deals even without attorney attestation
      agentAttestation = {
        attorneyName: "",
        barNumber: "",
        uetaPreamble,
        attestationFooter: "",
      };
    }
  }

  // Build the party objects, then apply the role swap to the objects
  // themselves (not just the boilerplate variables) so EVERY renderer — cover,
  // parties section, and signature blocks in PDF/DOCX/TXT — shows each party
  // under the role they chose.
  let outPartyA: PartyData = {
    name: initiator.name || initiator.email,
    email: initiator.email,
    company: initiator.company || undefined,
    legalName: sdA?.legalName,
    address: sdA?.address,
    taxId: sdA?.taxId,
    signatoryName: sdA?.signatoryName,
    signatoryTitle: sdA?.signatoryTitle,
    signature: deal.signingRequest?.initiatorSignature || undefined,
    signedAt: deal.signingRequest?.initiatorSignedAt || undefined,
  };
  let outPartyB: PartyData | null = respondent
    ? {
        name: respondent.name || respondent.email,
        email: respondent.email,
        company: respondent.company || undefined,
        legalName: sdB?.legalName,
        address: sdB?.address,
        taxId: sdB?.taxId,
        signatoryName: sdB?.signatoryName,
        signatoryTitle: sdB?.signatoryTitle,
        signature: deal.signingRequest?.respondentSignature || undefined,
        signedAt: deal.signingRequest?.respondentSignedAt || undefined,
      }
    : null;

  if (swapRoles) {
    if (isSolo || !outPartyB) {
      outPartyB = outPartyA; // filling party → Party-B role slot
      outPartyA = { name: "[_________________]", email: "" }; // Party-A role slot left blank
    } else {
      // Two-party: a true swap so the initiator lands in the Party-B role slot
      // and the respondent in the Party-A role slot — each keeps their signature.
      const tmp = outPartyA;
      outPartyA = outPartyB;
      outPartyB = tmp;
    }
  }

  return {
    dealName: deal.name,
    contractType: deal.contractTemplate.displayName,
    governingLaw:
      customGoverningLaw ||
      GOVERNING_LAW_DISPLAY[deal.governingLaw]?.[language] ||
      GOVERNING_LAW_DISPLAY[deal.governingLaw]?.en ||
      deal.governingLaw,
    governingLawKey: deal.governingLaw,
    createdAt: deal.createdAt,
    partyA: outPartyA,
    partyB: outPartyB,
    clauses,
    governingLawArticle,
    coverPartyAName,
    coverPartyBName,
    boilerplate,
    language,
    agentAttestation,
  };
}

/**
 * Validates that a user is a party to the deal
 */
export async function validateDealAccess(
  dealRoomId: string,
  userId: string
): Promise<boolean> {
  const party = await prisma.dealRoomParty.findFirst({
    where: {
      dealRoomId,
      userId,
    },
  });

  return party !== null;
}

/**
 * Checks if the deal is in a signable state
 */
export async function isDealSignable(dealRoomId: string): Promise<boolean> {
  const deal = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    select: { status: true },
  });

  if (!deal) {
    return false;
  }

  return ["AGREED", "SIGNING", "COMPLETED"].includes(deal.status);
}

/**
 * Enrich ContractData with certification data from the signing request.
 * If no certification exists, returns data unchanged.
 */
export async function enrichWithCertification(
  dealRoomId: string,
  data: ContractData
): Promise<ContractData> {
  try {
    const signingRequest = await prisma.signingRequest.findFirst({
      where: { dealRoomId },
      orderBy: { createdAt: "desc" },
    });

    if (!signingRequest?.ceremonyId) {
      return data;
    }

    const certData = await certificationService.buildCertificationData(
      signingRequest.ceremonyId
    );

    if (!certData.certified) {
      return data;
    }

    return { ...data, certification: certData };
  } catch (error) {
    logger.error("Failed to enrich with certification", { err: String(error) });
    return data;
  }
}

/**
 * Human-readable filename for a generated contract document.
 * Format: Dealroom-{ContractType}-{DealName}-{YYYY-MM-DD}.{ext}
 * Preserves readable case, collapses spaces + unsafe chars to single hyphens.
 */
export function buildContractFilename(data: ContractData, ext: "pdf" | "docx" | "txt"): string {
  const slug = (s: string) =>
    s
      .trim()
      .replace(/[\/\\?%*:|"<>]/g, "")
      .replace(/[^\p{L}\p{N}\-]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

  const date = new Date().toISOString().slice(0, 10);
  const parts = ["Dealroom", slug(data.contractType), slug(data.dealName), date].filter(Boolean);
  return `${parts.join("-")}.${ext}`;
}
