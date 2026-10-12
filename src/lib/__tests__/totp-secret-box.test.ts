// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC
import { describe, it, expect, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import * as OTPAuth from "otpauth";
import { isSealed, openTotpSecret, sealTotpSecret } from "@/lib/totp-secret-box";
import { generateAdminSecret, verifyAdminToken } from "@/lib/totp-admin";
import { generateSupervisorSecret, verifySupervisorToken } from "@/lib/totp-supervisor";

const KEY = randomBytes(32).toString("base64");
const OTHER = randomBytes(32).toString("base64");
const env = (k?: string) => ({ TOTP_ENCRYPTION_KEY: k }) as unknown as NodeJS.ProcessEnv;

function codeFor(secret: string) {
  return new OTPAuth.TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) }).generate();
}

afterEach(() => {
  delete process.env.TOTP_ENCRYPTION_KEY;
});

describe("TOTP secret encryption at rest", () => {
  const secret = "JBSWY3DPEHPK3PXP";

  it("without a key, stores and reads plain text as before", () => {
    expect(sealTotpSecret(secret, env())).toBe(secret);
    expect(openTotpSecret(secret, env())).toBe(secret);
  });

  it("with a key, stores an encrypted value that round-trips and never contains the secret", () => {
    const sealed = sealTotpSecret(secret, env(KEY));
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain(secret);
    expect(sealTotpSecret(secret, env(KEY))).not.toBe(sealed); // fresh IV each time
    expect(openTotpSecret(sealed, env(KEY))).toBe(secret);
  });

  it("still reads plain rows once a key is set (before the backfill)", () => {
    expect(openTotpSecret(secret, env(KEY))).toBe(secret);
  });

  it("refuses an encrypted value with no key, a wrong key or tampering", () => {
    const sealed = sealTotpSecret(secret, env(KEY));
    expect(() => openTotpSecret(sealed, env())).toThrow();
    expect(() => openTotpSecret(sealed, env(OTHER))).toThrow();
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    expect(() => openTotpSecret(tampered, env(KEY))).toThrow();
  });

  it("refuses a key of the wrong length", () => {
    expect(() => sealTotpSecret(secret, env(randomBytes(16).toString("base64")))).toThrow();
  });

  it("admin and supervisor codes verify against plain and encrypted secrets", () => {
    process.env.TOTP_ENCRYPTION_KEY = KEY;
    const a = generateAdminSecret("admin@example.test");
    const s = generateSupervisorSecret("sup@example.test");
    expect(verifyAdminToken(a, codeFor(a))).toBe(true);
    expect(verifyAdminToken(sealTotpSecret(a), codeFor(a))).toBe(true);
    expect(verifySupervisorToken(sealTotpSecret(s), codeFor(s))).toBe(true);
    expect(verifyAdminToken(sealTotpSecret(a), "000000") && codeFor(a) !== "000000").toBe(false);
  });
});
