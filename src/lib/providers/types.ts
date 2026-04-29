/**
 * Provider Interfaces — Layer 5: Integration Hub
 *
 * Abstract interfaces for signing, document storage, and CRM integration.
 * The AGPL repo ships only local/built-in implementations.
 * The interfaces are extensible: additional implementations can be added
 * without changing call sites.
 */

// ---------------------------------------------------------------------------
// Signing Provider
// ---------------------------------------------------------------------------

export interface SignatureRequest {
  dealRoomId: string;
  externalId: string;
  parties: Array<{
    role: "INITIATOR" | "RESPONDENT";
    email: string;
    name: string;
  }>;
  documentTitle: string;
}

export interface SignatureEvent {
  partyRole: "INITIATOR" | "RESPONDENT";
  signature: string;
  signedAt: Date;
  signerIp?: string;
}

export interface SigningResult {
  externalId: string;
  status: "PENDING" | "PARTIALLY_SIGNED" | "COMPLETED" | "DECLINED";
  documentUrl?: string;
}

export interface ISigningProvider {
  /** Unique identifier for this provider (e.g. "type-to-sign") */
  readonly id: string;
  /** Human-readable display name */
  readonly displayName: string;
  /** Whether this provider produces legally qualified e-signatures */
  readonly qualifiedSignatures: boolean;

  /** Create a signing request with the provider */
  createRequest(request: SignatureRequest): Promise<SigningResult>;

  /** Record an individual signature */
  recordSignature(
    externalId: string,
    event: SignatureEvent
  ): Promise<SigningResult>;

  /** Get the current status of a signing request */
  getStatus(externalId: string): Promise<SigningResult>;

  /** Generate a URL where a party can sign (for redirect-based providers) */
  getSigningUrl?(externalId: string, partyRole: string): Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Document Store
// ---------------------------------------------------------------------------

export interface StoredDocument {
  id: string;
  filename: string;
  mimeType: string;
  url: string;
  size: number;
  storedAt: Date;
  metadata?: Record<string, string>;
}

export interface IDocumentStore {
  /** Unique identifier for this store (e.g. "local", "sharepoint", "google-drive") */
  readonly id: string;
  readonly displayName: string;

  /** Store a signed document */
  store(params: {
    dealRoomId: string;
    filename: string;
    mimeType: string;
    buffer: Buffer;
    metadata?: Record<string, string>;
  }): Promise<StoredDocument>;

  /** Retrieve a stored document */
  retrieve(documentId: string): Promise<Buffer | null>;

  /** List documents for a deal */
  list(dealRoomId: string): Promise<StoredDocument[]>;
}

// ---------------------------------------------------------------------------
// CRM Connector
// ---------------------------------------------------------------------------

export interface CrmDealRecord {
  externalId: string;
  name: string;
  status: string;
  url?: string;
}

export interface ICrmConnector {
  /** Unique identifier for this connector (e.g. "salesforce", "hubspot") */
  readonly id: string;
  readonly displayName: string;

  /** Create or update a deal record in the CRM */
  syncDeal(params: {
    dealRoomId: string;
    dealName: string;
    contractType: string;
    status: string;
    parties: Array<{ email: string; name: string; company?: string }>;
  }): Promise<CrmDealRecord>;

  /** Get the linked CRM record for a deal */
  getLinkedRecord(dealRoomId: string): Promise<CrmDealRecord | null>;
}
