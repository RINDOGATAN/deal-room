/**
 * The product's status palette.
 *
 * Two rules drive every value here:
 *
 * 1. Text meets 4.5:1 against every surface it can sit on; marks that carry
 *    meaning (icons, borders, dots, bars) meet 3:1.
 * 2. Colour never carries meaning on its own. A hue is always accompanied by a
 *    word and by a shape, so these tokens are only ever the second signal.
 *
 * The hexes below are the single source of truth. `globals.css` declares the
 * same values as custom properties and `status-colors.test.ts` fails if the two
 * drift apart, so a token can only be changed in both places at once.
 *
 * Surfaces are opaque on purpose. A translucent tint (`bg-danger/10`) resolves
 * to a different colour on every parent, which cannot be proved; an opaque
 * surface token can.
 */

import { contrastRatio } from "./contrast";

export type ColourToken = {
  /** The CSS custom property that carries this value in `globals.css`. */
  cssVar: string;
  hex: string;
  /** Human wording used in test names, so a failure says which pair broke. */
  label: string;
};

/** Every background that product text actually sits on. */
export const SURFACES = {
  background: { cssVar: "--background", hex: "#1a1a1a", label: "the page background" },
  card: { cssVar: "--card", hex: "#242424", label: "a card" },
  secondary: { cssVar: "--secondary", hex: "#2e2e2e", label: "a secondary panel" },
  muted: { cssVar: "--muted", hex: "#333333", label: "a muted panel" },
  dangerSurface: { cssVar: "--danger-surface", hex: "#382727", label: "a danger panel" },
  warningSurface: { cssVar: "--warning-surface", hex: "#383221", label: "a warning panel" },
  successSurface: { cssVar: "--success-surface", hex: "#24342a", label: "a success panel" },
  infoSurface: { cssVar: "--info-surface", hex: "#293235", label: "an information panel" },
} as const satisfies Record<string, ColourToken>;

export type SurfaceName = keyof typeof SURFACES;

/** Text colours. Each must clear 4.5:1 on every surface above. */
export const TEXT_COLOURS = {
  foreground: { cssVar: "--foreground", hex: "#fefeff", label: "body text" },
  mutedForeground: { cssVar: "--muted-foreground", hex: "#a0a0a0", label: "secondary body text" },
  secondaryForeground: { cssVar: "--secondary-foreground", hex: "#e0e0e0", label: "panel text" },
  link: { cssVar: "--primary", hex: "#53aecc", label: "link text" },
  danger: { cssVar: "--danger", hex: "#fca5a5", label: "danger text" },
  warning: { cssVar: "--warning", hex: "#fbbf24", label: "warning text" },
  success: { cssVar: "--success", hex: "#6ee7a8", label: "success text" },
  info: { cssVar: "--info", hex: "#8fd4e8", label: "information text" },
} as const satisfies Record<string, ColourToken>;

/**
 * Marks that carry meaning without being text: alert icons, panel borders,
 * status dots, progress bars, chart series. 3:1 is the threshold.
 */
export const MARK_COLOURS = {
  dangerMark: { cssVar: "--danger-mark", hex: "#ef4444", label: "the danger mark" },
  warningMark: { cssVar: "--warning-mark", hex: "#f5b72a", label: "the warning mark" },
  successMark: { cssVar: "--success-mark", hex: "#22c55e", label: "the success mark" },
  infoMark: { cssVar: "--info-mark", hex: "#53aecc", label: "the information mark" },
} as const satisfies Record<string, ColourToken>;

/** Filled buttons, chips and dots: the fill and the text that sits on it. */
export const SOLID_FILLS = {
  primary: {
    fill: { cssVar: "--primary", hex: "#53aecc", label: "the primary fill" },
    on: { cssVar: "--primary-foreground", hex: "#1a1a1a", label: "text on the primary fill" },
  },
  danger: {
    fill: { cssVar: "--destructive", hex: "#dc2626", label: "the danger fill" },
    on: { cssVar: "--destructive-foreground", hex: "#ffffff", label: "text on the danger fill" },
  },
  dangerHover: {
    fill: { cssVar: "--destructive-hover", hex: "#ef4444", label: "the danger fill on hover" },
    on: {
      cssVar: "--destructive-hover-foreground",
      hex: "#1a1a1a",
      label: "text on the danger fill on hover",
    },
  },
  warning: {
    fill: { cssVar: "--warning-solid", hex: "#f5b72a", label: "the warning fill" },
    on: { cssVar: "--warning-solid-foreground", hex: "#1a1a1a", label: "text on the warning fill" },
  },
  success: {
    fill: { cssVar: "--success-solid", hex: "#22c55e", label: "the success fill" },
    on: { cssVar: "--success-solid-foreground", hex: "#1a1a1a", label: "text on the success fill" },
  },
} as const;

