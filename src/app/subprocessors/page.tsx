// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { brand } from "@/config/brand";

/**
 * The providers that process personal data for the hosted Dealroom, as the
 * code uses them (hosting, database, e-mail, payments, sign-in, AI, analytics).
 * DRAFT for the owner's review (11 Oct 2026): square brackets mark what our
 * own records do not yet establish. Keep this list in step with the code:
 * a new outbound service is a new row here and in the privacy policy.
 */

type Row = { role: string; provider: string; location: string; when?: string };

const COPY = {
  en: {
    title: "Sub-processors",
    intro:
      "These are the providers that process personal data for the hosted Dealroom at dealroom.todo.law, what each one does and where. Rindogatan LLC operates Dealroom. Our privacy policy explains what we collect and why; this page lists who helps us run the service.",
    headRole: "What it does",
    headProvider: "Provider",
    headLocation: "Location",
    rows: [
      {
        role: "Hosting: serves the application and runs its server functions",
        provider: "Vercel",
        location: "United States (iad1 region)",
      },
      {
        role: "Database: stores accounts, deals, contract text and negotiation history",
        provider: "Neon",
        location: "[region to be confirmed by the owner]",
      },
      {
        role: "E-mail: sends sign-in links and deal notices",
        provider: "Resend",
        location: "United States",
      },
      {
        role: "Payments: charges for contracts and credits; keeps the card details",
        provider: "Stripe",
        location: "United States and other countries",
        when: "Partly an independent controller for its own legal duties.",
      },
      {
        role: "Sign in with Google",
        provider: "Google",
        location: "United States and other countries",
        when: "Only if the user chooses it.",
      },
      {
        role: "AI model provider, reached through the service's AI gateway: drafts and suggestions from the clauses being negotiated",
        provider: "[AI gateway provider: name to be confirmed by the owner]",
        location: "[location to be confirmed with the provider]",
        when: "Only when AI assistance is switched on.",
      },
      {
        role: "Web analytics: counts visits to our pages without setting cookies; receives the IP address of each page request, and we use only aggregated figures",
        provider: "Sealmetrics",
        location: "Ireland, European Union",
      },
    ] as Row[],
    transfers:
      "Where a provider is in the United States or may be accessed from there, the transfer relies on the EU-US Data Privacy Framework where the provider is certified to it and otherwise on the standard contractual clauses approved by the European Commission.",
    changes: "We update this page before we add or replace a provider.",
    privacy: "Privacy Policy",
    updated: "Last updated: [date of publication]",
  },
  es: {
    title: "Subencargados",
    intro:
      "Estos son los proveedores que tratan datos personales para el Dealroom alojado en dealroom.todo.law, qué hace cada uno y dónde. Rindogatan LLC presta el servicio de Dealroom. Nuestra política de privacidad explica qué datos recogemos y para qué; esta página indica quién nos ayuda a prestar el servicio.",
    headRole: "Qué hace",
    headProvider: "Proveedor",
    headLocation: "Ubicación",
    rows: [
      {
        role: "Alojamiento: sirve la aplicación y ejecuta sus funciones de servidor",
        provider: "Vercel",
        location: "Estados Unidos (región iad1)",
      },
      {
        role: "Base de datos: guarda las cuentas, las negociaciones, el texto de los contratos y su historial",
        provider: "Neon",
        location: "[región por confirmar por el propietario]",
      },
      {
        role: "Correo electrónico: envía los enlaces de acceso y los avisos de las negociaciones",
        provider: "Resend",
        location: "Estados Unidos",
      },
      {
        role: "Pagos: cobra los contratos y los créditos; conserva los datos de la tarjeta",
        provider: "Stripe",
        location: "Estados Unidos y otros países",
        when: "En parte, responsable independiente para sus propias obligaciones legales.",
      },
      {
        role: "Inicio de sesión con Google",
        provider: "Google",
        location: "Estados Unidos y otros países",
        when: "Solo si la persona usuaria lo elige.",
      },
      {
        role: "Proveedor de modelos de IA, al que se llega a través de la pasarela de IA del servicio: genera borradores y sugerencias a partir de las cláusulas que se negocian",
        provider: "[proveedor de la pasarela de IA: nombre por confirmar por el propietario]",
        location: "[ubicación por confirmar con el proveedor]",
        when: "Solo cuando la asistencia de IA está activada.",
      },
      {
        role: "Analítica web: cuenta las visitas a nuestras páginas sin instalar cookies; recibe la dirección IP de cada petición de página y solo usamos cifras agregadas",
        provider: "Sealmetrics",
        location: "Irlanda, Unión Europea",
      },
    ] as Row[],
    transfers:
      "Cuando un proveedor está en Estados Unidos o se puede acceder a los datos desde allí, la transferencia se ampara en el Marco de Privacidad de Datos UE-EE. UU. si el proveedor está adherido a él y, si no, en las cláusulas contractuales tipo aprobadas por la Comisión Europea.",
    changes: "Actualizamos esta página antes de añadir o sustituir un proveedor.",
    privacy: "Política de privacidad",
    updated: "Última actualización: [fecha de publicación]",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const l = (await getLocale()) === "es" ? "es" : "en";
  return {
    title: `${COPY[l].title} · Dealroom`,
    description:
      l === "es"
        ? "Los proveedores que tratan datos personales para Dealroom, qué hace cada uno y dónde."
        : "The providers that process personal data for Dealroom, what each one does and where.",
    alternates: { canonical: "/subprocessors" },
  };
}

export default async function SubprocessorsPage() {
  const l = (await getLocale()) === "es" ? "es" : "en";
  const c = COPY[l];
  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16 space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">{c.title}</h1>
        <p className="text-xs text-muted-foreground">{c.updated}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{c.intro}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-4 font-semibold">{c.headRole}</th>
              <th className="py-2 pr-4 font-semibold">{c.headProvider}</th>
              <th className="py-2 font-semibold">{c.headLocation}</th>
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r) => (
              <tr key={r.provider} className="border-b border-border/60 align-top">
                <td className="py-2 pr-4 leading-relaxed">
                  {r.role}
                  {r.when && <span className="block text-muted-foreground">{r.when}</span>}
                </td>
                <td className="py-2 pr-4">{r.provider}</td>
                <td className="py-2">{r.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="space-y-3 text-sm text-muted-foreground leading-relaxed">
        <p>{c.transfers}</p>
        <p>{c.changes}</p>
        <p>
          <a
            href={brand.links.privacy}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline decoration-primary/30 hover:decoration-primary"
          >
            {c.privacy}
          </a>
        </p>
      </section>
    </main>
  );
}
