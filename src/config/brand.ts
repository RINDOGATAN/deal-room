/**
 * Brand Configuration
 *
 * Single-brand deployment (todo.law). The previous dual-brand system
 * with northend.law was retired on 2026-05-02 — the white-label NEL
 * deployment had no clients and the maintenance cost was real (two
 * Vercel projects, two sets of secrets, ~15 brand-aware code paths).
 * If a second brand is ever needed in the future, restore the union
 * type on `id` and the env-var switch at the bottom of this file.
 */

import { todo } from "./brands/todo";

// Brand config interface
export interface BrandConfig {
  id: "todo";

  // Product identity
  name: string;
  shortName: string;
  tagline: string;
  description: string;

  // Company information
  company: string;
  companyShort: string;
  domain: string;
  appDomain: string;
  contactEmail: string;

  // Brand colors (used in CSS variables and email templates)
  colors: {
    primary: string;
    background: string;
    card: string;
    foreground: string;
    muted: string;
    border: string;
  };

  // Portal-specific accent colors
  portalColors: {
    admin: string;
    supervisor: string;
  };

  // Theme overrides
  theme: {
    radii: Record<string, string>;
    shadows: Record<string, string> | null; // null = no shadows (brutalist)
  };

  // Auth mode
  auth: {
    mode: "magic-link" | "invite-code";
  };

  // Asset paths (relative to public directory)
  assets: {
    logo: string;
    icon: string;
    favicon: string;
  };

  // External links
  links: {
    website: string;
    userGuide: string;
    terms: string;
    privacy: string;
    // AGPL §13: where this deployment offers its Corresponding Source to
    // network users. Forks/self-hosts point this at their own repo via
    // NEXT_PUBLIC_SOURCE_URL (baked at build time).
    sourceCode: string;
  };

  // Cookie domain (for production cross-subdomain auth)
  cookieDomain: string;

  // Footer config (null = no footer)
  footer: {
    text: string;
    links: Record<string, { label: string; url: string }>;
  } | null;
}

export const brand: BrandConfig = todo;

// Helper to get full contact mailto link
export function getContactMailto(subject?: string): string {
  const baseUrl = `mailto:${brand.contactEmail}`;
  if (subject) {
    return `${baseUrl}?subject=${encodeURIComponent(subject)}`;
  }
  return baseUrl;
}

// Helper to generate email template styles
export function getEmailStyles() {
  return {
    header: {
      color: brand.colors.primary,
      background: brand.colors.background,
    },
    button: {
      background: brand.colors.background,
      color: brand.colors.primary,
    },
    adminHeader: {
      color: brand.portalColors.admin,
      background: brand.colors.background,
    },
    adminButton: {
      background: brand.colors.background,
      color: brand.portalColors.admin,
    },
    supervisorHeader: {
      color: brand.portalColors.supervisor,
      background: brand.colors.background,
    },
    supervisorButton: {
      background: brand.portalColors.supervisor,
      color: "white",
    },
  };
}

// TOTP issuer names for authenticator apps
export const totpIssuers = {
  user: brand.name,
  admin: `${brand.name} - Platform Admin`,
  supervisor: `${brand.name} - Supervisor`,
} as const;
