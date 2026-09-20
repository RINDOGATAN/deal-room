// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Colour is proved, not claimed.
 *
 * Every foreground and background pair the product can produce is named here
 * and its contrast ratio computed: 4.5:1 for text, 3:1 for marks that carry
 * meaning. A failure prints the pair, so it says which colour on which surface.
 *
 * The suite also pins the palette to `globals.css`, so a token cannot be
 * changed in one place only.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blendOver, contrastRatio, contrastRatioRounded, parseHex, relativeLuminance } from "../contrast";
import {
  CONTRAST_PAIRS,
  MARK_COLOURS,
  SOLID_FILLS,
  STATUS_TONES,
  SURFACES,
  TEXT_COLOURS,
  TONE_STYLES,
  measuredPairs,
} from "../status-colors";

const ROOT = join(__dirname, "../../..");
const GLOBALS_CSS = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");

describe("contrast arithmetic", () => {
  it("matches the WCAG reference points", () => {
    expect(contrastRatioRounded("#ffffff", "#000000")).toBe(21);
    expect(contrastRatioRounded("#ffffff", "#ffffff")).toBe(1);
    // Published reference: #767676 is the lightest grey that passes on white.
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
  });

  it("reads both hex forms and rejects anything else", () => {
    expect(parseHex("#abc")).toEqual([170, 187, 204]);
    expect(parseHex("aabbcc")).toEqual([170, 187, 204]);
    expect(() => parseHex("#xyzxyz")).toThrow();
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("flattens a translucent tint the way a browser does", () => {
    // The danger surface is exactly what a 10% red tint over a card resolved to.
    expect(blendOver("#ef4444", 0.1, "#242424")).toBe("#382727");
  });
});

describe("every colour pair the product uses", () => {
  it("covers all four families on all surfaces", () => {
    // Text tokens plus marks across every surface, the three marks that sit on
    // their own background, and the solid fills.
    expect(CONTRAST_PAIRS.length).toBe(
      (Object.keys(TEXT_COLOURS).length + Object.keys(MARK_COLOURS).length) *
        Object.keys(SURFACES).length +
        3 +
        Object.keys(SOLID_FILLS).length * 3,
    );
  });

  it.each(CONTRAST_PAIRS.map((p) => [p.name, p] as const))("%s", (_name, p) => {
    const ratio = contrastRatioRounded(p.foreground, p.background);
    expect(
      ratio,
      `${p.name}: ${p.foreground} on ${p.background} is ${ratio}:1, needs ${p.minimum}:1`,
    ).toBeGreaterThanOrEqual(p.minimum);
  });

  it("reports a ratio for every pair", () => {
    const measured = measuredPairs();
    expect(measured.every((p) => p.passes)).toBe(true);
    expect(new Set(measured.map((p) => p.name)).size).toBe(measured.length);
  });
});

describe("the stylesheet carries the same palette", () => {
  const declared = [
    ...Object.values(SURFACES),
    ...Object.values(TEXT_COLOURS),
    ...Object.values(MARK_COLOURS),
    ...Object.values(SOLID_FILLS).flatMap((s) => [s.fill, s.on]),
  ];

  it.each(declared.map((t) => [t.cssVar, t] as const))(
    "%s is declared once with the palette value",
    (cssVar, token) => {
      const matches = [...GLOBALS_CSS.matchAll(new RegExp(`${cssVar}:\\s*([^;]+);`, "g"))].map((m) =>
        m[1].trim().toLowerCase(),
      );
      expect(matches, `${cssVar} is not declared in globals.css`).toHaveLength(1);
      expect(matches[0], `${cssVar} should be ${token.hex}`).toBe(token.hex);
    },
  );

  it("exposes each token to Tailwind as a utility colour", () => {
    for (const name of ["danger", "warning", "success", "info"]) {
      expect(GLOBALS_CSS).toContain(`--color-${name}: var(--${name});`);
      expect(GLOBALS_CSS).toContain(`--color-${name}-mark: var(--${name}-mark);`);
      expect(GLOBALS_CSS).toContain(`--color-${name}-surface: var(--${name}-surface);`);
    }
  });
});

describe("product code only uses the palette", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(join(ROOT, dir)).flatMap((name) => {
      const rel = `${dir}/${name}`;
      if (statSync(join(ROOT, rel)).isDirectory()) return sourceFiles(rel);
      return /\.tsx?$/.test(name) ? [rel] : [];
    });
  }

  const files = ["src/app", "src/components", "src/landing"]
    .flatMap(sourceFiles)
    .filter((f) => !f.includes("__tests__"));

  // A raw Tailwind hue is unproved: nothing pins its ratio against our
  // surfaces. Everything goes through the tokens instead.
  const RAW_HUE =
    /\b(?:text|bg|border|ring|from|via|to|fill|stroke)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/;

  it("finds the files it is guarding", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("uses no raw Tailwind hue utilities", () => {
    const offenders: string[] = [];
    for (const file of files) {
      readFileSync(join(ROOT, file), "utf8")
        .split("\n")
        .forEach((line, i) => {
          const hit = line.match(RAW_HUE);
          if (hit) offenders.push(`${file}:${i + 1} ${hit[0]}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it("keeps plain white text to the one place with a photographic backdrop", () => {
    const offenders = files.filter((file) =>
      /\btext-white(\/\d+)?\b/.test(readFileSync(join(ROOT, file), "utf8")),
    );
    // The hero sits on a photograph behind a dark scrim, where no token pair
    // can be computed; everywhere else uses --foreground.
    expect(offenders).toEqual(["src/landing/components/StartupProductPage.tsx"]);
  });
});

describe("colour is never the only signal", () => {
  it("gives every tone a word, a border and its own shape", () => {
    // A distinct icon shape per tone: someone who cannot tell the hues apart
    // still reads the difference from the shape.
    const shapes = STATUS_TONES.map((tone) => TONE_STYLES[tone].iconName);
    expect(new Set(shapes).size).toBe(STATUS_TONES.length);

    for (const tone of STATUS_TONES) {
      const style = TONE_STYLES[tone];
      expect(style.panel, tone).toContain(`bg-${tone}-surface`);
      expect(style.panel, tone).toContain(`border-${tone}-mark`);
      expect(style.heading, tone).toContain(`text-${tone}`);
      expect(style.icon, tone).toContain(`text-${tone}-mark`);
      // The sentence inside an alert stays in the body text colour.
      expect(style.body, tone).toContain("text-foreground");
      expect(style.body, tone).not.toMatch(/text-(danger|warning|success|info)\b/);
    }
  });
});
