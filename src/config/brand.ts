/**
 * Brand Configuration
 *
 * Environment-driven brand switching for multi-brand deployment.
 * Set NEXT_PUBLIC_BRAND=todo|northend to select brand.
 *
 * Deployment model: Two Vercel projects → same repo, different env vars.
 */

import { todo } from "./brands/todo";
import { northend } from "./brands/northend";

// Brand config interface
export interface BrandConfig {
  id: "todo" | "northend";

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
    favicon: string;
  };

  // External links
  links: {
    website: string;
    userGuide: string;
    terms: string;
    privacy: string;
  };

  // Cookie domain (for production cross-subdomain auth)
  cookieDomain: string;

  // Footer config (null = no footer)
  footer: {
    text: string;
    links: Record<string, { label: string; url: string }>;
  } | null;
}

const brandId = (process.env.NEXT_PUBLIC_BRAND || "todo") as BrandConfig["id"];
export const brand: BrandConfig = brandId === "northend" ? northend : todo;

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
