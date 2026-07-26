"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { KeyRound, Upload, Loader2, CheckCircle2, Lock, FileCheck2, Globe, Package, ShoppingBag } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { marketplaceSkillUrl } from "@/lib/marketplace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const JURISDICTION_LABELS: Record<string, string> = {
  CALIFORNIA: "California",
  DELAWARE: "Delaware",
  ENGLAND_WALES: "England & Wales",
  NEW_YORK: "New York",
  SPAIN: "Spain",
};

// Minimal shape check before we send it to the server.
function looksLikeLicense(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && "licenseKey" in x && "skillId" in x && "signature" in x;
}

export default function SkillsPage() {
  const t = useTranslations("skills");
  const fileRef = useRef<HTMLInputElement>(null);
  const [license, setLicense] = useState<Record<string, unknown> | null>(null);
  const [fileName, setFileName] = useState("");
  const skillFileRef = useRef<HTMLInputElement>(null);
  const [skillFileName, setSkillFileName] = useState("");
  const [skillData, setSkillData] = useState<string | null>(null);

  const installed = trpc.skillManager.listInstalled.useQuery();
  const activate = trpc.skillManager.activateOffline.useMutation({
    onSuccess: (r) => {
      toast.success(t("activated", { name: r.skillName ?? "Skill" }));
      setLicense(null);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      installed.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const install = trpc.skillManager.install.useMutation({
    onSuccess: () => {
      toast.success(t("installed"));
      setSkillData(null);
      setSkillFileName("");
      if (skillFileRef.current) skillFileRef.current.value = "";
      installed.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Read the .skill (a zip) as base64 so it rides the JSON transport to the
  // install mutation. readAsDataURL gives "data:...;base64,XXXX" — keep the tail.
  const onSkillFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      if (!base64) {
        toast.error(t("badSkill"));
        return;
      }
      setSkillData(base64);
      setSkillFileName(file.name);
    };
    reader.onerror = () => toast.error(t("badSkill"));
    reader.readAsDataURL(file);
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!looksLikeLicense(parsed)) throw new Error("shape");
        setLicense(parsed);
        setFileName(file.name);
      } catch {
        setLicense(null);
        setFileName("");
        toast.error(t("badFile"));
      }
    };
    reader.readAsText(file);
  };

  const skills = installed.data ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {/* Install a purchased skill package (.skill) */}
      <Card className="mb-6 p-6">
        <div className="mb-1 flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium">{t("installTitle")}</h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">{t("installHint")}</p>

        <input
          ref={skillFileRef}
          type="file"
          accept=".skill,application/zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSkillFile(f);
          }}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="button" variant="outline" onClick={() => skillFileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            {t("chooseSkill")}
          </Button>
          {skillFileName && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <FileCheck2 className="h-4 w-4 text-primary" />
              {skillFileName}
            </span>
          )}
          <div className="sm:ml-auto">
            <Button
              type="button"
              disabled={!skillData || install.isPending}
              onClick={() =>
                skillData && install.mutate({ fileName: skillFileName, dataBase64: skillData })
              }
            >
              {install.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("installing")}
                </>
              ) : (
                t("install")
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Activate with a licence file */}
      <Card className="p-6">
        <div className="mb-1 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium">{t("activateTitle")}</h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">{t("activateHint")}</p>

        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            {t("chooseFile")}
          </Button>
          {fileName && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <FileCheck2 className="h-4 w-4 text-primary" />
              {fileName}
            </span>
          )}
          <div className="sm:ml-auto">
            <Button
              type="button"
              disabled={!license || activate.isPending}
              onClick={() => license && activate.mutate({ licenseFile: license as never })}
            >
              {activate.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("activating")}
                </>
              ) : (
                t("activate")
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Installed skills + status */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium">{t("installedTitle")}</h2>
        {installed.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
          </div>
        ) : skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("installedNone")}</p>
        ) : (
          <ul className="grid gap-3">
            {skills.map((s) => (
              <li key={s.id}>
                <Card className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.displayName || s.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {(s.jurisdictions ?? []).map((j) => JURISDICTION_LABELS[j] ?? j).join(", ") || "—"}
                      </span>
                      <span>v{s.version}</span>
                    </div>
                  </div>
                  {/* A contentless stub is a catalog entry, not an install —
                      never present it as Installed/Active. */}
                  {!s.contentInstalled ? (
                    <a
                      href={marketplaceSkillUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      {t("statusMarketplace")}
                    </a>
                  ) : s.isActive ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t("statusActive")}
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" />
                      {t("statusLocked")}
                    </span>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
