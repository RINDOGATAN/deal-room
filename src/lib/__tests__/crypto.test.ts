// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Pure-function tests for the licensing crypto helpers.
 *
 * Covers license-key format validation, license expiry, package hashing
 * determinism, HMAC download tokens, and Ed25519 license-file signatures
 * (round-tripped with a freshly generated key pair — no env keys needed).
 */
import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import {
  isValidLicenseKeyFormat,
  generateLicenseKey,
  isLicenseExpired,
  computePackageHash,
  generateDownloadToken,
  verifyDownloadToken,
  generateEd25519KeyPair,
  signEd25519,
  verifyLicenseFile,
  canonicalLicensePayload,
  type LicenseFile,
} from "@/lib/crypto";

describe("isValidLicenseKeyFormat", () => {
  it("accepts the canonical format, case-insensitively", () => {
    expect(isValidLicenseKeyFormat("LIC-A1B2-C3D4-E5F6-A7B8")).toBe(true);
    expect(isValidLicenseKeyFormat("lic-a1b2-c3d4-e5f6-a7b8")).toBe(true);
  });

  it("accepts every generated license key", () => {
    for (let i = 0; i < 20; i++) {
      expect(isValidLicenseKeyFormat(generateLicenseKey())).toBe(true);
    }
  });

  it("rejects malformed keys", () => {
    expect(isValidLicenseKeyFormat("")).toBe(false);
    expect(isValidLicenseKeyFormat("LIC-A1B2-C3D4-E5F6")).toBe(false); // 3 segments
    expect(isValidLicenseKeyFormat("KEY-A1B2-C3D4-E5F6-A7B8")).toBe(false); // wrong prefix
    expect(isValidLicenseKeyFormat("LIC-A1B2-C3D4-E5F6-A7BG")).toBe(false); // G not hex
    expect(isValidLicenseKeyFormat("LIC-A1B2-C3D4-E5F6-A7B8-EXTRA")).toBe(false);
  });
});

function licenseFixture(overrides: Partial<LicenseFile> = {}): LicenseFile {
  return {
    licenseKey: "LIC-A1B2-C3D4-E5F6-A7B8",
    customerId: "cust-1",
    customerName: "Acme Corp",
    skillId: "nda-premium",
    jurisdictions: ["CALIFORNIA"],
    licenseType: "SUBSCRIPTION",
    maxActivations: 3,
    issuedAt: new Date("2026-01-01").toISOString(),
    signature: "",
    ...overrides,
  };
}

describe("isLicenseExpired", () => {
  it("treats a license without expiresAt as perpetual", () => {
    expect(isLicenseExpired(licenseFixture())).toBe(false);
  });

  it("returns false for a future expiry and true for a past one", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isLicenseExpired(licenseFixture({ expiresAt: future }))).toBe(false);
    expect(isLicenseExpired(licenseFixture({ expiresAt: past }))).toBe(true);
  });
});

describe("computePackageHash", () => {
  it("is independent of file insertion order but sensitive to content and path", () => {
    const a = new Map<string, Buffer>([
      ["clauses.json", Buffer.from("{}")],
      ["metadata.json", Buffer.from('{"v":1}')],
    ]);
    const b = new Map<string, Buffer>([
      ["metadata.json", Buffer.from('{"v":1}')],
      ["clauses.json", Buffer.from("{}")],
    ]);
    expect(computePackageHash(a)).toBe(computePackageHash(b));

    const changedContent = new Map(a);
    changedContent.set("clauses.json", Buffer.from("{ }"));
    expect(computePackageHash(changedContent)).not.toBe(computePackageHash(a));

    const changedPath = new Map<string, Buffer>([
      ["clauses2.json", Buffer.from("{}")],
      ["metadata.json", Buffer.from('{"v":1}')],
    ]);
    expect(computePackageHash(changedPath)).not.toBe(computePackageHash(a));
  });
});

