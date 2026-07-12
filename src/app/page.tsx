// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import LandingPage from "@/landing/LandingPage";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/deals");
  }

  // Self-hosted / local-auth builds have no marketing landing. Send logged-out
  // visitors straight to the local sign-in.
  if (process.env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED === "true") {
    redirect("/sign-in");
  }

  return <LandingPage />;
}
