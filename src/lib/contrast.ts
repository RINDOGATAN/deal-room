/**
 * WCAG 2.1 contrast arithmetic.
 *
 * Kept dependency-free so the colour test can run in Vitest without a browser
 * and so any script (a static guard, a report) can reuse the same numbers.
 */

export type Hex = `#${string}`;

/** Expand `#abc` and parse `#aabbcc` into 0-255 channels. */
export function parseHex(hex: string): [number, number, number] {
  const raw = hex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

/** WCAG contrast ratio between two opaque colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Rounded to two decimals, the form used in failure messages and reports. */
export function contrastRatioRounded(a: string, b: string): number {
  return Math.round(contrastRatio(a, b) * 100) / 100;
}

/**
 * Flatten a translucent colour over an opaque one.
 *
 * Only used to document what an old `bg-x/10` utility resolved to; the palette
 * itself stores opaque surfaces so every pair in the test is exact.
 */
export function blendOver(foreground: string, alpha: number, background: string): Hex {
  const f = parseHex(foreground);
  const b = parseHex(background);
  const channel = (i: number) =>
    Math.round(alpha * f[i] + (1 - alpha) * b[i])
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(1)}${channel(2)}` as Hex;
}
