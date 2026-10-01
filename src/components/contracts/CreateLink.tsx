"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight } from "lucide-react";
import { signInHref } from "@/lib/sign-in-next";

/**
 * "Create it in Dealroom": the new-deal wizard with the contract type as
 * its search (`/deals/new?q=NDA`); a visitor signs in first and lands there.
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
  const { status } = useSession();
  const wizard = `/deals/new?q=${encodeURIComponent(contractType)}`;
  return (
    <Link href={status === "authenticated" ? wizard : signInHref(wizard)} className={className}>
      {label}
      <ArrowRight className="w-4 h-4" aria-hidden />
    </Link>
  );
}
