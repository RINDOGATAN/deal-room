// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Wording of the one public header and footer (the navigation is the same on the home, the contract guides, Developers,
 * Agents, Docs and Pricing). By page language, so prerendered pages carry
 * it without the cookie-based messages.
 */

import type { PageLocale } from "@/lib/contract-pages-paths";

export const NAV_COPY = {
  en: {
    contracts: "Contracts",
    developers: "Developers",
    agents: "Agents",
    docs: "Docs",
    pricing: "Pricing",
    signIn: "Sign in",
    myDeals: "My deals",
    otherLanguage: "Español",
    menu: "Menu",
    closeMenu: "Close the menu",
    tagline: "Contract negotiation platform",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    licences: "Licences",
    security: "Security",
  },
  es: {
    contracts: "Contratos",
    developers: "Desarrolladores",
    agents: "Agentes",
    docs: "Documentación",
    pricing: "Precios",
    signIn: "Iniciar sesión",
    myDeals: "Mis negociaciones",
    otherLanguage: "English",
    menu: "Menú",
    closeMenu: "Cerrar el menú",
    tagline: "Plataforma de negociación de contratos",
    terms: "Términos de uso",
    privacy: "Política de privacidad",
    licences: "Licencias",
    security: "Seguridad",
  },
} satisfies Record<PageLocale, Record<string, string>>;

/** Where the Agents link leads: the agent API documentation. */
export const AGENTS_PATH = "/docs/agent-api";

export type NavSection = "contracts" | "developers" | "agents" | "docs" | "pricing" | null;

/** The section a path belongs to, for the header's current link. */
export function navSectionFor(pathname: string | null | undefined): NavSection {
  const p = (pathname ?? "/").replace(/^\/es(?=\/|$)/, "") || "/";
  if (p === "/contracts" || p.startsWith("/contracts/")) return "contracts";
  if (p === "/developers" || p.startsWith("/developers/")) return "developers";
  if (p === AGENTS_PATH || p.startsWith(`${AGENTS_PATH}/`)) return "agents";
  if (p === "/docs" || p.startsWith("/docs/")) return "docs";
  if (p === "/pricing") return "pricing";
  return null;
}
