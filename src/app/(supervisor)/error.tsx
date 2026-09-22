"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { ErrorScreen } from "@/components/ErrorScreen";

export default function SupervisorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorScreen error={error} reset={reset} backHref="/supervise" />;
}
