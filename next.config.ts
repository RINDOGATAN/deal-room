import type { NextConfig } from "next";
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

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_HOSTED_PILOT: hostedPilot ? "true" : "false",
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
