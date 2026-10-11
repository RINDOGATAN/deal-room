// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Providers } from "@/components/providers";
import { SessionProviders } from "@/components/session-providers";
import { Toaster } from "@/components/ui/sonner";

/**
 * What the app's sections need in the browser and the public pages do not
 * (page speed, owner 10 Oct 2026): the whole message catalogue (about
 * 150 KB), the session (next-auth client), the tRPC and React Query client,
 * and the toaster. The root layout
 * no longer sends them with every page; the sections whose client components
 * translate or call tRPC (dashboard, sign-in, admin, supervisor, Docs and
 * Pricing, invitations, sign-in errors) wrap themselves in this. The home,
 * the contract guides and Developers carry their own wording and ship none
 * of it.
 */
export default async function AppSection({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={messages}>
      <SessionProviders>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </SessionProviders>
    </NextIntlClientProvider>
  );
}
