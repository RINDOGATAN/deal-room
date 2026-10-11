// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Customer logos shown on the public landing, in both languages, above the footer.
 *
 * The owner's list of ten organizations (11 Oct 2026), under the heading "Trusted by" /
 * "Clientes destacados". A logo is listed here only with the owner's word
 * that the organization may be named. With an empty list the landing renders no logo
 * section at all (no heading, no placeholder).
 *
 * Each entry: the organization's name (the image's alt text), the logo under public/
 * (in its own colours, or white ink where the colour version is unreadable on the dark
 * page; the page mutes it and shows the colours on hover, see CustomerLogos),
 * and its display size in CSS pixels, optically balanced (wide wordmarks shorter, compact
 * marks taller). Sources of every file: public/images/clients/LOGOS.md.
 */

export interface CustomerLogo {
  name: string;
  src: string;
  width: number;
  height: number;
  href?: string;
}

export const CUSTOMER_LOGOS: readonly CustomerLogo[] = [
  { name: "Toyota", src: "/images/clients/toyota.svg", width: 150, height: 20 },
  { name: "BBVA", src: "/images/clients/bbva.svg", width: 91, height: 27 },
  { name: "ING", src: "/images/clients/ing.svg", width: 113, height: 28 },
  { name: "Vodafone", src: "/images/clients/vodafone.svg", width: 113, height: 28 },
  { name: "MAPFRE", src: "/images/clients/mapfre.svg", width: 145, height: 22 },
  { name: "Whole Foods Market", src: "/images/clients/whole-foods.svg", width: 125, height: 32 },
  { name: "Sealmetrics", src: "/images/clients/sealmetrics.svg", width: 135, height: 24 },
  { name: "Clientify", src: "/images/clients/clientify.png", width: 104, height: 25 },
  { name: "Conductrics", src: "/images/clients/conductrics.svg", width: 146, height: 26 },
  { name: "Trackingplan", src: "/images/clients/trackingplan.svg", width: 134, height: 24 },
];
