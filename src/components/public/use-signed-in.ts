"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useEffect, useState } from "react";

/**
 * Whether the visitor is signed in, for the public pages, from one request to
 * the session endpoint per page load (shared by every caller). The public
 * pages do not load the next-auth client (page speed); the
 * app's sections keep useSession under their SessionProvider.
 */
let pending: Promise<boolean> | null = null;

function fetchSignedIn(): Promise<boolean> {
  pending ??= fetch("/api/auth/session", { credentials: "include" })
    .then((r) => (r.ok ? r.json() : null))
    .then((s: { user?: unknown } | null) => Boolean(s?.user))
    .catch(() => false);
  return pending;
}

export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let live = true;
    fetchSignedIn().then((v) => {
      if (live) setSignedIn(v);
    });
    return () => {
      live = false;
    };
  }, []);
  return signedIn;
}
