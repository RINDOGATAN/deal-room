"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUserRole } from "@/contexts/UserRoleContext";
import { Save } from "lucide-react";
import { redirect } from "next/navigation";

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

  useEffect(() => {
    if (profile) {
      setBio(profile.bio || "");
      setJurisdictions(profile.jurisdictions as GoverningLaw[]);
      setLanguages(profile.languages);
      setIsPublished(profile.isPublished);
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
