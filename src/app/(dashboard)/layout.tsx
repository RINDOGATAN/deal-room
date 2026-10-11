// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import AppSection from "@/components/intl/AppSection";
import ClientLayout from "./client-layout";

/** The section's client layout, with what the app needs in the browser (AppSection). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AppSection>
      <ClientLayout>{children}</ClientLayout>
    </AppSection>
  );
}
