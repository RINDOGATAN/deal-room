/**
 * Entitlement Service
 *
 * Manages license entitlements - what skills a customer has access to,
 * what jurisdictions they can use, and their activation status.
 *
 * Supports:
 * - Cloud licenses (SaaS customers, validated via API)
 * - Offline licenses (self-hosted, validated via cryptographic signature)
 * - Trial licenses (time-limited evaluation)
 */

import { prisma } from "@/lib/prisma";
import {
  verifyLicenseFile,
  isLicenseExpired,
  LicenseFile,
  isValidLicenseKeyFormat,
} from "@/lib/crypto";
import { getMachineInfo } from "./fingerprint";

export interface EntitlementCheckResult {
  entitled: boolean;
  reason?: string;
  entitlementId?: string;
  licenseType?: "TRIAL" | "SUBSCRIPTION" | "PERPETUAL";
  jurisdictions?: string[];
  expiresAt?: Date;
}

export interface CustomerEntitlement {
  skillId: string;
  skillName: string;
  displayName: string;
  licenseType: "TRIAL" | "SUBSCRIPTION" | "PERPETUAL";
  status: "ACTIVE" | "EXPIRED" | "SUSPENDED";
  jurisdictions: string[];
  expiresAt: Date | null;
  activationCount: number;
  maxActivations: number;
}

/**
 * Check if a customer is entitled to use a specific skill.
 */
export async function checkEntitlement(
  customerId: string,
  skillId: string,
  jurisdiction?: string
): Promise<EntitlementCheckResult> {
  // Find the skill package
  const skillPackage = await prisma.skillPackage.findUnique({
    where: { skillId },
  });

  if (!skillPackage) {
    return { entitled: false, reason: "Skill package not found" };
  }

  // Find the entitlement
  const entitlement = await prisma.skillEntitlement.findUnique({
    where: {
      customerId_skillPackageId: {
        customerId,
        skillPackageId: skillPackage.id,
      },
    },
    include: {
      _count: { select: { activations: true } },
    },
  });

  if (!entitlement) {
    return { entitled: false, reason: "No entitlement found for this skill" };
  }

  // Check status
  if (entitlement.status === "SUSPENDED") {
    return { entitled: false, reason: "License has been suspended" };
  }

  if (entitlement.status === "EXPIRED") {
    return { entitled: false, reason: "License has expired" };
  }

  // Check expiration
  if (entitlement.expiresAt && entitlement.expiresAt < new Date()) {
    // Update status to expired
    await prisma.skillEntitlement.update({
      where: { id: entitlement.id },
      data: { status: "EXPIRED" },
    });
    return { entitled: false, reason: "License has expired" };
  }

  // Check jurisdiction if specified
  if (jurisdiction && !entitlement.jurisdictions.includes(jurisdiction)) {
    return {
      entitled: false,
      reason: `Jurisdiction "${jurisdiction}" not included in license`,
      jurisdictions: entitlement.jurisdictions,
    };
  }

  return {
    entitled: true,
    entitlementId: entitlement.id,
    licenseType: entitlement.licenseType,
    jurisdictions: entitlement.jurisdictions,
    expiresAt: entitlement.expiresAt || undefined,
  };
}

/**
 * Check entitlement by license key (for activation).
 */
export async function checkEntitlementByLicenseKey(
  licenseKey: string
): Promise<EntitlementCheckResult> {
  if (!isValidLicenseKeyFormat(licenseKey)) {
    return { entitled: false, reason: "Invalid license key format" };
  }

  const entitlement = await prisma.skillEntitlement.findUnique({
    where: { licenseKey },
    include: {
      skillPackage: true,
      customer: true,
      _count: { select: { activations: true } },
    },
  });

  if (!entitlement) {
    return { entitled: false, reason: "License key not found" };
  }

  if (entitlement.status === "SUSPENDED") {
    return { entitled: false, reason: "License has been suspended" };
  }

  if (entitlement.status === "EXPIRED") {
    return { entitled: false, reason: "License has expired" };
  }

  if (entitlement.expiresAt && entitlement.expiresAt < new Date()) {
    return { entitled: false, reason: "License has expired" };
  }

  return {
    entitled: true,
    entitlementId: entitlement.id,
    licenseType: entitlement.licenseType,
    jurisdictions: entitlement.jurisdictions,
    expiresAt: entitlement.expiresAt || undefined,
  };
}

/**
 * Validate an offline license file.
 */
export async function validateOfflineLicense(
  licenseFile: LicenseFile
): Promise<EntitlementCheckResult> {
  // Verify signature
  if (!verifyLicenseFile(licenseFile)) {
    return { entitled: false, reason: "Invalid license file signature" };
  }

  // Check expiration
  if (isLicenseExpired(licenseFile)) {
    return { entitled: false, reason: "License has expired" };
  }

  // For offline licenses, we trust the signed license file
  return {
    entitled: true,
    licenseType: licenseFile.licenseType,
    jurisdictions: licenseFile.jurisdictions,
    expiresAt: licenseFile.expiresAt ? new Date(licenseFile.expiresAt) : undefined,
  };
}

