// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Encryption at rest for the admin and supervisor TOTP secrets.
 *
 * Stored form: `enc:v1:<iv>:<tag>:<ciphertext>` (base64url), AES-256-GCM with
 * a 32-byte key from TOTP_ENCRYPTION_KEY (base64). The column stays a string,
 * so no schema change is needed.
 *
 * Rollout, in this order:
 *   1. This code is deployed with no key: secrets are written and read in
 *      plain text exactly as before.
 *   2. TOTP_ENCRYPTION_KEY is set: new secrets are written encrypted; old plain
 *      ones still verify.
 *   3. The backfill (scripts/encrypt-totp-secrets.ts) encrypts the plain rows.
 * An encrypted value with no key, or with the wrong key, throws: it is never
 * treated as a plain secret, and no code is accepted.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function key(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = env.TOTP_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("TOTP_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  }
  return buf;
}

export function isSealed(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

/** The value to store: encrypted when a key is configured, plain otherwise. */
export function sealTotpSecret(secret: string, env: NodeJS.ProcessEnv = process.env): string {
  const k = key(env);
  if (!k) return secret;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ct.toString("base64url")}`;
}

/** The base32 secret from a stored value, plain or encrypted. */
export function openTotpSecret(stored: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!isSealed(stored)) return stored;
  const k = key(env);
  if (!k) throw new Error("An encrypted TOTP secret needs TOTP_ENCRYPTION_KEY");
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted TOTP secret");
  const [iv, tag, ct] = parts.map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", k, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
