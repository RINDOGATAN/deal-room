// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import AppSection from "@/components/intl/AppSection";

/** This page's client components translate: they get what the app needs in the browser (AppSection). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppSection>{children}</AppSection>;
}
