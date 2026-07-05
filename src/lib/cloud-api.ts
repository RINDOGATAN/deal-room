/**
 * Cloud API Gateway — "Dealroom Play Services"
 *
 * Single entry point for all proprietary service calls.
 * Every method returns a typed "degraded" response when
 * DEALROOM_CLOUD_API_KEY is not set — the app never crashes,
 * just becomes visibly inferior.
 */

import { createLogger } from "@/lib/logger";

const logger = createLogger("cloud-api");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BiasOverrides {
  /** Map of clauseTemplateId → { biasPartyA, biasPartyB } per option */
  [clauseTemplateId: string]: {
    [optionId: string]: { biasPartyA: number; biasPartyB: number };
  };
}

export interface ClauseConflict {
  clauseIds: [string, string];
  severity: "warning" | "error";
  message: string;
  messageEs?: string;
}

export interface ValidationResult {
  conflicts: ClauseConflict[];
  validated: boolean;
}

export interface QualityScore {
  optionId: string;
  score: number | null; // 0-100, null = unverified
  label: string; // e.g. "Excellent", "Good", "Unverified"
}

export interface CertificationCeremony {
  ceremonyId: string;
  documentHash: string;
  certified: boolean;
}

export interface SignatureRecord {
  ceremonyId: string;
  partyRole: "INITIATOR" | "RESPONDENT";
  timestamp: string; // RFC 3161 timestamp
  certified: boolean;
}

export interface CertificationResult {
  ceremonyId: string;
  documentHash: string;
  timestamps: Array<{
    partyRole: string;
    rfc3161Timestamp: string;
    signedAt: string;
    signerIp?: string;
  }>;
  auditCertificateUrl?: string;
  verificationUrl?: string;
  certified: boolean;
}

export interface SatisfactionPrediction {
  predictedSatisfactionA: number;
  predictedSatisfactionB: number;
  confidence: number; // 0-1
  predicted: boolean;
}

// ---------------------------------------------------------------------------
// Degraded responses (no API key)
// ---------------------------------------------------------------------------

const DEGRADED_BIASES: BiasOverrides = {};

const DEGRADED_VALIDATION: ValidationResult = {
  conflicts: [],
  validated: false,
};

const DEGRADED_CERTIFICATION: CertificationCeremony = {
  ceremonyId: "",
  documentHash: "",
  certified: false,
};

const DEGRADED_SIGNATURE: SignatureRecord = {
  ceremonyId: "",
  partyRole: "INITIATOR",
  timestamp: "",
  certified: false,
};

const DEGRADED_CERTIFICATION_RESULT: CertificationResult = {
  ceremonyId: "",
  documentHash: "",
  timestamps: [],
  certified: false,
};

const DEGRADED_PREDICTION: SatisfactionPrediction = {
  predictedSatisfactionA: 0,
  predictedSatisfactionB: 0,
  confidence: 0,
  predicted: false,
};

// ---------------------------------------------------------------------------
// Gateway
// ---------------------------------------------------------------------------

