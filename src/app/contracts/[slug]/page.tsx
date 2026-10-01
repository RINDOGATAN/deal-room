// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import type { Metadata } from "next";
import { ContractGuidePage } from "@/components/contracts/ContractGuidePage";
import { contractStaticParams, guideMetadata } from "@/components/contracts/routes";

// The language comes from the URL, not the visitor's cookie.
export const dynamic = "force-static";
export const dynamicParams = false;
export const generateStaticParams = contractStaticParams;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return guideMetadata("en", (await params).slug);
}

export default async function ContractGuide({ params }: Props) {
  return <ContractGuidePage slug={(await params).slug} locale="en" />;
}
