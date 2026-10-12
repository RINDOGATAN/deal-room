"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { SessionProvider } from "next-auth/react";

/**
 * The next-auth session, for the app's sections (AppSection). The public
 * pages do not load it: their header asks the session endpoint directly
 * (PublicHeader; page speed).
 */
export function SessionProviders({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
