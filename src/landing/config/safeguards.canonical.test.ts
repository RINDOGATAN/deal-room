import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { COPY, QUESTIONS, meets, type SafeguardKey } from "./safeguards";

/*
 * The safeguards wizard is identical, word for word, in four places, which must change
 * together (same questions, same three-way tick matrix, same copy, same keys):
 *   - todolaw          src/content/safeguards.ts
 *   - dpocentral       src/landing/content/safeguards.ts
 *   - aisentinel       src/landing/config/safeguards.ts
 *   - deal-room        src/landing/config/safeguards.ts
 * This test hashes the normalised content (keys sorted, strings NFC). When it fails, make
 * the same change in all four copies and put the new hash in all four tests.
 */
const CANONICAL_SHA256 = "ff7b19f8fd41aa77396ac40eb39e984bcd0973aa4f71d84c219046cb26c67f59";

const KEYS: SafeguardKey[] = ["loc:servers", "loc:office", "data:real", "data:special", "ai:none", "ai:key", "ai:local", "iso:yes", "it:no", "cert:yes"];
const WAYS = ["cloud", "managed", "deploy"] as const;

const normalise = (v: unknown): unknown => {
  if (typeof v === "string") return v.normalize("NFC");
  if (Array.isArray(v)) return v.map(normalise);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, normalise((v as Record<string, unknown>)[k])]),
    );
  return v;
};

const canonicalContent = () =>
  JSON.stringify(
    normalise({
      questions: QUESTIONS,
      met: Object.fromEntries(KEYS.map((k) => [k, Object.fromEntries(WAYS.map((w) => [w, meets(w, k)]))])),
      copy: COPY,
    }),
  );

describe("safeguards wizard: canonical content", () => {
  it("matches the hash shared by the storefront and the three product landings", () => {
    expect(createHash("sha256").update(canonicalContent()).digest("hex")).toBe(CANONICAL_SHA256);
  });
});
