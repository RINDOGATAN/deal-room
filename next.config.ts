import type { NextConfig } from "next";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Hosted pilot posture, decided at build time and inlined into the browser
// bundle (VERCEL_ENV itself is server-only). Same rule as
// src/lib/pilot.ts:isHostedPilotEnv; self-host images build without
// VERCEL_ENV, so they never match. An explicit NEXT_PUBLIC_HOSTED_PILOT wins.
const hostedPilot =
  process.env.NEXT_PUBLIC_HOSTED_PILOT === "true" ||
  process.env.VERCEL_ENV === "production" ||
  [".todo.law", "todo.law"].includes(
    (process.env.AUTH_COOKIE_DOMAIN ?? "").trim().toLowerCase(),
  );

// What /api/health reports and checks: the build's version and commit, and
// the last migration the build ships (the runtime image carries no
// prisma/migrations folder, so the name is recorded here).
const lastMigration =
  readdirSync(join(process.cwd(), "prisma", "migrations"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .at(-1) ?? "";
const buildVersion =
  process.env.APP_VERSION ||
  (JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string })
    .version;
const buildCommit = (process.env.APP_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_HOSTED_PILOT: hostedPilot ? "true" : "false",
    DEALROOM_BUILD_MIGRATION: lastMigration,
    DEALROOM_BUILD_VERSION: buildVersion,
    DEALROOM_BUILD_COMMIT: buildCommit,
  },
  // Sovereign/self-hosted bundles (deploy/sovereign) build a standalone
  // server so the runtime image ships without dev tooling. Cloud (Vercel)
  // builds leave NEXT_OUTPUT_STANDALONE unset — output stays default.
  ...(process.env.NEXT_OUTPUT_STANDALONE === "true"
    ? { output: "standalone" as const }
    : {}),
  // The contract PDF renderer (@react-pdf/renderer) reads IBM Plex TTFs from
  // disk at render time. Force them into the serverless function bundles for
  // every API route that can generate a document, or rendering 500s in prod.
  outputFileTracingIncludes: {
    "/api/**": ["./src/server/services/document/fonts/**"],
  },
};

export default withNextIntl(nextConfig);
