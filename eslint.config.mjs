import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Underscore prefix is this codebase's convention for values that must
      // exist for signature/destructuring shape but are intentionally unused.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Images are local /public assets in a self-hosted standalone image;
      // next/image would couple the sovereign build to the sharp optimizer
      // for no measurable gain.
      "@next/next/no-img-element": "off",
    },
  },
  {
    // Tooling that talks to raw JSON (fixtures, seed data, CLI plumbing,
    // Playwright helpers). Strict `any` policing adds noise, not safety, here.
    files: ["scripts/**", "cli/**", "e2e/**", "prisma/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Plain-Node CJS utility scripts; converting to ESM buys nothing.
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // These modules are dominated by Prisma `Json` boundary casts
    // (localizedContent / skill-manifest blobs / jurisdiction enum bridges);
    // typing every cast would contort straightforward serialization code.
    files: ["src/server/routers/deal.ts", "src/server/services/skills/loader.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // App code must use the structured logger (src/lib/logger.ts), which is
    // the single sanctioned console gateway. Scripts/CLI/prisma keep console.
    files: ["src/**"],
    ignores: ["src/lib/logger.ts"],
    rules: {
      "no-console": "error",
    },
  },
]);

export default eslintConfig;
