import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // The contract PDF renderer (@react-pdf/renderer) reads IBM Plex TTFs from
  // disk at render time. Force them into the serverless function bundles for
  // every API route that can generate a document, or rendering 500s in prod.
  outputFileTracingIncludes: {
    "/api/**": ["./src/server/services/document/fonts/**"],
  },
};

export default withNextIntl(nextConfig);
