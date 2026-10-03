import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Integration tests: real Postgres (a throwaway database, migrated and
 * seeded) and, for the paid path, Stripe's official mock server
 * (stripe/stripe-mock) or Stripe test mode. Run by the `paid-path` CI job
 * with `npm run test:integration`; never part of `npm run test:run`.
 *
 * Every value below is a test-mode placeholder, used only when the
 * environment does not already set it (so the owner can run the same test
 * against Stripe test mode with `sk_test_` keys and test price ids).
 */
const testDefaults: Record<string, string> = {
  STRIPE_SECRET_KEY: "sk_test_ci_mock_not_a_real_key",
  STRIPE_WEBHOOK_SECRET: "whsec_ci_only_not_a_secret",
  STRIPE_PRICE_CONTRACT_USD: "price_ci_contract_usd",
  STRIPE_PRICE_CONTRACT_EUR: "price_ci_contract_eur",
  STRIPE_PRICE_CREDITS_10_USD: "price_ci_credits_usd",
  STRIPE_PRICE_CREDITS_10_EUR: "price_ci_credits_eur",
  CONTRACT_BILLING_START: "2026-01-01T00:00:00Z",
  NEXTAUTH_URL: "http://127.0.0.1:3000",
  NEXTAUTH_SECRET: "ci-integration-only-not-a-secret",
};
const env: Record<string, string> = {};
for (const [key, value] of Object.entries(testDefaults)) {
  if (!process.env[key]) env[key] = value;
}

export default defineConfig({
  test: {
    environment: "node",
    env,
    include: ["integration/**/*.int.ts"],
    // One database, one flow: run files one after another.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
