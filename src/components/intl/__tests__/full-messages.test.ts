// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Page speed: the root layout sends no message catalogue
 * to the browser, and every section whose client components translate wraps
 * itself in AppSection (with the tRPC client and the toaster). The home, the contract guides and Developers carry
 * their own wording, so their HTML no longer includes the catalogue.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("message catalogue and tRPC client only where they are used", () => {
  it("is not sent by the root layout", () => {
    const root = read("src/app/layout.tsx");
    expect(root).not.toMatch(/getMessages\(/);
    expect(root).toContain("<NextIntlClientProvider messages={{}}>");
    expect(root).not.toMatch(/<Providers>|<Toaster|SessionProvider/);
  });

  it.each(["(dashboard)", "(auth)", "(admin)", "(supervisor)", "(public)", "invite", "auth-error"])("is sent to %s", (dir) => {
    const layout = `src/app/${dir}/layout.tsx`;
    expect(existsSync(path.join(ROOT, layout))).toBe(true);
    expect(read(layout)).toContain("<AppSection>");
  });

  it.each([
    "src/landing/LandingPage.tsx",
    "src/components/public/PublicHeader.tsx",
    "src/components/public/PublicFooter.tsx",
    "src/components/contracts/ContractsShell.tsx",
    "src/components/contracts/ContractGuidePage.tsx",
    "src/components/contracts/ContractIndexPage.tsx",
    "src/components/contracts/PriceLine.tsx",
    "src/components/developers/DevelopersPage.tsx",
  ])("%s does not translate with the catalogue", (rel) => {
    expect(read(rel)).not.toMatch(/useTranslations|useMessages|trpc\.|toast\(|next-auth\/react/);
  });
});
