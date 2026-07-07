// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import NextAuth from "next-auth";
import { adminAuthOptions } from "@/lib/auth-admin";

const handler = NextAuth(adminAuthOptions);

export { handler as GET, handler as POST };
