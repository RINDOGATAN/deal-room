/**
 * Document Certification Client
 *
 * Wraps the Cloud API certification methods with document-level
 * hash computation. Provides a clean interface for the signing router.
 */

import { createHash } from "crypto";
import {
  cloudApi,
  type CertificationCeremony,
  type SignatureRecord,
  type CertificationResult,
} from "./cloud-api";
import type { ContractData } from "@/server/services/document/generator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CertificationData {
  ceremonyId: string;
  documentHash: string;
  certified: boolean;
  timestamps: Array<{
    partyRole: string;
    rfc3161Timestamp: string;
    signedAt: string;
    signerIp?: string;
  }>;
  verificationUrl?: string;
  auditCertificateUrl?: string;
}

// ---------------------------------------------------------------------------
// Hash computation
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic SHA-256 hash of the contract data.
 * Strips volatile fields (createdAt) and sorts keys for determinism.
 */
export function computeDocumentHash(data: ContractData): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class CertificationService {
  /**
   * Begin a signing ceremony — hash the document, register with the API.
   * Returns { certified: false } if the Cloud API is unavailable.
   */
  async beginCeremony(
    dealRoomId: string,
    contractData: ContractData
  ): Promise<CertificationCeremony> {
    const documentHash = computeDocumentHash(contractData);

    const parties = [
      {
        role: "INITIATOR",
        email: contractData.partyA.email,
        name: contractData.partyA.name,
      },
    ];
    if (contractData.partyB) {
      parties.push({
        role: "RESPONDENT",
        email: contractData.partyB.email,
        name: contractData.partyB.name,
      });
    }

    return cloudApi.certifyDocument({
      dealRoomId,
      documentHash,
      contractType: contractData.contractType,
      parties,
    });
  }

  /**
   * Record an individual party's signature with RFC 3161 timestamping.
   */
  async recordSignature(
    ceremonyId: string,
    partyRole: "INITIATOR" | "RESPONDENT",
    signerEmail: string,
    signerName: string,
    signerIp?: string
  ): Promise<SignatureRecord> {
    return cloudApi.recordSignature({
      ceremonyId,
      partyRole,
      signerEmail,
      signerName,
      signerIp,
    });
  }

  /**
   * Fetch the full certification result after signing is complete.
   */
  async getCertification(ceremonyId: string): Promise<CertificationResult> {
    return cloudApi.getCertification(ceremonyId);
  }

  /**
   * Build a CertificationData object suitable for embedding in documents.
   */
  async buildCertificationData(
    ceremonyId: string
  ): Promise<CertificationData> {
    const cert = await this.getCertification(ceremonyId);
    return {
      ceremonyId: cert.ceremonyId,
      documentHash: cert.documentHash,
      certified: cert.certified,
      timestamps: cert.timestamps,
      verificationUrl: cert.verificationUrl,
      auditCertificateUrl: cert.auditCertificateUrl,
    };
  }
}

export const certificationService = new CertificationService();
