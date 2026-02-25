import type { BrandConfig } from "../brand";

export const todo: BrandConfig = {
  id: "todo",

  // Product identity
  name: "Deal Room",
  shortName: "Dealroom",
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
    primary: "#53aecc",
    background: "#1a1a1a",
    card: "#242424",
    foreground: "#fefeff",
    muted: "#a0a0a0",
    border: "#333333",
  },

  // Portal-specific accent colors
  portalColors: {
    admin: "#ffffff",
    supervisor: "#9333ea",
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
    logo: "/DEALROOM_TodoLaw.png",
    favicon: "/favicon.ico",
  },

  // External links
  links: {
    website: "https://todo.law",
    userGuide: "/docs",
    terms: "https://todo.law/terms",
    privacy: "https://todo.law/privacy",
  },

  // Cookie domain (for production cross-subdomain auth)
  cookieDomain: ".todo.law",

  // Footer config (null = no footer)
  footer: null,
};
