// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The scopes of the agent API (`requireScope` in the /api/v1/agent routes),
 * as the agent card publishes them. A key a person creates for themselves
 * under Settings, API keys carries all of these. The Experts API scopes
 * (`experts:read`, `experts:contact`) are not part of the agent API and stay
 * with keys issued by a platform administrator.
 */
export const AGENT_API_SCOPES = [
  { name: "templates:read", description: "List and view contract templates" },
  { name: "playbook:read", description: "List and view playbooks" },
  { name: "playbook:write", description: "Create, update, delete playbooks" },
  { name: "negotiate", description: "Initiate and join negotiations" },
  { name: "deals:read", description: "View deals and download documents" },
  { name: "billing:read", description: "View the customer's credit balance and buy credit packs" },
  { name: "webhooks:manage", description: "Manage webhook endpoints" },
  { name: "disputes:create", description: "Escalate failed/agreed deals to Gavel ADR" },
] as const;

export const SELF_SERVICE_SCOPES: string[] = AGENT_API_SCOPES.map((s) => s.name);

/** Active keys one customer account may hold at once (self-service). */
export const MAX_ACTIVE_KEYS_PER_CUSTOMER = 5;

/** Where a signed-in person creates and revokes their keys. */
export const API_KEYS_SETTINGS_PATH = "/settings/api-keys";
