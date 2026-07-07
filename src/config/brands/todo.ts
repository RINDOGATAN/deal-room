// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { BrandConfig } from "../brand";

// Sovereign/self-hosted rebrand hooks — env-only, baked into the bundle at
// build time (NEXT_PUBLIC_*). Unset (cloud) = todo.law identity unchanged.
const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || "Dealroom";
const BRAND_ACCENT = process.env.NEXT_PUBLIC_BRAND_ACCENT || "#53aecc";
const BRAND_LOGO_URL = process.env.NEXT_PUBLIC_BRAND_LOGO_URL || "/logo.svg";

export const todo: BrandConfig = {
  id: "todo",

  // Product identity
  name: BRAND_NAME,
  shortName: BRAND_NAME,
  tagline: "Contract Negotiation Platform",
  description: "Two-party asynchronous contract negotiation platform with intelligent compromise suggestions",

  // Company information
  company: "TODO.LAW",
  companyShort: "TODO",
  domain: "todo.law",
  appDomain: "dealroom.todo.law",
  contactEmail: "info@rindogatan.com",

  // Brand colors (used in CSS variables and email templates)
  colors: {
    primary: BRAND_ACCENT,
    background: "#1a1a1a",
    card: "#242424",
    foreground: "#fefeff",
    muted: "#a0a0a0",
    border: "#333333",
  },

  // Portal-specific accent colors
  portalColors: {
    admin: "#ffffff",
    supervisor: "#53aecc",
  },

  // Theme overrides
  theme: {
    radii: {
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "20px",
      "2xl": "24px",
      "3xl": "32px",
      "4xl": "9999px",
    },
    shadows: {
      soft: "0 2px 8px rgba(0, 0, 0, 0.25)",
      card: "0 4px 24px rgba(0, 0, 0, 0.3)",
      hover: "0 8px 32px rgba(0, 0, 0, 0.4)",
    },
  },

  // Auth mode
  auth: {
    mode: "magic-link",
  },

  // Asset paths (relative to public directory)
  assets: {
    logo: BRAND_LOGO_URL,
    icon: "/icon.svg",
    favicon: "/favicon.ico",
  },

  // External links
  links: {
    website: "https://todo.law",
    userGuide: "/docs",
    terms: "https://todo.law/terms",
    privacy: "https://todo.law/privacy",
    sourceCode:
      process.env.NEXT_PUBLIC_SOURCE_URL || "https://github.com/RINDOGATAN/deal-room",
  },

  // Cookie domain (for production cross-subdomain auth)
  cookieDomain: ".todo.law",

  // Footer config (null = no footer)
  footer: null,
};
