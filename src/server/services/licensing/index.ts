/**
 * Licensing Services Index
 *
 * Re-exports all licensing functionality for easy imports.
 */

export {
  getMachineInfo,
  getPrimaryMacAddress,
  getOrCreateInstanceId,
  setInstanceId,
  getDisplayFingerprint,
  getFingerprintData,
  validateFingerprint,
  generateFingerprintRequest,
  type MachineInfo,
  type FingerprintData,
} from "./fingerprint";

export {
  checkEntitlement,
  checkEntitlementByLicenseKey,
  validateOfflineLicense,
  getCustomerEntitlements,
  createEntitlement,
  suspendEntitlement,
  reactivateEntitlement,
  updateEntitlementJurisdictions,
  checkDealCreationEntitlement,
  type EntitlementCheckResult,
  type CustomerEntitlement,
} from "./entitlement";

export {
  activateLicense,
  deactivateLicense,
  deactivateById,
  activateOffline,
  isActivated,
  getCustomerActivations,
  heartbeat,
  getActivationRequest,
  type ActivationResult,
  type DeactivationResult,
  type ActivationInfo,
} from "./activation";