/**
 * Get all entitlements for a customer.
 */
export async function getCustomerEntitlements(
  customerId: string
): Promise<CustomerEntitlement[]> {
  const entitlements = await prisma.skillEntitlement.findMany({
    where: { customerId },
    include: {
      skillPackage: true,
      _count: { select: { activations: true } },
    },
  });

  return entitlements.map((e) => ({
    skillId: e.skillPackage.skillId,
    skillName: e.skillPackage.name,
    displayName: e.skillPackage.displayName,
    licenseType: e.licenseType,
    status: e.status,
    jurisdictions: e.jurisdictions,
    expiresAt: e.expiresAt,
    activationCount: e._count.activations,
    maxActivations: e.maxActivations,
  }));
}

/**
 * Create a new entitlement (admin operation).
 */
export async function createEntitlement(params: {
  customerId: string;
  skillId: string;
  licenseKey: string;
  licenseType: "TRIAL" | "SUBSCRIPTION" | "PERPETUAL";
  maxActivations?: number;
  jurisdictions: string[];
  expiresAt?: Date;
}) {
  const skillPackage = await prisma.skillPackage.findUnique({
    where: { skillId: params.skillId },
  });

  if (!skillPackage) {
    throw new Error(`Skill package not found: ${params.skillId}`);
  }

  // Validate jurisdictions are available in the skill
  const invalidJurisdictions = params.jurisdictions.filter(
    (j) => !skillPackage.jurisdictions.includes(j)
  );
  if (invalidJurisdictions.length > 0) {
    throw new Error(
      `Invalid jurisdictions: ${invalidJurisdictions.join(", ")}. ` +
        `Available: ${skillPackage.jurisdictions.join(", ")}`
    );
  }

  return prisma.skillEntitlement.create({
    data: {
      customerId: params.customerId,
      skillPackageId: skillPackage.id,
      licenseKey: params.licenseKey,
      licenseType: params.licenseType,
      maxActivations: params.maxActivations || 1,
      jurisdictions: params.jurisdictions,
      expiresAt: params.expiresAt,
      status: "ACTIVE",
    },
    include: {
      skillPackage: true,
      customer: true,
    },
  });
}

/**
 * Suspend an entitlement (admin operation).
 */
export async function suspendEntitlement(entitlementId: string): Promise<void> {
  await prisma.skillEntitlement.update({
    where: { id: entitlementId },
    data: { status: "SUSPENDED" },
  });

  // Also deactivate all activations
  await prisma.skillActivation.deleteMany({
    where: { entitlementId },
  });
}

/**
 * Reactivate a suspended entitlement (admin operation).
 */
export async function reactivateEntitlement(entitlementId: string): Promise<void> {
  const entitlement = await prisma.skillEntitlement.findUnique({
    where: { id: entitlementId },
  });

  if (!entitlement) {
    throw new Error("Entitlement not found");
  }

  // Check if expired
  if (entitlement.expiresAt && entitlement.expiresAt < new Date()) {
    throw new Error("Cannot reactivate expired entitlement");
  }

  await prisma.skillEntitlement.update({
    where: { id: entitlementId },
    data: { status: "ACTIVE" },
  });
}

/**
 * Update entitlement jurisdictions (admin operation).
 */
export async function updateEntitlementJurisdictions(
  entitlementId: string,
  jurisdictions: string[]
): Promise<void> {
  const entitlement = await prisma.skillEntitlement.findUnique({
    where: { id: entitlementId },
    include: { skillPackage: true },
  });

  if (!entitlement) {
    throw new Error("Entitlement not found");
  }

  // Validate jurisdictions
  const invalidJurisdictions = jurisdictions.filter(
    (j) => !entitlement.skillPackage.jurisdictions.includes(j)
  );
  if (invalidJurisdictions.length > 0) {
    throw new Error(`Invalid jurisdictions: ${invalidJurisdictions.join(", ")}`);
  }

  await prisma.skillEntitlement.update({
    where: { id: entitlementId },
    data: { jurisdictions },
  });
}

/**
 * Check if customer has entitlement for creating a deal with specific template and jurisdiction.
 */
export async function checkDealCreationEntitlement(
  customerId: string,
  contractType: string,
  jurisdiction: string
): Promise<EntitlementCheckResult> {
  // Find the contract template
  const template = await prisma.contractTemplate.findUnique({
    where: { contractType },
    include: { skillPackage: true },
  });

  if (!template) {
    return { entitled: false, reason: "Contract template not found" };
  }

  // If no skill package linked, it's a free/open template
  if (!template.skillPackageId || !template.skillPackage) {
    return { entitled: true, reason: "Free template" };
  }

  // Check entitlement for the skill
  return checkEntitlement(customerId, template.skillPackage.skillId, jurisdiction);
}
