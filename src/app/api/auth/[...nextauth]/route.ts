// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { withAuthRateLimit } from "@/server/middleware/public-rate-limit";

// Sign-in and magic-link POSTs are rate limited per client IP.
const handler = withAuthRateLimit("user", NextAuth(authOptions));

export { handler as GET, handler as POST };
