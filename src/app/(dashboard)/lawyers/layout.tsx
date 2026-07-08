// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { features } from "@/config/features";
import { notFound } from "next/navigation";

export default function LawyersLayout({ children }: { children: React.ReactNode }) {
  if (!features.lawyerInvolvement) notFound();
  return <>{children}</>;
}
