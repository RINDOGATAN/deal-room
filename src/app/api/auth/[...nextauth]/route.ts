// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { withAuthRateLimit } from "@/server/middleware/public-rate-limit";
import { withAccountEmailPolicy } from "@/lib/email-policy-server";

// Sign-in and magic-link POSTs are rate limited per client IP, and refused
// with a 400 when the e-mail fails the account policy (email-policy.ts).
const handler = withAuthRateLimit("user", withAccountEmailPolicy(NextAuth(authOptions)));

export { handler as GET, handler as POST };