describe("download tokens", () => {
  it("round-trips a valid token", () => {
    const token = generateDownloadToken("cust-1", "nda-premium", 3600);
    const payload = verifyDownloadToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.customerId).toBe("cust-1");
    expect(payload!.skillId).toBe("nda-premium");
    expect(payload!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects a tampered payload", () => {
    const token = generateDownloadToken("cust-1", "nda-premium", 3600);
    const [payloadB64, sig] = token.split(".");
    const forged = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    forged.skillId = "another-skill";
    const forgedB64 = Buffer.from(JSON.stringify(forged)).toString("base64url");
    expect(verifyDownloadToken(`${forgedB64}.${sig}`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = generateDownloadToken("cust-1", "nda-premium", -10);
    expect(verifyDownloadToken(token)).toBeNull();
  });

  it("rejects structurally malformed tokens", () => {
    expect(verifyDownloadToken("")).toBeNull();
    expect(verifyDownloadToken("just-one-part")).toBeNull();
    expect(verifyDownloadToken("a.b.c")).toBeNull();
    expect(verifyDownloadToken("payload.wrongsig")).toBeNull();
  });
});

describe("verifyLicenseFile (Ed25519)", () => {
  function signedLicense(privateKey: string): LicenseFile {
    const license = licenseFixture();
    const canonical = JSON.stringify({
      licenseKey: license.licenseKey,
      customerId: license.customerId,
      customerName: license.customerName,
      skillId: license.skillId,
      jurisdictions: license.jurisdictions,
      licenseType: license.licenseType,
      maxActivations: license.maxActivations,
      issuedAt: license.issuedAt,
      expiresAt: license.expiresAt,
    });
    const signature = signEd25519(Buffer.from(canonical, "utf-8"), privateKey);
    return { ...license, signature: signature.toString("base64") };
  }

  it("accepts a license signed with the matching private key", () => {
    const { publicKey, privateKey } = generateEd25519KeyPair();
    expect(verifyLicenseFile(signedLicense(privateKey), publicKey)).toBe(true);
  });

  it("rejects a license whose fields were altered after signing", () => {
    const { publicKey, privateKey } = generateEd25519KeyPair();
    const license = signedLicense(privateKey);
    const tampered = { ...license, maxActivations: 999 };
    expect(verifyLicenseFile(tampered, publicKey)).toBe(false);
  });

  it("rejects a license verified against the wrong public key", () => {
    const { privateKey } = generateEd25519KeyPair();
    const other = generateEd25519KeyPair();
    expect(verifyLicenseFile(signedLicense(privateKey), other.publicKey)).toBe(false);
  });
});

// Cross-app parity: the todo.law storefront signs a licence over the canonical
// bytes; Dealroom recomputes the SAME bytes to verify. If they disagree on one
// byte, offline activation silently breaks. These two golden SHA-256 hashes pin
// the byte contract identically across all four repos (todolaw signer +
// deal-room + dpocentral + aisentinel). If a hash changes, the serialization
// drifted — re-align field order / undefined-handling across all four, never
// patch the hash in one repo.
describe("canonical licence bytes — cross-app golden vectors", () => {
  const sha256hex = (b: Buffer) => createHash("sha256").update(b).digest("hex");

  const VECTOR_A: Omit<LicenseFile, "signature"> = {
    licenseKey: "LIC-0000-1111-2222-3333",
    customerId: "buyer@example.com",
    customerName: "Buyer Example",
    skillId: "com.todolaw.dealroom.saas-agreement",
    jurisdictions: ["CALIFORNIA", "SPAIN"],
    licenseType: "SUBSCRIPTION",
    maxActivations: 1,
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2027-01-01T00:00:00.000Z",
  };
  const VECTOR_A_SHA256 =
    "842859360ab37eafed245eca38e8e0b207c4618d3daf43f1084ce46ce5118c1e";

  const VECTOR_B: Omit<LicenseFile, "signature"> = {
    licenseKey: "LIC-4444-5555-6666-7777",
    customerId: "owner@example.com",
    customerName: "Owner Example",
    skillId: "com.nel.dpocentral.dpia-companion",
    jurisdictions: ["SPAIN"],
    licenseType: "PERPETUAL",
    maxActivations: 3,
    issuedAt: "2026-02-02T00:00:00.000Z",
    // expiresAt intentionally omitted — perpetual licence
  };
  const VECTOR_B_SHA256 =
    "2bc399ecab951c512959dbf159344ff2c59a81abd92496c3077a53484d95efbf";

  it("vector A (subscription, expiresAt present) hashes to the pinned value", () => {
    expect(sha256hex(canonicalLicensePayload(VECTOR_A))).toBe(VECTOR_A_SHA256);
  });

  it("vector B (perpetual) omits expiresAt and hashes to the pinned value", () => {
    const bytes = canonicalLicensePayload(VECTOR_B);
    expect(bytes.toString("utf-8")).not.toContain("expiresAt");
    expect(sha256hex(bytes)).toBe(VECTOR_B_SHA256);
  });
});
