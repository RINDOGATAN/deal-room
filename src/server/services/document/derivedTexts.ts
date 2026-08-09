// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Generator-authored legal texts, as data.
 *
 * These are the passages the generator derives from deal facts rather than
 * reading from the skill JSON (DPF mechanism paragraph, TIA conclusion,
 * establishment display names, list fallbacks…). Kept here as a single
 * exportable constant so (a) generator.ts stays logic-only, and (b) the
 * contract-pack exporter can publish the exact texts to sibling apps
 * (DPO Central) without hand-copying. Every entry is bilingual; the
 * generator picks `.es` when the contract language is Spanish, `.en`
 * otherwise.
 */

export interface Bilingual {
  en: string;
  es: string;
}

export const DERIVED_TEXTS = {
  /** {processorEstablishmentDisplay} — localized establishment wording. */
  establishmentDisplay: {
    EEA: { en: "the European Economic Area", es: "el Espacio Económico Europeo" },
    UK: { en: "the United Kingdom", es: "el Reino Unido" },
    US: { en: "the United States of America", es: "los Estados Unidos de América" },
    OTHER: { en: "a third country outside the EEA", es: "un tercer país fuera del EEE" },
  } as Record<string, Bilingual>,

  /** {dpfStatement} — transfer-mechanism paragraph, keyed by whether the
   *  processor declared an active DPF certification. */
  dpfStatement: {
    certified: {
      es: "El Encargado ha declarado que mantiene una certificación activa en el Marco de Privacidad de Datos UE-EE.UU. (EU-U.S. Data Privacy Framework, «DPF»; registro verificable en dataprivacyframework.gov). Mientras dicha certificación permanezca activa y cubra las categorías de datos tratadas, las transferencias se amparan en la decisión de adecuación de la Comisión Europea de 10 de julio de 2023. Las Cláusulas Contractuales Tipo incorporadas en este Anexo se pactan como mecanismo subsidiario y surtirán efectos automáticamente si la certificación caduca, se retira o la decisión de adecuación deja de ser válida.",
      en: "The Processor has declared that it maintains an active certification under the EU-U.S. Data Privacy Framework (\"DPF\"; verifiable at dataprivacyframework.gov). For so long as that certification remains active and covers the categories of data processed, transfers rely on the European Commission's adequacy decision of 10 July 2023. The Standard Contractual Clauses incorporated in this Annex are agreed as a fallback mechanism and shall take effect automatically if the certification lapses, is withdrawn, or the adequacy decision ceases to be valid.",
    },
    notCertified: {
      es: "El Encargado no ha declarado una certificación activa en el Marco de Privacidad de Datos UE-EE.UU. En consecuencia, las Cláusulas Contractuales Tipo incorporadas en este Anexo constituyen el mecanismo de transferencia aplicable con arreglo al artículo 46, apartado 2, letra c), del RGPD.",
      en: "The Processor has not declared an active certification under the EU-U.S. Data Privacy Framework. Accordingly, the Standard Contractual Clauses incorporated in this Annex constitute the applicable transfer mechanism under Article 46(2)(c) GDPR.",
    },
  },

  /** {tiaConclusion} — EDPB rule: unqualified essential equivalence ONLY
   *  when at least one technical (tech-*) measure is selected. */
  tiaConclusion: {
    withTechnicalMeasure: {
      es: "Teniendo en cuenta las circunstancias de la transferencia, la legislación y la práctica del país de destino y las medidas suplementarias adoptadas (incluidas medidas técnicas), las partes concluyen que los datos personales transferidos gozarán de un nivel de protección esencialmente equivalente al garantizado en el EEE. Esta evaluación se revisará al menos cada doce (12) meses y ante cualquier cambio relevante de derecho o de práctica, y la transferencia se suspenderá si dicho nivel dejara de estar garantizado.",
      en: "Having regard to the circumstances of the transfer, the law and practice of the destination country and the supplementary measures adopted (including technical measures), the parties conclude that the personal data transferred will enjoy a level of protection essentially equivalent to that guaranteed within the EEA. This assessment will be reviewed at least every twelve (12) months and upon any material change of law or practice, and the transfer will be suspended if that level of protection can no longer be ensured.",
    },
    residualRisk: {
      es: "Las partes hacen constar que las medidas suplementarias adoptadas son de carácter contractual y organizativo. Conforme a las Recomendaciones 01/2020 del CEPD, tales medidas no bastan por sí solas para impedir el acceso de las autoridades públicas del país de destino. Las partes documentan el riesgo residual correspondiente, se comprometen a evaluar la adopción de medidas técnicas adicionales y revisarán esta evaluación al menos cada doce (12) meses, suspendiendo la transferencia si el riesgo dejara de ser aceptable.",
      en: "The parties record that the supplementary measures adopted are contractual and organizational in nature. In line with EDPB Recommendations 01/2020, such measures cannot by themselves prevent access by public authorities of the destination country. The parties document the corresponding residual risk, undertake to evaluate the adoption of additional technical measures, and will review this assessment at least every twelve (12) months, suspending the transfer should the risk cease to be acceptable.",
    },
  },

  /** Appended to {tiaSafeguardsList} when the government-access-requests
   *  clause is agreed with full commitments — the only way contractual
   *  measures enter the TIA. */
  govAccessDerivedMeasure: {
    es: "Contractual — compromisos sobre solicitudes de acceso gubernamentales recogidos en la cláusula «Solicitudes de acceso gubernamentales» de este ATD (notificación e impugnación, divulgación mínima, documentación e informes agregados de transparencia; garantía de ausencia de puertas traseras y de órdenes de acceso masivo recibidas)",
    en: "Contractual — government-access commitments under the \"Government access requests\" clause of this DPA (notification and challenge, minimum disclosure, documentation and aggregate transparency reporting; warranty of no back doors and no bulk-access orders received)",
  } as Bilingual,

  /** {tiaSafeguardsList} fallback when no measures are selected. */
  safeguardsEmpty: {
    es: "(no se han seleccionado medidas suplementarias específicas)",
    en: "(no specific supplementary measures selected)",
  } as Bilingual,

  /** Appended to {processingPurpose} when tech-eu-residency is claimed —
   *  a residency claim must surface in Annex I, not only as a TIA bullet. */
  euResidencyNote: {
    es: "\nTodo el almacenamiento y tratamiento de los Datos Personales se realiza en regiones de centros de datos situadas en el EEE.",
    en: "\nAll storage and processing of the Personal Data takes place in data-center regions located within the EEA.",
  } as Bilingual,

  /** {dataCategoriesList} fallback when no categories were recorded. */
  dataCategoriesFallback: {
    es: "(según se describa con más detalle en el Acuerdo Principal)",
    en: "(as further described in the Principal Agreement)",
  } as Bilingual,
} as const;

export function pick(t: Bilingual, language: string): string {
  return language === "es" ? t.es : t.en;
}
