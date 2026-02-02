/**
 * Machine Fingerprint Service
 *
 * Generates unique machine identifiers for license activation tracking.
 * Used to prevent license abuse while allowing legitimate reinstalls.
 *
 * For self-hosted/air-gapped deployments, the fingerprint enables offline
 * license validation without phoning home.
 */

import { hostname, networkInterfaces } from "os";
import { computeMachineFingerprint, generateInstanceId, sha256 } from "@/lib/crypto";

export interface MachineInfo {
  hostname: string;
  macAddress: string;
  platform: string;
  fingerprint: string;
  instanceId: string;
}

/**
 * Get the primary MAC address of the machine.
 * Prefers non-internal interfaces.
 */
export function getPrimaryMacAddress(): string {
  const interfaces = networkInterfaces();

  // Priority order for interface selection
  const priorities = ["eth0", "en0", "ens", "wlan0", "Wi-Fi", "Ethernet"];

  // Try priority interfaces first
  for (const priority of priorities) {
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (name.toLowerCase().startsWith(priority.toLowerCase())) {
        const addr = addrs?.find(
          (a) => !a.internal && a.mac && a.mac !== "00:00:00:00:00:00"
        );
        if (addr?.mac) {
          return addr.mac;
        }
      }
    }
  }

  // Fall back to any non-internal interface with a valid MAC
  for (const [, addrs] of Object.entries(interfaces)) {
    const addr = addrs?.find(
      (a) => !a.internal && a.mac && a.mac !== "00:00:00:00:00:00"
    );
    if (addr?.mac) {
      return addr.mac;
    }
  }

  // Last resort: return a placeholder that will be combined with hostname
  return "00:00:00:00:00:00";
}

/**
 * Generate machine information including fingerprint.
 */
export function getMachineInfo(): MachineInfo {
  const host = hostname();
  const mac = getPrimaryMacAddress();
  const platform = process.platform;
  const fingerprint = computeMachineFingerprint(host, mac);
  const instanceId = getOrCreateInstanceId();

  return {
    hostname: host,
    macAddress: mac,
    platform,
    fingerprint,
    instanceId,
  };
}

// Instance ID storage (in production, store in a config file)
let cachedInstanceId: string | null = null;

/**
 * Get or create a persistent instance ID.
 * This ID persists across restarts but is unique per installation.
 */
export function getOrCreateInstanceId(): string {
  if (cachedInstanceId) {
    return cachedInstanceId;
  }

  // Try to read from environment or config
  const envInstanceId = process.env.DEAL_ROOM_INSTANCE_ID;
  if (envInstanceId) {
    cachedInstanceId = envInstanceId;
    return cachedInstanceId;
  }

  // Generate a new one (in production, this would be persisted to disk)
  cachedInstanceId = generateInstanceId();
  return cachedInstanceId;
}

/**
 * Set the instance ID (used during initial setup).
 */
export function setInstanceId(id: string): void {
  cachedInstanceId = id;
}

/**
 * Generate a fingerprint for display to the user (for offline activation).
 * This is a human-readable format that can be sent to the license server.
 */
export function getDisplayFingerprint(): string {
  const info = getMachineInfo();

  // Create a shorter, display-friendly version
  const shortHash = info.fingerprint.substring(0, 16).toUpperCase();

  // Format as: XXXX-XXXX-XXXX-XXXX
  return shortHash.match(/.{4}/g)?.join("-") || shortHash;
}

/**
 * Generate fingerprint data for offline license request.
 */
export interface FingerprintData {
  fingerprint: string;
  displayFingerprint: string;
  instanceId: string;
  hostname: string;
  platform: string;
  timestamp: string;
}

export function getFingerprintData(): FingerprintData {
  const info = getMachineInfo();

  return {
    fingerprint: info.fingerprint,
    displayFingerprint: getDisplayFingerprint(),
    instanceId: info.instanceId,
    hostname: info.hostname,
    platform: info.platform,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate that a fingerprint matches the current machine.
 * Used for offline license validation.
 */
export function validateFingerprint(expectedFingerprint: string): boolean {
  const currentFingerprint = getMachineInfo().fingerprint;
  return currentFingerprint === expectedFingerprint;
}

/**
 * Generate a fingerprint request file for offline activation.
 * User can send this file to the license server to receive a license file.
 */
export function generateFingerprintRequest(
  customerId: string,
  skillId: string
): string {
  const data = getFingerprintData();

  const request = {
    type: "LICENSE_REQUEST",
    version: "1.0",
    customerId,
    skillId,
    machine: data,
  };

  return JSON.stringify(request, null, 2);
}
