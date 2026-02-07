/**
 * Brand Configuration
 *
 * Centralized branding configuration for white-label deployment.
 * Fork this file to customize branding for your deployment.
 *
 * To white-label:
 * 1. Fork the repository
 * 2. Modify this file with your brand colors, name, and links
 * 3. Replace public/logo.png and public/favicon.ico
 * 4. Deploy to your own infrastructure
 */

export const brand = {
  // Product identity
  name: "DPO CENTRAL",
  shortName: "DPO Central",
  tagline: "Privacy Program Management Platform",
  description: "Centralized privacy program management platform for DPOs and compliance teams",

  // Company information
  company: "TODO.LAW",
  companyShort: "TODO",
  domain: "todo.law",
  contactEmail: "info@rindogatan.com",

  // Brand colors (used in CSS variables and email templates)
  colors: {
    primary: "#53aecc",        // Blue accent
    background: "#1a1a1a",     // Dark background
    card: "#242424",           // Card/surface background
    foreground: "#fefeff",     // Primary text
    muted: "#a0a0a0",          // Muted text
    border: "#333333",         // Border color
  },

  // Portal-specific accent colors
  portalColors: {
    admin: "#ffffff",          // White for admin portal header
    supervisor: "#9333ea",     // Purple for supervisor portal
  },

  // Asset paths (relative to public directory)
  assets: {
    logo: "/DEALROOM_TodoLaw.png",
    favicon: "/favicon.ico",
  },

  // External links
  links: {
    website: "https://todo.law",
    terms: "https://todo.law/terms",
    privacy: "https://todo.law/privacy",
  },

  // Cookie domain (for production cross-subdomain auth)
  // Set to undefined for single-domain deployments
  cookieDomain: ".todo.law",
} as const;

// Type for the brand configuration
export type BrandConfig = typeof brand;

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
