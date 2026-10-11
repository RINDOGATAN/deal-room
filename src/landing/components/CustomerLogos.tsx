// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * A static row of customer logos under "Trusted by" (the heading is uppercase by CSS only, so
 * screen readers read normal words). One file per logo, in its own colours (or white ink where
 * the colour version is unreadable on the dark page; see public/images/clients/LOGOS.md). The
 * filter mutes every logo to the page's light text colour; on devices that can hover (the
 * hover: variant of Tailwind 4 applies only under @media (hover: hover)) the filter goes on
 * hover, so the logo shows in colour. Short transition, none with reduced motion; phones stay
 * muted. Every image carries its width and height, so the row reserves its space before the
 * files arrive (no layout shift); it loads lazily and wraps on phones, at 80 % size. Renders
 * nothing while the list is empty (src/landing/config/customer-logos.ts).
 */

import type { CSSProperties } from "react";
import { CUSTOMER_LOGOS, type CustomerLogo } from "../config/customer-logos";

interface CustomerLogosProps {
  /** The heading, already in the page's language. */
  label: string;
  /** For tests; the page uses the configured list. */
  logos?: readonly CustomerLogo[];
}

export default function CustomerLogos({ label, logos = CUSTOMER_LOGOS }: CustomerLogosProps) {
  if (logos.length === 0) return null;
  return (
    <section className="py-14 md:py-20 border-t border-border" aria-labelledby="clients-heading">
      <div className="container px-6">
        <h2 id="clients-heading" className="section-label block text-center mb-8">
          {label}
        </h2>
        <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-5 sm:gap-x-11 sm:gap-y-7 max-w-5xl mx-auto">
          {logos.map((logo) => (
            <li key={logo.name}>
              <img
                src={logo.src}
                alt={logo.name}
                width={logo.width}
                height={logo.height}
                loading="lazy"
                decoding="async"
                className="block h-auto w-[calc(var(--w)*0.8px)] sm:w-[calc(var(--w)*1px)] brightness-0 invert opacity-60 transition-[filter,opacity] duration-200 motion-reduce:transition-none hover:filter-none hover:opacity-100"
                style={{ "--w": logo.width } as CSSProperties}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
