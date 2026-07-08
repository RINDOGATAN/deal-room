// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Provider Registry
 *
 * Central registry for all provider implementations.
 * The AGPL core ships with local providers only.
 * Proprietary connectors register themselves via this module.
 */

export type { ISigningProvider, IDocumentStore, ICrmConnector } from "./types";
export type {
  SignatureRequest,
  SignatureEvent,
  SigningResult,
  StoredDocument,
  CrmDealRecord,
} from "./types";

import type { ISigningProvider, IDocumentStore, ICrmConnector } from "./types";
import { LocalSigningProvider } from "./local-signing";
import { LocalDocumentStore } from "./local-store";

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const signingProviders = new Map<string, ISigningProvider>();
const documentStores = new Map<string, IDocumentStore>();
const crmConnectors = new Map<string, ICrmConnector>();

// Register built-in providers
const localSigning = new LocalSigningProvider();
const localStore = new LocalDocumentStore();

signingProviders.set(localSigning.id, localSigning);
documentStores.set(localStore.id, localStore);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getSigningProvider(id?: string): ISigningProvider {
  if (id && signingProviders.has(id)) {
    return signingProviders.get(id)!;
  }
  // Default to type-to-sign
  return localSigning;
}

export function getDocumentStore(id?: string): IDocumentStore {
  if (id && documentStores.has(id)) {
    return documentStores.get(id)!;
  }
  return localStore;
}

export function getCrmConnector(id?: string): ICrmConnector | null {
  if (id && crmConnectors.has(id)) {
    return crmConnectors.get(id)!;
  }
  // No built-in CRM connector
  return null;
}

/** Register a proprietary signing provider */
export function registerSigningProvider(provider: ISigningProvider): void {
  signingProviders.set(provider.id, provider);
}

/** Register a proprietary document store */
export function registerDocumentStore(store: IDocumentStore): void {
  documentStores.set(store.id, store);
}

/** Register a proprietary CRM connector */
export function registerCrmConnector(connector: ICrmConnector): void {
  crmConnectors.set(connector.id, connector);
}

/** List all registered signing providers */
export function listSigningProviders(): ISigningProvider[] {
  return Array.from(signingProviders.values());
}

/** List all registered document stores */
export function listDocumentStores(): IDocumentStore[] {
  return Array.from(documentStores.values());
}

/** List all registered CRM connectors */
export function listCrmConnectors(): ICrmConnector[] {
  return Array.from(crmConnectors.values());
}
