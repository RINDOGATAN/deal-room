"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileEdit,
  Mail,
  Send,
  ArrowLeft,
  Clock,
  XCircle,
  Scale,
  Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { EnableFeatureModal } from "@/components/premium/enable-feature-modal";

function resolveLocalized(localized: unknown, locale: string, fallback: string): string {
  if (!localized || typeof localized !== "object") return fallback;
  const map = localized as Record<string, string>;
  return map[locale] || map["en"] || fallback;
}

export default function VettingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const vettingId = params.id as string;
  const t = useTranslations("lawyer");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [expandedClause, setExpandedClause] = useState<string | null>(null);
  const clauseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleExpandClause = useCallback((clauseId: string) => {
    const isExpanding = expandedClause !== clauseId;
    setExpandedClause(isExpanding ? clauseId : null);
    if (isExpanding) {
      // Scroll the clause title into view after the content renders
      requestAnimationFrame(() => {
        clauseRefs.current[clauseId]?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [expandedClause]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Local optimistic state for recommendations (clauseTemplateId -> clauseOptionId)
  const [localSelections, setLocalSelections] = useState<Record<string, string>>({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteCompany, setInviteCompany] = useState("");
  const [showEnableModal, setShowEnableModal] = useState(false);

  const utils = trpc.useUtils();
  const { data: vettedStatus } = trpc.billing.hasVettedContracts.useQuery();

  const { data: vetting, isLoading } = trpc.lawyer.getVetting.useQuery(
    { id: vettingId }
  );

  // Pre-populate notes and selections from existing recommendations
  useEffect(() => {
    if (vetting) {
      const noteMap: Record<string, string> = {};
      const selMap: Record<string, string> = {};
      for (const rec of vetting.recommendations) {
        if (rec.note) noteMap[rec.clauseTemplateId] = rec.note;
        selMap[rec.clauseTemplateId] = rec.clauseOptionId;
      }
      setNotes(noteMap);
      setLocalSelections((prev) => {
        // Only set if we don't already have local state (avoid overwriting optimistic updates)
        const merged = { ...selMap };
        for (const [k, v] of Object.entries(prev)) {
          if (v) merged[k] = v;
        }
        return merged;
      });
    }
  }, [vetting]);

  const saveRecommendation = trpc.lawyer.saveRecommendation.useMutation();

  const approveVetting = trpc.lawyer.approveVetting.useMutation({
    onSuccess: () => {
      toast.success(t("vettingApproved"));
      utils.lawyer.getVetting.invalidate({ id: vettingId });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const sendInvitation = trpc.lawyer.sendClientInvitation.useMutation({
    onSuccess: () => {
      toast.success(t("invitationSent"));
      setInviteEmail("");
      setInviteName("");
      setInviteCompany("");
      utils.lawyer.getVetting.invalidate({ id: vettingId });
    },
    onError: (error) => {
      toast.error(t("invitationFailed", { error: error.message }));
    },
  });

  if (isLoading || !vetting) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card-brutal animate-pulse h-64"></div>
      </div>
    );
  }

  const clauses = vetting.contractTemplate.clauses;
  // Merge server recommendations with local optimistic selections
  const recommendationMap = new Map(
    vetting.recommendations.map((r) => [r.clauseTemplateId, r])
  );
  // For UI display, use localSelections (includes optimistic updates)
  const effectiveSelections = { ...Object.fromEntries(
    vetting.recommendations.map((r) => [r.clauseTemplateId, r.clauseOptionId])
  ), ...localSelections };
  const allRecommended = clauses.every((c) => effectiveSelections[c.id]);
  const isApproved = vetting.status === "APPROVED";

  const handleSelectOption = (clauseTemplateId: string, clauseOptionId: string) => {
    if (isApproved) return;
    // Optimistic local update — instant UI response
    setLocalSelections((prev) => ({ ...prev, [clauseTemplateId]: clauseOptionId }));
    // Fire-and-forget save to server
    saveRecommendation.mutate({
      vettingId,
      clauseTemplateId,
      clauseOptionId,
      note: notes[clauseTemplateId] || undefined,
    });
  };

  const handleSaveNote = (clauseTemplateId: string) => {
    const optionId = effectiveSelections[clauseTemplateId];
    if (!optionId || isApproved) return;
    saveRecommendation.mutate({
      vettingId,
      clauseTemplateId,
      clauseOptionId: optionId,
      note: notes[clauseTemplateId] || undefined,
    });
  };

  const handleSendInvitation = () => {
    if (!inviteEmail.trim()) return;
    sendInvitation.mutate({
      vettingId,
      email: inviteEmail.trim(),
      contactName: inviteName.trim() || undefined,
      company: inviteCompany.trim() || undefined,
    });
  };

  const templateName = resolveLocalized(
    vetting.contractTemplate.displayNameLocalized,
    locale,
    vetting.contractTemplate.displayName
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/lawyer/vettings"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3 h-3" />
            {t("myVettings")}
          </Link>
          <h1 className="text-2xl font-bold">{templateName}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-muted-foreground">
              {vetting.governingLaw.replace("_", " & ")}
            </span>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                isApproved
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isApproved ? t("approved") : t("draft")}
            </span>
          </div>
        </div>
        {!isApproved && (
          <button
            onClick={() => approveVetting.mutate({ id: vettingId })}
            disabled={!allRecommended || approveVetting.isPending}
            className="btn-brutal flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {approveVetting.isPending ? t("approving") : t("approveTemplate")}
            <CheckCircle2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {!isApproved && !allRecommended && (
        <div className="card-brutal border-warning bg-warning/5">
          <p className="text-sm text-muted-foreground">
            {t("allClausesRequired")}
          </p>
        </div>
      )}

      {/* Clause Review */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t("reviewClauses")}</h2>
        <p className="text-sm text-muted-foreground">{t("selectRecommendedOption")}</p>

        {clauses.map((clause, index) => {
          const rec = recommendationMap.get(clause.id);
          const selectedOptionId = effectiveSelections[clause.id];
          const hasSelection = !!selectedOptionId;
          const isExpanded = expandedClause === clause.id;
          const title = resolveLocalized(
            (clause.localizedContent as any)?.title,
            locale,
            clause.title
          );
          const description = resolveLocalized(
            (clause.localizedContent as any)?.plainDescription,
            locale,
            clause.plainDescription
          );

          return (
            <div
              key={clause.id}
              ref={(el) => { clauseRefs.current[clause.id] = el; }}
              className="card-brutal scroll-mt-20"
            >
              <button
                onClick={() => handleExpandClause(clause.id)}
                className="w-full text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 flex items-center justify-center text-sm font-bold rounded-full ${
                    hasSelection ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {hasSelection ? <Check className="w-4 h-4" /> : index + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    {hasSelection && (
                      <p className="text-xs text-primary mt-0.5">
                        {clause.options.find((o) => o.id === selectedOptionId)?.label}
                      </p>
                    )}
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {isExpanded && (
                <div className="mt-4 space-y-4 border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">{description}</p>

                  {/* Options */}
                  <div className="space-y-2">
                    {clause.options.map((option) => {
                      const isSelected = selectedOptionId === option.id;
                      const optLabel = resolveLocalized(
                        (option.localizedContent as any)?.label,
                        locale,
                        option.label
                      );
                      const optDesc = resolveLocalized(
                        (option.localizedContent as any)?.plainDescription,
                        locale,
                        option.plainDescription
                      );
                      return (
                        <button
                          key={option.id}
                          onClick={() => handleSelectOption(clause.id, option.id)}
                          disabled={isApproved}
                          className={`w-full text-left p-4 border rounded-xl transition-colors ${
                            isApproved && !isSelected ? "opacity-50" : ""
                          } ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{optLabel}</span>
                                {isSelected && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Scale className="w-3 h-3" />
                                    {t("recommendedOption")}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{optDesc}</p>
                            </div>
                            {isSelected && (
                              <Check className="w-5 h-5 text-primary flex-shrink-0 ml-2" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Note */}
                  {hasSelection && !isApproved && (
                    <div className="space-y-2">
                      <Label className="text-sm">{t("addNote")}</Label>
                      <textarea
                        value={notes[clause.id] || ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [clause.id]: e.target.value }))}
                        onBlur={() => handleSaveNote(clause.id)}
                        placeholder={t("notePlaceholder")}
                        className="input-brutal w-full h-20 resize-none text-sm"
                      />
                    </div>
                  )}
                  {rec?.note && isApproved && (
                    <div className="p-3 bg-muted/30 border border-border rounded-xl text-sm">
                      <p className="text-xs text-muted-foreground mb-1">{t("lawyerNote")}</p>
                      <p>{rec.note}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Send to Customer section - only when approved */}
      {isApproved && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">{t("sendToCustomer")}</h2>

          {vettedStatus && !vettedStatus.active ? (
            <>
              <div className="card-brutal border-dashed relative">
                <div className="absolute top-4 right-4 w-8 h-8 bg-muted flex items-center justify-center rounded-full">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("sendRequiresSubscription")}
                </p>
                <div className="flex items-center gap-3">
                  {vettedStatus.selfServiceUpgrade && vettedStatus.skillPackageId && (
                    <button
                      onClick={() => setShowEnableModal(true)}
                      className="btn-brutal text-sm"
                    >
                      {t("enableSubscription")}
                    </button>
                  )}
                  <Link
                    href="/billing"
                    className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    {t("viewBilling")}
                  </Link>
                </div>
              </div>
              {vettedStatus.selfServiceUpgrade && vettedStatus.skillPackageId && (
                <EnableFeatureModal
                  open={showEnableModal}
                  onClose={() => setShowEnableModal(false)}
                  skillPackageId={vettedStatus.skillPackageId}
                  skillName="Vetted Contracts"
                />
              )}
            </>
          ) : (
            <div className="card-brutal space-y-4">
              <div className="space-y-2">
                <Label>{t("clientEmail")} *</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="client@company.com"
                  className="input-brutal"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("clientName")}</Label>
                  <Input
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="John Smith"
                    className="input-brutal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("clientCompany")}</Label>
                  <Input
                    value={inviteCompany}
                    onChange={(e) => setInviteCompany(e.target.value)}
                    placeholder="Acme Corp"
                    className="input-brutal"
                  />
                </div>
              </div>
              <button
                onClick={handleSendInvitation}
                disabled={!inviteEmail.trim() || sendInvitation.isPending}
                className="btn-brutal flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendInvitation.isPending ? (
                  t("sending")
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {t("sendInvitation")}
                  </>
                )}
              </button>
            </div>
          )}

          {/* Invitations list */}
          {vetting.clientInvitations.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t("clientInvitations")}
              </h3>
              {vetting.clientInvitations.map((inv) => (
                <div key={inv.id} className="card-brutal p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{inv.email}</p>
                    {inv.contactName && (
                      <p className="text-xs text-muted-foreground">{inv.contactName}{inv.company ? ` — ${inv.company}` : ""}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(inv.sentAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${
                    inv.status === "ACCEPTED" ? "bg-primary/10 text-primary"
                    : inv.status === "EXPIRED" ? "bg-destructive/10 text-destructive"
                    : inv.status === "CANCELLED" ? "bg-muted text-muted-foreground"
                    : "bg-warning/10 text-warning"
                  }`}>
                    {inv.status === "ACCEPTED" && <CheckCircle2 className="w-3 h-3" />}
                    {inv.status === "PENDING" && <Clock className="w-3 h-3" />}
                    {inv.status === "EXPIRED" && <XCircle className="w-3 h-3" />}
                    {t(`invitation${inv.status.charAt(0) + inv.status.slice(1).toLowerCase()}`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