class CloudApiGateway {
  private apiKey: string | undefined;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.DEALROOM_CLOUD_API_KEY;
    this.baseUrl =
      process.env.DEALROOM_CLOUD_API_URL || "https://api.todo.law/v1";
  }

  get isAvailable(): boolean {
    return !!this.apiKey;
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<T | null> {
    if (!this.apiKey) return null;

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: options.method || "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!res.ok) {
        logger.error(`${path} failed`, {
          status: res.status,
          statusText: res.statusText,
        });
        return null;
      }

      return (await res.json()) as T;
    } catch (err) {
      logger.error(`${path} error`, { err: String(err) });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Layer 2: Cloud Clause Intelligence
  // -------------------------------------------------------------------------

  /**
   * Fetch data-driven bias weights for a contract type + jurisdiction.
   * Falls back to empty overrides (static JSON biases used instead).
   */
  async getDynamicBiases(
    contractType: string,
    jurisdiction: string
  ): Promise<BiasOverrides> {
    const result = await this.request<BiasOverrides>(
      `/intelligence/biases?contractType=${encodeURIComponent(contractType)}&jurisdiction=${encodeURIComponent(jurisdiction)}`
    );
    return result ?? DEGRADED_BIASES;
  }

  /**
   * Validate that agreed clause combinations don't create legal contradictions.
   * Returns empty conflicts array in degraded mode.
   */
  async validateCompliance(agreedClauses: {
    contractType: string;
    jurisdiction: string;
    clauses: Array<{
      clauseId: string;
      optionId: string;
      optionLabel: string;
    }>;
  }): Promise<ValidationResult> {
    const result = await this.request<ValidationResult>(
      "/intelligence/validate",
      { method: "POST", body: agreedClauses }
    );
    return result ?? DEGRADED_VALIDATION;
  }

  /**
   * Get quality scores for clause options.
   * Returns null scores ("Unverified") in degraded mode.
   */
  async scoreClauseQuality(
    contractType: string,
    jurisdiction: string,
    clauseId: string,
    optionIds: string[]
  ): Promise<QualityScore[]> {
    const result = await this.request<QualityScore[]>(
      "/intelligence/quality",
      {
        method: "POST",
        body: { contractType, jurisdiction, clauseId, optionIds },
      }
    );
    return (
      result ??
      optionIds.map((id) => ({ optionId: id, score: null, label: "Unverified" }))
    );
  }

  /**
   * Predict satisfaction outcome before submitting.
   * Returns zero-confidence prediction in degraded mode.
   */
  async predictSatisfaction(params: {
    contractType: string;
    jurisdiction: string;
    selections: Array<{
      clauseId: string;
      partyAOptionId: string;
      partyBOptionId: string;
      partyAPriority: number;
      partyBPriority: number;
    }>;
  }): Promise<SatisfactionPrediction> {
    const result = await this.request<SatisfactionPrediction>(
      "/intelligence/predict",
      { method: "POST", body: params }
    );
    return result ?? DEGRADED_PREDICTION;
  }

  // -------------------------------------------------------------------------
  // Layer 1: Document Certification
  // -------------------------------------------------------------------------

  /**
   * Begin a signing ceremony — hashes the document and registers it.
   * Returns uncertified result in degraded mode.
   */
  async certifyDocument(params: {
    dealRoomId: string;
    documentHash: string;
    contractType: string;
    parties: Array<{ role: string; email: string; name: string }>;
  }): Promise<CertificationCeremony> {
    const result = await this.request<CertificationCeremony>(
      "/certification/ceremony",
      { method: "POST", body: params }
    );
    return result ?? DEGRADED_CERTIFICATION;
  }

  /**
   * Record an individual signature with RFC 3161 timestamping.
   * Returns uncertified result in degraded mode.
   */
  async recordSignature(params: {
    ceremonyId: string;
    partyRole: "INITIATOR" | "RESPONDENT";
    signerEmail: string;
    signerName: string;
    signerIp?: string;
  }): Promise<SignatureRecord> {
    if (!params.ceremonyId) return DEGRADED_SIGNATURE;

    const result = await this.request<SignatureRecord>(
      "/certification/signature",
      { method: "POST", body: params }
    );
    return result ?? { ...DEGRADED_SIGNATURE, partyRole: params.partyRole };
  }

  /**
   * Fetch the full certification result (after both parties have signed).
   * Returns uncertified result in degraded mode.
   */
  async getCertification(
    ceremonyId: string
  ): Promise<CertificationResult> {
    if (!ceremonyId) return DEGRADED_CERTIFICATION_RESULT;

    const result = await this.request<CertificationResult>(
      `/certification/ceremony/${encodeURIComponent(ceremonyId)}`
    );
    return result ?? DEGRADED_CERTIFICATION_RESULT;
  }

  // -------------------------------------------------------------------------
  // Layer 4: Analytics & Intelligence
  // -------------------------------------------------------------------------

  /**
   * Get negotiation benchmarks for a contract type.
   * Returns null in degraded mode (teaser data generated client-side).
   */
  async getBenchmarks(contractType: string): Promise<NegotiationBenchmarks | null> {
    return this.request<NegotiationBenchmarks>(
      `/analytics/benchmarks?contractType=${encodeURIComponent(contractType)}`
    );
  }

  /**
   * Get clause popularity stats across all deals of a given type.
   * Returns null in degraded mode.
   */
  async getClausePopularity(
    contractType: string,
    jurisdiction: string
  ): Promise<ClausePopularity[] | null> {
    return this.request<ClausePopularity[]>(
      `/analytics/clause-popularity?contractType=${encodeURIComponent(contractType)}&jurisdiction=${encodeURIComponent(jurisdiction)}`
    );
  }

  /**
   * Get deal activity summary for the current user/organization.
   * Returns null in degraded mode.
   */
  async getDealActivity(organizationId?: string): Promise<DealActivity | null> {
    const qs = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : "";
    return this.request<DealActivity>(`/analytics/activity${qs}`);
  }
}

// ---------------------------------------------------------------------------
// Analytics types
// ---------------------------------------------------------------------------

export interface NegotiationBenchmarks {
  contractType: string;
  avgRounds: number;
  medianRounds: number;
  avgDaysToComplete: number;
  avgSatisfactionA: number;
  avgSatisfactionB: number;
  totalDeals: number;
}

export interface ClausePopularity {
  clauseId: string;
  clauseTitle: string;
  options: Array<{
    optionId: string;
    optionLabel: string;
    percentage: number;
  }>;
}

export interface DealActivity {
  totalDeals: number;
  completedDeals: number;
  activeDeals: number;
  avgCompletionDays: number;
  dealsByType: Array<{ contractType: string; count: number }>;
  dealsByMonth: Array<{ month: string; count: number }>;
}

// Singleton
export const cloudApi = new CloudApiGateway();