export const THRESHOLD_TEXT = 4.5;
export const THRESHOLD_LARGE_TEXT = 3;
export const THRESHOLD_MARK = 3;

export type ContrastPair = {
  /** Unique, readable: this is what a failing test prints. */
  name: string;
  foreground: string;
  background: string;
  minimum: number;
};

function pair(name: string, foreground: string, background: string, minimum: number): ContrastPair {
  return { name, foreground, background, minimum };
}

/**
 * Every pair the product can produce, named.
 *
 * The cross product of text tokens and surfaces is deliberately wider than
 * today's screens: it means a new screen combining two existing tokens cannot
 * introduce a failure that the suite did not already cover.
 */
export const CONTRAST_PAIRS: ContrastPair[] = [
  ...Object.values(TEXT_COLOURS).flatMap((text) =>
    Object.values(SURFACES).map((surface) =>
      pair(`${text.label} on ${surface.label}`, text.hex, surface.hex, THRESHOLD_TEXT),
    ),
  ),
  ...Object.values(MARK_COLOURS).flatMap((mark) =>
    Object.values(SURFACES).map((surface) =>
      pair(`${mark.label} on ${surface.label}`, mark.hex, surface.hex, THRESHOLD_MARK),
    ),
  ),
  // Marks that sit on something other than a page surface: the pair is named
  // one by one because each has its own background.
  pair("the progress indicator against its track", "#53aecc", "#2d4046", THRESHOLD_MARK),
  pair("the toggle knob on a filled track", "#1a1a1a", "#53aecc", THRESHOLD_MARK),
  pair("the toggle knob on an empty track", "#fefeff", "#333333", THRESHOLD_MARK),
  ...Object.values(SOLID_FILLS).flatMap((solid) => [
    pair(`${solid.on.label}`, solid.on.hex, solid.fill.hex, THRESHOLD_TEXT),
    pair(
      `${solid.fill.label} against ${SURFACES.background.label}`,
      solid.fill.hex,
      SURFACES.background.hex,
      THRESHOLD_MARK,
    ),
    pair(
      `${solid.fill.label} against ${SURFACES.card.label}`,
      solid.fill.hex,
      SURFACES.card.hex,
      THRESHOLD_MARK,
    ),
  ]),
];

export const STATUS_TONES = ["danger", "warning", "success", "info"] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

/**
 * The class vocabulary for a tone.
 *
 * `heading` and `icon` are the two places a hue is allowed to appear, and each
 * of them always sits next to a word. `body` is deliberately the ordinary body
 * text colour: an alert's severity is shown by its icon, its border and its
 * heading, never by tinting the sentence.
 */
export const TONE_STYLES: Record<
  StatusTone,
  {
    /** Panel: tinted surface plus a border in the mark colour. */
    panel: string;
    /** The heading word of an alert, a metric label, a badge label. */
    heading: string;
    /** The sentence inside an alert. */
    body: string;
    /** Icon colour. Pair with the tone's own icon shape. */
    icon: string;
    /** Status dot or bar fill. Never on its own: always next to its word. */
    dot: string;
    /** Badge sitting on a card: tinted surface, border, readable label. */
    badge: string;
    /** The shape that carries the meaning when the hue cannot be seen. */
    iconName: "OctagonAlert" | "TriangleAlert" | "CircleCheck" | "Info";
  }
> = {
  danger: {
    panel: "bg-danger-surface border border-danger-mark",
    heading: "text-danger",
    body: "text-foreground",
    icon: "text-danger-mark",
    dot: "bg-danger-mark",
    badge: "bg-danger-surface border border-danger-mark text-danger",
    iconName: "OctagonAlert",
  },
  warning: {
    panel: "bg-warning-surface border border-warning-mark",
    heading: "text-warning",
    body: "text-foreground",
    icon: "text-warning-mark",
    dot: "bg-warning-mark",
    badge: "bg-warning-surface border border-warning-mark text-warning",
    iconName: "TriangleAlert",
  },
  success: {
    panel: "bg-success-surface border border-success-mark",
    heading: "text-success",
    body: "text-foreground",
    icon: "text-success-mark",
    dot: "bg-success-mark",
    badge: "bg-success-surface border border-success-mark text-success",
    iconName: "CircleCheck",
  },
  info: {
    panel: "bg-info-surface border border-info-mark",
    heading: "text-info",
    body: "text-foreground",
    icon: "text-info-mark",
    dot: "bg-info-mark",
    badge: "bg-info-surface border border-info-mark text-info",
    iconName: "Info",
  },
};

/** Convenience for reports and scripts: every pair with its measured ratio. */
export function measuredPairs(): Array<ContrastPair & { ratio: number; passes: boolean }> {
  return CONTRAST_PAIRS.map((p) => {
    const ratio = Math.round(contrastRatio(p.foreground, p.background) * 100) / 100;
    return { ...p, ratio, passes: ratio >= p.minimum };
  });
}
