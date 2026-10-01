// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { PricingFacts } from "@/lib/pricing-page";
import type { Currency } from "@/lib/currency";
import { CurrencySwitch } from "@/components/pricing/CurrencySwitch";

const STOREFRONT_URL = "https://www.todo.law/marketplace";
const RUN_URL = "https://www.todo.law/run";

/**
 * The public pricing page body. Every amount and the billing start date
 * come in `facts` (from the price configuration); with billing off the
 * page says so and lists no amounts.
 */
export function PricingView({
  facts,
  billingOn,
  currency,
}: {
  facts: PricingFacts;
  billingOn: boolean;
  /** The one currency shown to this visitor (`resolveVisitorCurrency`). */
  currency: Currency;
}) {
  const t = useTranslations("pricing");
  const key = currency === "EUR" ? "eur" : "usd";
  const contractPrice = facts.contract[key];
  const packPrice = facts.pack[key];

  const free = ["freeDrafting", "freeNegotiating", "freeCompromise", "freeSupervision", "freeVetting", "freeMarketplace"] as const;

  return (
    <div className="space-y-12" data-testid="pricing-page">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">{t("title")}</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">{billingOn ? t("lead") : t("leadOff")}</p>
        {billingOn && (contractPrice || packPrice) && <CurrencySwitch current={currency} reload />}
      </div>

      {billingOn && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="card-brutal p-6 space-y-4" aria-labelledby="pricing-people">
            <h2 id="pricing-people" className="text-xl font-bold">{t("peopleTitle")}</h2>
            <p className="text-2xl font-semibold">
              {contractPrice ? t("peoplePrice", { price: contractPrice }) : t("peoplePriceUnknown")}
            </p>
            <div className="space-y-2">
              <h3 className="font-semibold">{t("coversTitle")}</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                <li>{t("coversSkills")}</li>
                <li>{t("coversFormats")}</li>
                <li>{t("coversSignature")}</li>
                <li>{t("coversNothingRecurring")}</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">{t("whenTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("whenBody")}</p>
              <p className="text-sm text-muted-foreground">{t("whenInvoice")}</p>
              {facts.billingStart && (
                <p className="text-sm text-muted-foreground">{t("startBody", { date: facts.billingStart })}</p>
              )}
            </div>
          </section>

          <section className="card-brutal p-6 space-y-4" aria-labelledby="pricing-agents">
            <h2 id="pricing-agents" className="text-xl font-bold">{t("agentsTitle")}</h2>
            <p className="text-2xl font-semibold">
              {contractPrice ? t("agentsPrice", { price: contractPrice }) : t("agentsPriceUnknown")}
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li>{t("agentsWhen")}</li>
              <li>
                {packPrice && facts.packDiscountPercent !== null
                  ? t("agentsPack", { size: facts.packSize, percent: facts.packDiscountPercent, price: packPrice })
                  : packPrice
                    ? t("agentsPackNoDiscount", { size: facts.packSize, price: packPrice })
                    : t("agentsPackUnknown", { size: facts.packSize })}
              </li>
              <li>{t("agentsHeld")}</li>
              <li>
                {t("agentsApi")} <code className="text-xs">get_credit_balance</code>,{" "}
                <code className="text-xs">buy_credits</code>.
              </li>
            </ul>
            <Link href="/docs/agent-api" className="text-sm text-primary underline underline-offset-2">
              {t("agentsDocsLink")}
            </Link>
          </section>
        </div>
      )}

      <section className="space-y-3" aria-labelledby="pricing-free">
        <h2 id="pricing-free" className="text-xl font-bold">{t("freeTitle")}</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          {free.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="pricing-questions">
        <h2 id="pricing-questions" className="text-xl font-bold">{t("questionsTitle")}</h2>
        <dl className="space-y-4">
          {billingOn && (
            <div>
              <dt className="font-semibold">{t("qPaidQ")}</dt>
              <dd className="text-muted-foreground mt-1">{t("qPaidA")}</dd>
            </div>
          )}
          <div>
            <dt className="font-semibold">{t("qSubscriptionQ")}</dt>
            <dd className="text-muted-foreground mt-1">{t("qSubscriptionA")}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t("qKitQ")}</dt>
            <dd className="text-muted-foreground mt-1">
              {t("qKitA")}{" "}
              <a href={STOREFRONT_URL} className="text-primary underline underline-offset-2">
                {t("qKitLink")}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">{t("qConfidentialQ")}</dt>
            <dd className="text-muted-foreground mt-1">
              {t("qConfidentialA")}{" "}
              <a href={RUN_URL} className="text-primary underline underline-offset-2">
                {t("qConfidentialLink")}
              </a>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
