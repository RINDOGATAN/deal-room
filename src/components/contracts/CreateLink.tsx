"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { signInHref } from "@/lib/sign-in-next";
import { useSignedIn } from "@/components/public/use-signed-in";

/**
 * "Create it in Dealroom": the new-deal wizard with the contract type as
 * its search (`/deals/new?q=NDA`); a visitor signs in first and lands there.
 * The public pages ask the session endpoint (useSignedIn), not next-auth.
 */
export function CreateLink({
  contractType,
  label,
  className,
}: {
  contractType: string;
  label: string;
  className?: string;
}) {
  const signedIn = useSignedIn();
  const wizard = `/deals/new?q=${encodeURIComponent(contractType)}`;
  return (
    <Link href={signedIn ? wizard : signInHref(wizard)} className={className}>
      {label}
      <ArrowRight className="w-4 h-4" aria-hidden />
    </Link>
  );
}
