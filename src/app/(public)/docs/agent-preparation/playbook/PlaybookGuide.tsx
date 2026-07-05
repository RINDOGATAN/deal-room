"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  ChevronDown,
  CheckCircle,
  Shield,
} from "lucide-react";

interface SkillOption {
  code: string;
  label: string;
  order: number;
  biasPartyA: number;
  biasPartyB: number;
  localizedContent: Record<string, unknown> | null;
}

interface SkillClause {
  clauseId: string;
  title: string;
  category: string;
  order: number;
  isRequired: boolean;
  localizedContent: Record<string, unknown> | null;
  options: SkillOption[];
}

interface Skill {
  contractType: string;
  displayName: string;
  displayNameLocalized: Record<string, string> | null;
  clauses: SkillClause[];
}

function localize(
  dbValue: string,
  localized: Record<string, unknown> | null | undefined,
  field: string,
  locale: string,
): string {
  if (localized && typeof localized[field] === "object" && localized[field] !== null) {
    const map = localized[field] as Record<string, string>;
    return map[locale] || map.en || dbValue;
  }
  return dbValue;
}

const fullPlaybookExample = `{
  "name": "API Consumer — Moderate Risk",
  "contractType": "A2A_API_ACCESS",
  "governingLaw": "CALIFORNIA",
  "contractLanguage": "en",
  "entries": [
    {
      "clauseId": "rate-limits",
      "preferredOptionId": "PREMIUM_RATE",
      "priority": 3,
      "flexibility": 3,
      "isRedLine": false,
      "acceptableOptions": [],
      "notes": "Would like premium but can live with standard"
    },
    {
      "clauseId": "uptime-sla",
      "preferredOptionId": "SLA_999",
      "priority": 4,
      "flexibility": 2,
      "isRedLine": false,
      "acceptableOptions": ["SLA_999", "SLA_99"],
      "notes": "Critical for our agent pipeline"
    },
    {
      "clauseId": "data-handling",
      "preferredOptionId": "DELETE_ON_TERMINATION",
      "priority": 5,
      "flexibility": 1,
      "isRedLine": true,
      "acceptableOptions": ["DELETE_ON_TERMINATION", "ANONYMIZE_ON_TERMINATION"],
      "notes": "GDPR compliance — cannot accept retention"
    },
    {
      "clauseId": "liability-cap",
      "preferredOptionId": "LIABILITY_12M_FEES",
      "priority": 4,
      "flexibility": 2,
      "isRedLine": false,
      "acceptableOptions": [],
      "notes": "Board-mandated proportional cap"
    },
    {
      "clauseId": "ip-ownership",
      "preferredOptionId": "IP_CONSUMER_OWNS",
      "priority": 5,
      "flexibility": 1,
      "isRedLine": true,
      "acceptableOptions": ["IP_CONSUMER_OWNS", "IP_SHARED"],
      "notes": "Outputs feed our models — must own or share"
    },
    {
      "clauseId": "indemnification",
      "preferredOptionId": "MUTUAL_INDEMNIFICATION",
      "priority": 3,
      "flexibility": 3,
      "isRedLine": false,
      "acceptableOptions": [],
      "notes": ""
    },
    {
      "clauseId": "termination",
      "preferredOptionId": "CONVENIENCE_30_DAYS",
      "priority": 3,
      "flexibility": 4,
      "isRedLine": false,
      "acceptableOptions": [],
      "notes": "Flexible on termination terms"
    },
    {
      "clauseId": "dispute-resolution",
      "preferredOptionId": "GAVEL_ARBITRATION",
      "priority": 3,
      "flexibility": 4,
      "isRedLine": false,
      "acceptableOptions": [],
      "notes": "Prefer Gavel but any arbitration acceptable"
    }
  ]
}`;

