import type { BrandConfig } from "../brand";

export const northend: BrandConfig = {
  id: "northend",

  // Product identity
  name: "Dealroom",
  shortName: "Dealroom",
  tagline: "Contract Negotiation Platform",
  description: "Two-party asynchronous contract negotiation platform with intelligent compromise suggestions",

  // Company information
  company: "NORTH END LAW",
  companyShort: "NEL",
  domain: "northend.law",
  appDomain: "dealroom.northend.law",
  contactEmail: "info@northend.law",

  // Brand colors
  colors: {
    primary: "#13e9d1",
    background: "#1c1f37",
    card: "#232742",
    foreground: "#fefeff",
    muted: "#a0a0a0",
    border: "#2e3354",
  },

  // Portal-specific accent colors
  portalColors: {
    admin: "#ffffff",
    supervisor: "#9333ea",
  },

  // Theme overrides — brutalist (no radii, no shadows)
  theme: {
    radii: {
      sm: "0",
      md: "0",
      lg: "0",
      xl: "0",
      "2xl": "0",
      "3xl": "0",
      "4xl": "0",
    },
    shadows: null,
  },

  // Auth mode
  auth: {
    mode: "invite-code",
  },

  // Asset paths
  assets: {
    logo: "/DEALROOM_NorthEnd.png",
    favicon: "/favicon.ico",
  },

  // External links
  links: {
    website: "https://northend.law",
    userGuide: "/docs",
    terms: "https://northend.law/terms-of-use",
    privacy: "https://northend.law/privacy-policy",
  },

  // Cookie domain
  cookieDomain: ".northend.law",

  // Footer config
  footer: {
    text: "Dealroom is a North End Law service",
    links: {
      website: { label: "northend.law", url: "https://northend.law" },
      terms: { label: "Terms of Use", url: "https://northend.law/terms-of-use" },
      privacy: { label: "Privacy Policy", url: "https://northend.law/privacy-policy" },
    },
  },
};
