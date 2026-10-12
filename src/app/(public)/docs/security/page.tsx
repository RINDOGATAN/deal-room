"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Security page: what the code does today, nothing more. Every statement is
 * tied to the code in the pull request that added it; change the code and
 * this page together. Same layout as AI Sentinel's /docs/security.
 */

import { useTranslations } from "next-intl";
import { SECURITY_CONTACT } from "@/config/security-contact";

type Item = { title: string; description: string };

function Cards({ items, cols = 2 }: { items: Item[]; cols?: 2 | 4 }) {
  return (
    <div className={`grid gap-3 ${cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}>
      {items.map((item) => (
        <div key={item.title} className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default function SecurityDocsPage() {
  const t = useTranslations("securityDocs");
  const hostingItems = t.raw("hosting.items") as Item[];
  const authItems = t.raw("auth.items") as string[];
  const webItems = t.raw("web.items") as Item[];

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-3xl font-bold mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground max-w-3xl">{t("intro")}</p>
      </section>

      <Section title={t("hosting.title")}>
        <p className="text-muted-foreground mb-6">{t("hosting.intro")}</p>
        <Cards items={hostingItems} />
      </Section>

      <Section title={t("auth.title")}>
        <p className="text-muted-foreground mb-6">{t("auth.intro")}</p>
        <ul className="rounded-xl border border-border bg-card p-6 space-y-2 text-sm text-muted-foreground">
          {authItems.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-primary mt-0.5" aria-hidden>•</span>
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("access.title")}>
        <p className="text-muted-foreground mb-6">{t("access.intro")}</p>
        <div className="rounded-xl border border-border bg-card p-6 text-sm">
          <h3 className="font-medium mb-2">{t("access.invitationTitle")}</h3>
          <p className="text-muted-foreground">{t("access.invitationBody")}</p>
        </div>
      </Section>

      <Section title={t("admin.title")}>
        <p className="text-muted-foreground">{t("admin.body")}</p>
      </Section>

      <Section title={t("records.title")}>
        <Cards
          items={[
            { title: t("records.auditTitle"), description: t("records.auditBody") },
            { title: t("records.documentsTitle"), description: t("records.documentsBody") },
          ]}
        />
      </Section>

      <Section title={t("ai.title")}>
        <p className="text-muted-foreground">{t("ai.body")}</p>
      </Section>

      <Section title={t("payments.title")}>
        <p className="text-muted-foreground">{t("payments.body")}</p>
      </Section>

      <Section title={t("web.title")}>
        <Cards items={webItems} />
      </Section>

      <Section title={t("api.title")}>
        <p className="text-muted-foreground">{t("api.body")}</p>
      </Section>

      <Section title={t("selfHost.title")}>
        <p className="text-muted-foreground">{t("selfHost.body")}</p>
      </Section>

      <Section title={t("contact.title")}>
        <p className="text-muted-foreground">
          {t.rich("contact.body", {
            email: SECURITY_CONTACT,
            link: (chunks) => (
              <a href={`mailto:${SECURITY_CONTACT}`} className="text-primary underline underline-offset-2">
                {chunks}
              </a>
            ),
          })}
        </p>
      </Section>
    </div>
  );
}
