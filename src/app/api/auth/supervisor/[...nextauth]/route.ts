// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import NextAuth from "next-auth";
import { supervisorAuthOptions } from "@/lib/auth-supervisor";
import { withAuthRateLimit } from "@/server/middleware/public-rate-limit";

// Magic-link POSTs are rate limited per client IP.
const handler = withAuthRateLimit("supervisor", NextAuth(supervisorAuthOptions));

export { handler as GET, handler as POST };
