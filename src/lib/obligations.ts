// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Obligations ledger — the recurring and event-driven duties a signed
 * document newly creates, derived from the deal's agreed option codes and
 * parameters (the same fact model the generator draws from). Pure and
 * isomorphic; rendered as a card on the deal page so parties see what they
 * signed up to operationally, not only what the prose says.
 *
 * DPA-only in v1; other contract types return an empty ledger.
 */

export type ObligationFrequency =
  | "annual"
  | "quarterly"
  | "monthly"
  | "twelveMonthly"
  | "event"
  | "continuous";

export interface Obligation {
  id: string;
  text: string; // localized duty description
  frequency: ObligationFrequency;
}

interface LedgerInput {
  contractType?: string | null;
  parameters?: Record<string, string> | null;
  /** Agreed clauses as (clauseId, agreed option code) pairs. */
  agreed: Array<{ clauseId: string; code: string }>;
  lang?: string;
}

export function buildObligationsLedger({
  contractType,
  parameters,
  agreed,
  lang = "en",
}: LedgerInput): Obligation[] {
  if (contractType !== "DPA") return [];
  const isES = lang === "es";
  const p = parameters ?? {};
  const codeOf = (clauseId: string) =>
    agreed.find((a) => a.clauseId === clauseId)?.code;
  const split = (v?: string) =>
    (v || "").split(",").map((s) => s.trim()).filter(Boolean);
  const toms = split(p["toms-confirmed"]);
  const out: Obligation[] = [];
  const add = (id: string, frequency: ObligationFrequency, en: string, es: string) =>
    out.push({ id, frequency, text: isES ? es : en });

  // Government access requests clause (full commitments)
  if (codeOf("government-access-requests") === "commitments") {
    add(
      "gov-notify",
      "event",
      "Notify the Controller of any government access request (or seek a gag-order waiver), review its legality and challenge where grounded",
      "Notificar al Responsable cualquier solicitud gubernamental de acceso (o intentar levantar la prohibición), revisar su legalidad e impugnarla cuando proceda"
    );
    add(
      "gov-transparency",
      "annual",
      "Publish or provide aggregate transparency information on government requests",
      "Publicar o facilitar información agregada de transparencia sobre solicitudes gubernamentales"
    );
  }

  // Transfer Impact Assessment review (third-country processors)
  const establishment = (p["processor-establishment"] || "").trim();
  if (
    (establishment === "US" || establishment === "OTHER") &&
    (p["include-tia"] || "yes").trim() !== "no"
  ) {
    add(
      "tia-review",
      "twelveMonthly",
      "Re-evaluate the Transfer Impact Assessment (and on any material change of law, practice or sub-processors)",
      "Reevaluar la Evaluación de Impacto de las Transferencias (y ante cualquier cambio relevante de derecho, práctica o subencargados)"
    );
  }

  // Confirmed TOMs carry their own cadences
  if (toms.includes("toms-access-reviews")) {
    add("toms-access", "quarterly", "Review access rights", "Revisar los derechos de acceso");
  }
  if (toms.includes("toms-network")) {
    add("toms-scans", "monthly", "Run vulnerability scans", "Realizar análisis de vulnerabilidades");
    add("toms-pentest", "annual", "Run a penetration test", "Realizar una prueba de penetración");
  }
  if (toms.includes("toms-logging")) {
    add(
      "toms-logs",
      "continuous",
      "Retain tamper-protected access logs for 12 months with alerting",
      "Conservar registros de acceso a prueba de manipulación durante 12 meses, con alertas"
    );
  }
  if (toms.includes("toms-backup-dr")) {
    add("toms-restore", "annual", "Test backup restoration", "Probar la restauración de copias de seguridad");
  }
  if (toms.includes("toms-testing")) {
    add(
      "toms-testing",
      "annual",
      "Test and evaluate the effectiveness of the security measures",
      "Probar y evaluar la eficacia de las medidas de seguridad"
    );
  }
  if (
    (p["toms-physical"] || "provider-managed").trim() === "provider-managed" ||
    split(p["toms-inherited"]).length > 0
  ) {
    add(
      "provider-audit",
      "annual",
      "Review the infrastructure providers' independent audit reports (SOC 2 / ISO 27001)",
      "Revisar los informes de auditoría independientes de los proveedores de infraestructura (SOC 2 / ISO 27001)"
    );
  }

  // Breach notification window
  const breach = codeOf("breach-notification");
  if (breach) {
    const window =
      breach === "24h" ? "24" : breach === "48h" ? "48" : breach === "72h" ? "72" : null;
    add(
      "breach-notify",
      "event",
      window
        ? `Notify the Controller of a personal data breach within ${window} hours — unconditional on internal triage`
        : "Notify the Controller of a personal data breach without undue delay — unconditional on internal triage",
      window
        ? `Notificar al Responsable una violación de datos personales en un plazo de ${window} horas — sin condicionarlo a la evaluación interna`
        : "Notificar al Responsable una violación de datos personales sin dilación indebida — sin condicionarlo a la evaluación interna"
    );
  }

  // Sub-processor regime
  const sub = codeOf("subprocessor-approval");
  if (sub) {
    const notice = sub === "general-30d" ? "30" : sub === "general-14d" ? "14" : null;
    add(
      "subproc",
      "event",
      sub === "specific"
        ? "Request specific written authorization before engaging any new sub-processor"
        : notice
          ? `Maintain the sub-processor list and give ${notice} days' advance notice of changes`
          : "Maintain the sub-processor list and notify the Controller of changes",
      sub === "specific"
        ? "Solicitar autorización previa específica por escrito antes de contratar cualquier nuevo subencargado"
        : notice
          ? `Mantener la lista de subencargados y preavisar los cambios con ${notice} días`
          : "Mantener la lista de subencargados y notificar los cambios al Responsable"
    );
  }

  // Periodic audit deliverables (deliberate opt-ins via the audit clause)
  const audit = codeOf("audit-rights");
  if (audit === "hybrid") {
    add(
      "audit-report",
      "annual",
      "Provide the annual compliance report",
      "Facilitar el informe anual de cumplimiento"
    );
  } else if (audit === "reports-only") {
    add(
      "audit-summary",
      "annual",
      "Make the audit-report summary available on request (max once per year)",
      "Poner a disposición el resumen de informes de auditoría a solicitud (máximo una vez al año)"
    );
  }

  return out;
}
