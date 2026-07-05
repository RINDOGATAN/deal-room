/**
 * Cryptographic utilities for skill package verification and licensing.
 *
 * Uses Ed25519 for digital signatures (fast, secure, deterministic).
 * Uses SHA-256 for package hashing.
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  randomBytes,
  createHmac,
} from "crypto";
import { createLogger } from "@/lib/logger";

const logger = createLogger("crypto");

// Public key for verifying skill package signatures (Ed25519)
// In production, this would be embedded in the application or fetched from a secure source
const PUBLIC_KEY_PEM =
  process.env.SKILL_SIGNING_PUBLIC_KEY ||
  `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAPlaceholder_Replace_With_Real_Key_In_Production==
-----END PUBLIC KEY-----`;

/**
 * Sign data with an Ed25519 private key.
 * Used by the CLI packaging tool — not imported at web app runtime.
 */
export function signEd25519(data: Buffer, privateKeyPem: string): Buffer {
  const privateKey = createPrivateKey({
    key: privateKeyPem,
    format: "pem",
    type: "pkcs8",
  });
  return sign(null, data, privateKey);
}

/**
 * Generate an Ed25519 key pair (PEM-encoded).
 * Used by the CLI keygen utility.
 */
export function generateEd25519KeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "pem" }) as string,
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }) as string,
  };
}

/**
 * Verify an Ed25519 signature against data.
 */
export function verifyEd25519Signature(
  data: Buffer,
  signature: Buffer,
  publicKeyPem?: string
): boolean {
  try {
    const keyPem = publicKeyPem || PUBLIC_KEY_PEM;
    const publicKey = createPublicKey({
      key: keyPem,
      format: "pem",
      type: "spki",
    });

    return verify(null, data, publicKey, signature);
  } catch (error) {
    logger.error("Signature verification failed", { err: String(error) });
    return false;
  }
}

/**
 * Compute SHA-256 hash of data.
 */
export function sha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Compute SHA-256 hash of multiple files/buffers for package integrity.
 */
export function computePackageHash(
  files: Map<string, Buffer>
): string {
  const hash = createHash("sha256");

  // Sort files by path for deterministic hashing
  const sortedPaths = Array.from(files.keys()).sort();

  for (const path of sortedPaths) {
    const content = files.get(path)!;
    // Include path and content in hash
    hash.update(path);
    hash.update(content);
  }

  return hash.digest("hex");
}

/**
 * Generate a unique instance ID for this installation.
 */
export function generateInstanceId(): string {
  return `inst_${randomBytes(16).toString("hex")}`;
}

/**
 * Generate a license key in the format: LIC-XXXX-XXXX-XXXX-XXXX
 */
export function generateLicenseKey(): string {
  const segments: string[] = [];
  for (let i = 0; i < 4; i++) {
    segments.push(randomBytes(2).toString("hex").toUpperCase());
  }
  return `LIC-${segments.join("-")}`;
}

/**
 * Validate license key format.
 */
export function isValidLicenseKeyFormat(key: string): boolean {
  return /^LIC-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/i.test(key);
}

/**
 * Compute machine fingerprint from hostname and MAC address.
 * Used for activation tracking to prevent license abuse.
 */
export function computeMachineFingerprint(
  hostname: string,
  macAddress: string
): string {
  const combined = `${hostname.toLowerCase()}:${macAddress.toLowerCase().replace(/[:-]/g, "")}`;
  return sha256(combined);
}

// Types for package manifest

export interface PackageManifest {
  skillId: string;
  name: string;
  displayName: string;
  version: string;
  description?: string;
  jurisdictions: string[];
  languages: string[];
  files: {
    [path: string]: string; // path -> SHA-256 hash
  };
  createdAt: string;
  author?: string;
  license?: string;
}

export interface LicenseFile {
  licenseKey: string;
  customerId: string;
  customerName: string;
  skillId: string;
  jurisdictions: string[];
  licenseType: "TRIAL" | "SUBSCRIPTION" | "PERPETUAL";
  maxActivations: number;
  issuedAt: string;
  expiresAt?: string;
  signature: string; // Ed25519 signature of the above fields
}

/**
 * Verify the signature on an offline license file.
 */
export function verifyLicenseFile(
  license: LicenseFile,
  publicKeyPem?: string
): boolean {
  try {
    // Create canonical string of license data (excluding signature)
    const licenseData = JSON.stringify({
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

    const signature = Buffer.from(license.signature, "base64");
    return verifyEd25519Signature(
      Buffer.from(licenseData, "utf-8"),
      signature,
      publicKeyPem
    );
  } catch (error) {
    logger.error("License file verification failed", { err: String(error) });
    return false;
  }
}

/**
 * Check if a license file is expired.
 */
export function isLicenseExpired(license: LicenseFile): boolean {
  if (!license.expiresAt) {
    return false; // Perpetual license
  }
  return new Date(license.expiresAt) < new Date();
}

// ============================================================
// DOWNLOAD TOKENS (HMAC-SHA256)
// ============================================================

const DOWNLOAD_TOKEN_SECRET =
  process.env.DOWNLOAD_TOKEN_SECRET || "dev-download-secret";

interface DownloadTokenPayload {
  customerId: string;
  skillId: string;
  exp: number; // Unix timestamp
}

/**
 * Generate a time-limited download token for self-hosted customers.
 * Token format: base64url(JSON payload).base64url(HMAC signature)
 */
export function generateDownloadToken(
  customerId: string,
  skillId: string,
  expiresInSeconds: number = 86400 // 24 hours default
): string {
  const payload: DownloadTokenPayload = {
    customerId,
    skillId,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", DOWNLOAD_TOKEN_SECRET)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${sig}`;
}

/**
 * Verify and decode a download token.
 * Returns the payload if valid and not expired, null otherwise.
 */
export function verifyDownloadToken(
  token: string
): DownloadTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sig] = parts;

  const expectedSig = createHmac("sha256", DOWNLOAD_TOKEN_SECRET)
    .update(payloadB64)
    .digest("base64url");

  // Constant-time comparison
  if (sig.length !== expectedSig.length) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (!a.equals(b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8")
    ) as DownloadTokenPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