export function PlaybookGuide({ skills }: { skills: Skill[] }) {
  const locale = useLocale();
  const t = useTranslations("agentPrepPlaybook");
  const [selectedSkill, setSelectedSkill] = useState<string>("");

  const translationExamples = [
    {
      policyKey: "translationExample1Policy",
      playbookKey: "translationExample1Playbook",
    },
    {
      policyKey: "translationExample2Policy",
      playbookKey: "translationExample2Playbook",
    },
    {
      policyKey: "translationExample3Policy",
      playbookKey: "translationExample3Playbook",
    },
  ];

  const flexLevels = [
    { key: "flexibility1Label", descKey: "flexibility1Desc", value: 1, stake: 0.48 },
    { key: "flexibility2Label", descKey: "flexibility2Desc", value: 2, stake: 0.36 },
    { key: "flexibility3Label", descKey: "flexibility3Desc", value: 3, stake: 0.24 },
    { key: "flexibility4Label", descKey: "flexibility4Desc", value: 4, stake: 0.12 },
    { key: "flexibility5Label", descKey: "flexibility5Desc", value: 5, stake: 0.0 },
  ];

  const checks = ["check1", "check2", "check3", "check4", "check5", "check6"];

  const activeSkill = skills.find((s) => s.contractType === selectedSkill);

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Policy → Playbook Translation */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("translationTitle")}</h2>
        <p className="text-muted-foreground">{t("translationDesc")}</p>

        <div className="border border-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-2 bg-muted border-b border-border">
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground">
              {t("translationPolicyCol")}
            </div>
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground border-l border-border">
              {t("translationPlaybookCol")}
            </div>
          </div>
          {translationExamples.map((ex) => (
            <div
              key={ex.policyKey}
              className="grid grid-cols-2 border-b border-border last:border-b-0"
            >
              <div className="px-4 py-3 text-sm text-muted-foreground italic">
                {t(ex.policyKey)}
              </div>
              <div className="px-4 py-3 text-xs font-mono text-primary border-l border-border">
                {t(ex.playbookKey)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Flexibility */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("flexibilityTitle")}</h2>
        <p className="text-muted-foreground">{t("flexibilityDesc")}</p>

        <div className="p-4 border border-primary/30 bg-primary/5 rounded-xl">
          <p className="font-bold text-sm mb-1">{t("flexibilityFormulaTitle")}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {t("flexibilityFormulaDesc")}
          </p>
        </div>

        <div className="space-y-2">
          {flexLevels.map((level) => (
            <div
              key={level.value}
              className="flex items-center gap-4 p-3 border border-border rounded-lg"
            >
              <div className="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                {level.value}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{t(level.key)}</p>
                <p className="text-xs text-muted-foreground">
                  {t(level.descKey)}
                </p>
              </div>
              {/* Visual stake bar */}
              <div className="w-24 flex-shrink-0">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(level.stake / 0.48) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Red Lines */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("redLinesTitle")}</h2>
        <p className="text-muted-foreground">{t("redLinesDesc")}</p>

        <div className="space-y-2">
          <h3 className="font-bold text-sm">{t("redLineWhenTitle")}</h3>
          <ul className="space-y-1.5">
            {["redLineWhen1", "redLineWhen2", "redLineWhen3"].map((key) => (
              <li key={key} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-xl">
          <h3 className="font-bold text-sm mb-1">{t("redLineAcceptableTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("redLineAcceptableDesc")}
          </p>
        </div>
      </div>

      {/* Dynamic Clause Explorer */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("explorerTitle")}</h2>
        <p className="text-muted-foreground">{t("explorerDesc")}</p>

        {skills.length > 0 ? (
          <>
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="w-full p-3 border border-border rounded-xl bg-card text-sm"
            >
              <option value="">{t("explorerSelectPrompt")}</option>
              {skills.map((s) => (
                <option key={s.contractType} value={s.contractType}>
                  {s.displayNameLocalized?.[locale] || s.displayName} ({s.contractType})
                </option>
              ))}
            </select>

            {activeSkill && (
              <div className="space-y-3">
                {activeSkill.clauses.map((clause) => {
                  const clauseTitle = localize(
                    clause.title,
                    clause.localizedContent,
                    "title",
                    locale,
                  );
                  return (
                    <ClausePlaybookEntry
                      key={clause.clauseId}
                      clause={clause}
                      clauseTitle={clauseTitle}
                      locale={locale}
                      t={t}
                    />
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No A2A contract types available.
          </p>
        )}
      </div>

      {/* Full Example */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("fullExampleTitle")}</h2>
        <p className="text-muted-foreground">{t("fullExampleDesc")}</p>

        <div className="border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-2 bg-muted border-b border-border">
            <p className="text-xs font-mono text-muted-foreground">
              POST /api/v1/agent/playbooks
            </p>
          </div>
          <pre className="p-4 text-xs text-muted-foreground overflow-x-auto leading-relaxed">
            {fullPlaybookExample}
          </pre>
        </div>
      </div>

      {/* Validation Checklist */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("checklistTitle")}</h2>
        <p className="text-muted-foreground">{t("checklistDesc")}</p>

        <div className="space-y-2">
          {checks.map((key) => (
            <div
              key={key}
              className="flex items-start gap-3 p-3 border border-border rounded-lg"
            >
              <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">{t(key)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Next: Disputes */}
      <div className="p-6 border border-amber-500/30 bg-amber-500/5 rounded-2xl">
        <h2 className="text-xl font-bold mb-2">
          {t("title").includes("Playbook") ? "Next: Dispute Readiness" : "Siguiente: Preparación ante Disputas"}
        </h2>
        <p className="text-muted-foreground text-sm mb-4">
          Configure Gavel dispute resolution as your safety net.
        </p>
        <Link
          href="/docs/agent-preparation/disputes"
          className="inline-flex items-center gap-2 text-amber-500 font-medium hover:underline"
        >
          <Shield className="w-4 h-4" />
          Dispute Readiness
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

/* ── Clause Playbook Entry Component ── */

function ClausePlaybookEntry({
  clause,
  clauseTitle,
  locale,
  t,
}: {
  clause: SkillClause;
  clauseTitle: string;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground border border-border rounded-full">
              {localize(clause.category, clause.localizedContent, "category", locale)}
            </span>
            <h4 className="font-semibold text-sm">{clauseTitle}</h4>
            {clause.isRequired && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-500 border border-red-500/30 rounded-full">
                required
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${
              expanded ? "rotate-0" : "-rotate-90"
            }`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {t("explorerPlaybookEntry")}
          </p>

          {clause.options.map((option) => {
            const optLabel = localize(
              option.label,
              option.localizedContent,
              "label",
              locale,
            );
            return (
              <div
                key={option.code}
                className="p-3 bg-muted/30 rounded-lg font-mono text-xs space-y-1"
              >
                <p className="text-muted-foreground">
                  <span className="text-primary">clauseId</span>:{" "}
                  &quot;{clause.clauseId}&quot;
                </p>
                <p className="text-muted-foreground">
                  <span className="text-primary">preferredOptionId</span>:{" "}
                  &quot;{option.code}&quot;{" "}
                  <span className="text-muted-foreground/60">
                    {"// "}{optLabel}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  <span className="text-primary">flexibility</span>: _{" "}
                  <span className="text-muted-foreground/60">
                    {"// 1 (inflexible) to 5 (very flexible)"}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  <span className="text-primary">isRedLine</span>: false
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
