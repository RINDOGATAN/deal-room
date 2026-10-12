// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The e-mail policy's one calm sentence (email-policy.ts), shown under an
 * e-mail field, plus the check that recognises the server's refusal.
 */

import { BLOCKED_EMAIL_MESSAGE_KEY } from "@/lib/email-policy";

/** True when a tRPC error is the e-mail policy's refusal (data.messageKey). */
export function isEmailPolicyError(error: unknown): boolean {
  const data = (error as { data?: { messageKey?: string | null } } | null)?.data;
  return data?.messageKey === BLOCKED_EMAIL_MESSAGE_KEY;
}

export function EmailPolicyError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-danger">
      {message}
    </p>
  );
}
