/**
 * Activation Service
 *
 * Manages skill license activations - the binding of a license to a specific
 * machine/installation. Supports both online and offline activation.
 *
 * Activation limits prevent license sharing while allowing legitimate reinstalls.
 */

import { prisma } from "@/lib/prisma";
import {
  verifyLicenseFile,
  isLicenseExpired,
  LicenseFile,
  isValidLicenseKeyFormat,
} from "@/lib/crypto";
import { getMachineInfo, validateFingerprint, FingerprintData, getFingerprintData } from "./fingerprint";
import { checkEntitlementByLicenseKey } from "./entitlement";

export interface ActivationResult {
  success: boolean;
  error?: string;
  activationId?: string;
  skillId?: string;
  skillName?: string;
  jurisdictions?: string[];
  expiresAt?: Date;
}

export interface DeactivationResult {
  success: boolean;
  error?: string;
}

export interface ActivationInfo {
  activationId: string;
  instanceId: string;
  machineHash: string;
  activatedAt: Date;
  lastSeenAt: Date;
  skillId: string;
  skillName: string;
}

/**
 * Activate a license key on this machine.
 */
export async function activateLicense(
  licenseKey: string,
  customerId: string
): Promise<ActivationResult> {
  // Validate license key format
  if (!isValidLicenseKeyFormat(licenseKey)) {
    return { success: false, error: "Invalid license key format" };
  }

  // Check entitlement
  const entitlementCheck = await checkEntitlementByLicenseKey(licenseKey);
  if (!entitlementCheck.entitled) {
    return { success: false, error: entitlementCheck.reason };
  }

  // Get machine info
  const machineInfo = getMachineInfo();

  // Find the entitlement
  const entitlement = await prisma.skillEntitlement.findUnique({
    where: { licenseKey },
    include: {
      skillPackage: true,
      activations: true,
      customer: true,
    },
  });

  if (!entitlement) {
    return { success: false, error: "Entitlement not found" };
  }

  // Verify customer ID matches
  if (entitlement.customerId !== customerId) {
    return { success: false, error: "License key does not belong to this customer" };
  }

  // Check if already activated on this machine
  const existingActivation = entitlement.activations.find(
    (a) => a.instanceId === machineInfo.instanceId
  );

  if (existingActivation) {
    // Update last seen and return success
    await prisma.skillActivation.update({
      where: { id: existingActivation.id },
      data: { lastSeenAt: new Date() },
    });

    return {
      success: true,
      activationId: existingActivation.id,
      skillId: entitlement.skillPackage.skillId,
      skillName: entitlement.skillPackage.displayName,
      jurisdictions: entitlement.jurisdictions,
      expiresAt: entitlement.expiresAt || undefined,
    };
  }

  // Check activation limit
  if (entitlement.activations.length >= entitlement.maxActivations) {
    return {
      success: false,
      error: `Activation limit reached (${entitlement.maxActivations}). ` +
        "Please deactivate another installation first.",
    };
  }

  // Create new activation
  const activation = await prisma.skillActivation.create({
    data: {
      entitlementId: entitlement.id,
      customerId: entitlement.customerId,
      instanceId: machineInfo.instanceId,
      machineHash: machineInfo.fingerprint,
    },
  });

  return {
    success: true,
    activationId: activation.id,
    skillId: entitlement.skillPackage.skillId,
    skillName: entitlement.skillPackage.displayName,
    jurisdictions: entitlement.jurisdictions,
    expiresAt: entitlement.expiresAt || undefined,
  };
}

/**
 * Deactivate a license on this machine.
 */
export async function deactivateLicense(
  licenseKey: string,
  customerId: string
): Promise<DeactivationResult> {
  // Get machine info
  const machineInfo = getMachineInfo();

  // Find the entitlement
  const entitlement = await prisma.skillEntitlement.findUnique({
    where: { licenseKey },
    include: { activations: true },
  });

  if (!entitlement) {
    return { success: false, error: "License key not found" };
  }

  if (entitlement.customerId !== customerId) {
    return { success: false, error: "License key does not belong to this customer" };
  }

  // Find activation for this machine
  const activation = entitlement.activations.find(
    (a) => a.instanceId === machineInfo.instanceId
  );

  if (!activation) {
    return { success: false, error: "No activation found for this machine" };
  }

  // Delete the activation
  await prisma.skillActivation.delete({
    where: { id: activation.id },
  });

  return { success: true };
}

/**
 * Deactivate a specific activation by ID (admin or remote deactivation).
 */
export async function deactivateById(
  activationId: string,
  customerId: string
): Promise<DeactivationResult> {
  const activation = await prisma.skillActivation.findUnique({
    where: { id: activationId },
  });

  if (!activation) {
    return { success: false, error: "Activation not found" };
  }

  if (activation.customerId !== customerId) {
    return { success: false, error: "Activation does not belong to this customer" };
  }

  await prisma.skillActivation.delete({
    where: { id: activationId },
  });

  return { success: true };
}

/**
 * Activate using an offline license file.
 */
