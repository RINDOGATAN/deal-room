"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUserRole } from "@/contexts/UserRoleContext";
import { Save } from "lucide-react";
import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  SPECIALIZATIONS,
  CERTIFICATIONS,
  CERTIFICATION_LABELS,
  EXPERT_TYPES,
  type Specialization,
  type Certification,
  type ExpertType,
} from "@/server/services/experts/taxonomy";

type GoverningLaw = "CALIFORNIA" | "ENGLAND_WALES" | "SPAIN";

const jurisdictionValues: GoverningLaw[] = ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"];
const jurisdictionKeys: Record<string, string> = {
  CALIFORNIA: "jurisdictionCalifornia",
  ENGLAND_WALES: "jurisdictionEnglandWales",
  SPAIN: "jurisdictionSpain",
};

const languageValues = ["en", "es"] as const;
const languageKeys: Record<string, string> = {
  en: "languageEnglish",
  es: "languageSpanish",
};

const jurisdictionsCoveredOptions = ["EU", "UK", "US", "CA", "LATAM", "APAC"] as const;

export default function LawyerProfilePage() {
  const t = useTranslations("lawyerProfile");
  const tCommon = useTranslations("common");
  const { persona, isLoading: roleLoading } = useUserRole();

  const { data: profile, isLoading } = trpc.lawyer.getMyDirectoryProfile.useQuery(
    undefined,
    { enabled: persona === "lawyer" }
  );

  const [bio, setBio] = useState("");
  const [jurisdictions, setJurisdictions] = useState<GoverningLaw[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [title, setTitle] = useState("");
  const [expertTypes, setExpertTypes] = useState<ExpertType[]>(["TECHNICAL"]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [countryCode, setCountryCode] = useState("");
  const [city, setCity] = useState("");
  const [jurisdictionsCovered, setJurisdictionsCovered] = useState<string[]>([]);
  const [contactUrl, setContactUrl] = useState("");
  const [acceptingClients, setAcceptingClients] = useState(true);

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates the lawyer-profile edit form once from the fetched profile; the fields are user-editable afterwards so they cannot be derived during render
      setBio(profile.bio || "");
      setJurisdictions(profile.jurisdictions as GoverningLaw[]);
      setLanguages(profile.languages);
      setIsPublished(profile.isPublished);
      setTitle(profile.title || "");
      // Filter out retired types (e.g. legacy "LEGAL") so a save can't
      // fail validation against the current EXPERT_TYPES vocabulary.
      setExpertTypes(
        ((profile.expertTypes || []) as string[]).filter((t): t is ExpertType =>
          (EXPERT_TYPES as readonly string[]).includes(t)
        )
      );
      setSpecializations((profile.specializations as Specialization[]) || []);
      setCertifications((profile.certifications as Certification[]) || []);
      setCountryCode(profile.countryCode || "");
      setCity(profile.city || "");
      setJurisdictionsCovered(profile.jurisdictionsCovered || []);
      setContactUrl(profile.contactUrl || "");
      setAcceptingClients(profile.acceptingClients ?? true);
    }
  }, [profile]);

  const utils = trpc.useUtils();
  const updateProfile = trpc.lawyer.updateDirectoryProfile.useMutation({
    onSuccess: () => {
      toast.success(t("saved"));
      utils.lawyer.getMyDirectoryProfile.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Redirect non-lawyers
  if (!roleLoading && persona !== "lawyer") {
    redirect("/lawyers");
  }

  const canPublish = bio.trim().length > 0 && jurisdictions.length > 0 && languages.length > 0;

  const handleSave = () => {
    updateProfile.mutate({
      bio: bio || undefined,
      jurisdictions,
      languages,
      isPublished: canPublish ? isPublished : false,
      title: title || undefined,
      expertTypes: expertTypes,
      specializations,
      certifications,
      countryCode: countryCode || undefined,
      city: city || undefined,
      jurisdictionsCovered,
      contactUrl: contactUrl || undefined,
      acceptingClients,
    });
  };

  const toggleJurisdiction = (j: GoverningLaw) => {
    setJurisdictions((prev) =>
      prev.includes(j) ? prev.filter((x) => x !== j) : [...prev, j]
    );
  };

  const toggleLanguage = (l: string) => {
    setLanguages((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]
    );
  };

  if (isLoading || roleLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        </div>
        <div className="card-brutal animate-pulse h-64" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <div className="card-brutal space-y-6">
        {/* Bio */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("bio")}</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t("bioPlaceholder")}
            rows={4}
            maxLength={2000}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Jurisdictions */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("jurisdictions")}</label>
          <div className="flex flex-wrap gap-2">
            {jurisdictionValues.map((j) => (
              <button
                key={j}
                onClick={() => toggleJurisdiction(j)}
                className={`px-3 py-1.5 text-sm border rounded-full transition-colors ${
                  jurisdictions.includes(j)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {tCommon(jurisdictionKeys[j])}
              </button>
            ))}
          </div>
        </div>

        {/* Languages */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("languages")}</label>
          <div className="flex flex-wrap gap-2">
            {languageValues.map((l) => (
              <button
                key={l}
                onClick={() => toggleLanguage(l)}
                className={`px-3 py-1.5 text-sm border rounded-full transition-colors ${
                  languages.includes(l)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {tCommon(languageKeys[l])}
              </button>
            ))}
          </div>
        </div>

        {/* Separator */}
        <hr className="border-border" />

        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("titleField")}</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            maxLength={200}
            className="input-brutal"
          />
        </div>

        {/* Expert Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("expertType")}</label>
          <div className="flex flex-wrap gap-2">
            {EXPERT_TYPES.map((et) => (
              <button
                key={et}
                onClick={() => {
                  setExpertTypes((prev) =>
                    prev.includes(et) ? prev.filter((x) => x !== et) : [...prev, et]
                  );
                }}
                className={`px-3 py-1.5 text-sm border rounded-full transition-colors ${
                  expertTypes.includes(et)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {t(`expertTypes.${et}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Specializations */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("specializations")}</label>
          <div className="flex flex-wrap gap-2">
            {SPECIALIZATIONS.map((s) => (
              <button
                key={s}
                onClick={() =>
                  setSpecializations((prev) =>
                    prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                  )
                }
                className={`px-3 py-1.5 text-xs border rounded-full transition-colors ${
                  specializations.includes(s)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {t(`specializationLabels.${s}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Certifications */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("certifications")}</label>
          <div className="flex flex-wrap gap-2">
            {CERTIFICATIONS.map((c) => (
              <button
                key={c}
                onClick={() =>
                  setCertifications((prev) =>
                    prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                  )
                }
                className={`px-3 py-1.5 text-xs border rounded-full transition-colors ${
                  certifications.includes(c)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {CERTIFICATION_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("country")}</label>
            <Input
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
              placeholder={t("countryPlaceholder")}
              maxLength={2}
              className="input-brutal"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("city")}</label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t("cityPlaceholder")}
              maxLength={200}
              className="input-brutal"
            />
          </div>
        </div>

        {/* Jurisdictions Covered */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("jurisdictionsCovered")}</label>
          <p className="text-xs text-muted-foreground">{t("jurisdictionsCoveredHint")}</p>
          <div className="flex flex-wrap gap-2">
            {jurisdictionsCoveredOptions.map((j) => (
              <button
                key={j}
                onClick={() =>
                  setJurisdictionsCovered((prev) =>
                    prev.includes(j) ? prev.filter((x) => x !== j) : [...prev, j]
                  )
                }
                className={`px-3 py-1.5 text-sm border rounded-full transition-colors ${
                  jurisdictionsCovered.includes(j)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {j}
              </button>
            ))}
          </div>
        </div>

        {/* Contact URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("contactUrl")}</label>
          <Input
            value={contactUrl}
            onChange={(e) => setContactUrl(e.target.value)}
            placeholder={t("contactUrlPlaceholder")}
            type="url"
            maxLength={500}
            className="input-brutal"
          />
        </div>

        {/* Accepting Clients Toggle */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAcceptingClients(!acceptingClients)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                acceptingClients ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  acceptingClients ? "translate-x-5" : ""
                }`}
              />
            </button>
            <span className="text-sm font-medium">{t("acceptingClients")}</span>
          </div>
        </div>

        <hr className="border-border" />

        {/* Publish Toggle */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => canPublish && setIsPublished(!isPublished)}
              disabled={!canPublish}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isPublished && canPublish ? "bg-primary" : "bg-muted"
              } ${!canPublish ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  isPublished && canPublish ? "translate-x-5" : ""
                }`}
              />
            </button>
            <span className="text-sm font-medium">{t("publish")}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {canPublish
              ? (isPublished ? t("publishDescription") : t("unpublishDescription"))
              : t("publishRequirements")
            }
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={updateProfile.isPending}
          className="btn-brutal flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {updateProfile.isPending ? tCommon("loading") : tCommon("save")}
        </button>
      </div>
    </div>
  );
}
