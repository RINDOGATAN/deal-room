/**
 * Cryptographic utilities for skill package verification and licensing.
 *
 * Uses Ed25519 for digital signatures (fast, secure, deterministic).
 * Uses SHA-256 for package hashing.
 */

import { createHash, createPublicKey, verify, randomBytes } from "crypto";

// Public key for verifying skill package signatures (Ed25519)
// In production, this would be embedded in the application or fetched from a secure source
const PUBLIC_KEY_PEM =
  process.env.SKILL_SIGNING_PUBLIC_KEY ||
  `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAPlaceholder_Replace_With_Real_Key_In_Production==
-----END PUBLIC KEY-----`;

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
    console.error("Signature verification failed:", error);
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
    console.error("License file verification failed:", error);
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