export async function activateOffline(
  licenseFile: LicenseFile,
  customerId: string
): Promise<ActivationResult> {
  // Verify signature
  if (!verifyLicenseFile(licenseFile)) {
    return { success: false, error: "Invalid license file signature" };
  }

  // Check expiration
  if (isLicenseExpired(licenseFile)) {
    return { success: false, error: "License file has expired" };
  }

  // Verify customer ID
  if (licenseFile.customerId !== customerId) {
    return { success: false, error: "License file does not belong to this customer" };
  }

  // Get machine info
  const machineInfo = getMachineInfo();

  // Find or create entitlement from license file
  // In offline mode, we may need to create the entitlement record
  let entitlement = await prisma.skillEntitlement.findUnique({
    where: { licenseKey: licenseFile.licenseKey },
    include: {
      skillPackage: true,
      activations: true,
    },
  });

  if (!entitlement) {
    // Find skill package
    const skillPackage = await prisma.skillPackage.findUnique({
      where: { skillId: licenseFile.skillId },
    });

    if (!skillPackage) {
      return { success: false, error: "Skill package not installed" };
    }

    // Create entitlement from license file
    entitlement = await prisma.skillEntitlement.create({
      data: {
        customerId: licenseFile.customerId,
        skillPackageId: skillPackage.id,
        licenseKey: licenseFile.licenseKey,
        licenseType: licenseFile.licenseType,
        maxActivations: licenseFile.maxActivations,
        jurisdictions: licenseFile.jurisdictions,
        expiresAt: licenseFile.expiresAt ? new Date(licenseFile.expiresAt) : null,
        status: "ACTIVE",
      },
      include: {
        skillPackage: true,
        activations: true,
      },
    });
  }

  // Check if already activated on this machine
  const existingActivation = entitlement.activations.find(
    (a) => a.instanceId === machineInfo.instanceId
  );

  if (existingActivation) {
    await prisma.skillActivation.update({
      where: { id: existingActivation.id },
      data: { lastSeenAt: new Date() },
    });

    return {
      success: true,
      activationId: existingActivation.id,
      skillId: entitlement.skillPackage.skillId,
      skillName: entitlement.skillPackage.displayName,
      jurisdictions: entitlement.jurisdictions,
      expiresAt: entitlement.expiresAt || undefined,
    };
  }

  // Check activation limit
  if (entitlement.activations.length >= entitlement.maxActivations) {
    return {
      success: false,
      error: `Activation limit reached (${entitlement.maxActivations})`,
    };
  }

  // Create activation
  const activation = await prisma.skillActivation.create({
    data: {
      entitlementId: entitlement.id,
      customerId: entitlement.customerId,
      instanceId: machineInfo.instanceId,
      machineHash: machineInfo.fingerprint,
    },
  });

  return {
    success: true,
    activationId: activation.id,
    skillId: entitlement.skillPackage.skillId,
    skillName: entitlement.skillPackage.displayName,
    jurisdictions: entitlement.jurisdictions,
    expiresAt: entitlement.expiresAt || undefined,
  };
}

/**
 * Check if a skill is activated on this machine.
 */
export async function isActivated(
  skillId: string,
  customerId: string
): Promise<boolean> {
  const machineInfo = getMachineInfo();

  const skillPackage = await prisma.skillPackage.findUnique({
    where: { skillId },
  });

  if (!skillPackage) {
    return false;
  }

  const activation = await prisma.skillActivation.findFirst({
    where: {
      customerId,
      instanceId: machineInfo.instanceId,
      entitlement: {
        skillPackageId: skillPackage.id,
        status: "ACTIVE",
      },
    },
  });

  return !!activation;
}

/**
 * Get all activations for a customer.
 */
export async function getCustomerActivations(
  customerId: string
): Promise<ActivationInfo[]> {
  const activations = await prisma.skillActivation.findMany({
    where: { customerId },
    include: {
      entitlement: {
        include: { skillPackage: true },
      },
    },
  });

  return activations.map((a) => ({
    activationId: a.id,
    instanceId: a.instanceId,
    machineHash: a.machineHash,
    activatedAt: a.activatedAt,
    lastSeenAt: a.lastSeenAt,
    skillId: a.entitlement.skillPackage.skillId,
    skillName: a.entitlement.skillPackage.displayName,
  }));
}

/**
 * Update last seen timestamp for an activation.
 * Called periodically to track active installations.
 */
export async function heartbeat(
  skillId: string,
  customerId: string
): Promise<boolean> {
  const machineInfo = getMachineInfo();

  const skillPackage = await prisma.skillPackage.findUnique({
    where: { skillId },
  });

  if (!skillPackage) {
    return false;
  }

  const result = await prisma.skillActivation.updateMany({
    where: {
      customerId,
      instanceId: machineInfo.instanceId,
      entitlement: {
        skillPackageId: skillPackage.id,
      },
    },
    data: { lastSeenAt: new Date() },
  });

  return result.count > 0;
}

/**
 * Generate fingerprint data for offline activation request.
 */
export function getActivationRequest(): FingerprintData {
  return getFingerprintData();
}
