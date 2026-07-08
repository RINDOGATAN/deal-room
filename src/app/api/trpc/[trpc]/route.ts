// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers";
import { createTRPCContext } from "@/server/trpc";
import { createLogger } from "@/lib/logger";

const logger = createLogger("trpc");

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            logger.error("tRPC failed", {
              path: path ?? "<no-path>",
              err: error.message,
            });
          }
        : undefined,
  });

export { handler as GET, handler as POST };
