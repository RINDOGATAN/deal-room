"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileSignature,
  AlertCircle,
  Check,
  Download,
  Clock,
  Loader2,
  FileText,
  Building,
  User,
  PenTool,
  Shield,
  MapPin,
  Hash,
  Briefcase,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Copy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NextIntlClientProvider, useTranslations, useLocale } from "next-intl";
import { formatDateTime } from "@/lib/date";
import { useContractMessages } from "@/lib/use-contract-messages";

function DownloadLinks({ dealId, className }: { dealId: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-1.5 text-xs text-muted-foreground ${className ?? ""}`}>
      <Download className="w-3.5 h-3.5 flex-shrink-0" />
      <a href={`/api/deals/${dealId}/document`} className="hover:text-foreground underline underline-offset-2">PDF</a>
      <span aria-hidden>·</span>
      <a href={`/api/deals/${dealId}/document/docx`} className="hover:text-foreground underline underline-offset-2">DOCX</a>
      <span aria-hidden>·</span>
      <a href={`/api/deals/${dealId}/document/txt`} className="hover:text-foreground underline underline-offset-2">TXT</a>
    </div>
  );
}

/** Outer wrapper: determines contract language and provides correct locale */
export default function SigningPage() {
  const params = useParams();
  const dealId = params.id as string;
  const { data: deal } = trpc.deal.getById.useQuery({ id: dealId });
  const contractLang = deal?.contractLanguage || "en";
  const messages = useContractMessages(contractLang);

  if (!messages) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="card-brutal animate-pulse h-16"></div>
        <div className="card-brutal animate-pulse h-64"></div>
      </div>
    );
  }

  return (
    <NextIntlClientProvider locale={contractLang} messages={messages}>
      <SigningContent dealId={dealId} />
    </NextIntlClientProvider>
  );
}

/** Inner component: all UI and hooks, picks up contract locale from provider */
function SigningContent({ dealId }: { dealId: string }) {
  const router = useRouter();
  const t = useTranslations("signing");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [typedSignature, setTypedSignature] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);

  // Execution details form state
  const [detailsForm, setDetailsForm] = useState<{
    legalName: string;
    address: string;
    taxId: string;
    signatoryName: string;
    signatoryTitle: string;
    fillRole: "CONTROLLER" | "PROCESSOR";
  }>({
    legalName: "",
    address: "",
    taxId: "",
    signatoryName: "",
    signatoryTitle: "",
    fillRole: "PROCESSOR",
  });

  const { data: deal, isLoading: dealLoading } = trpc.deal.getById.useQuery({ id: dealId });
  const { data: signingRequest, isLoading: signingLoading, refetch } = trpc.signing.getRequest.useQuery({ dealRoomId: dealId });
  const { data: reviewStatus } = trpc.attorneyReview.getReviewStatus.useQuery({ dealRoomId: dealId });
  const { data: signingDetails, isLoading: detailsLoading, refetch: refetchDetails } = trpc.signing.getSigningDetails.useQuery({ dealRoomId: dealId });

  // Pre-fill form from saved details or party info
  useEffect(() => {
    if (!signingDetails) return;
    const saved = signingDetails.own.signingDetails;
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates the execution-details form once from the fetched signing details; the form is user-editable afterwards so it cannot be derived during render
      setDetailsForm((prev) => ({
        legalName: saved.legalName,
        address: saved.address,
        taxId: saved.taxId || "",
        signatoryName: saved.signatoryName,
        signatoryTitle: saved.signatoryTitle,
        fillRole: (saved as { fillRole?: "CONTROLLER" | "PROCESSOR" }).fillRole || prev.fillRole,
      }));
    } else {
      setDetailsForm((prev) => ({
        ...prev,
        legalName: prev.legalName || signingDetails.own.company || "",
        signatoryName: prev.signatoryName || signingDetails.own.name || "",
      }));
    }
  }, [signingDetails]);

  // Reflect the Controller/Processor choice made at deal creation. The deal's
  // soloFillRole column is the source of truth; this keeps the selector in sync
  // so the signing path agrees with whatever was chosen up front (and with the
  // direct-download path). Only fires when the value actually changes.
  const soloFillRoleFromDeal = (deal as { soloFillRole?: "CONTROLLER" | "PROCESSOR" | null } | undefined)?.soloFillRole;
  useEffect(() => {
    if (soloFillRoleFromDeal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs the user-editable form with the server-side soloFillRole source of truth; deriving during render would drop subsequent user edits
      setDetailsForm((f) => ({ ...f, fillRole: soloFillRoleFromDeal }));
    }
  }, [soloFillRoleFromDeal]);

  const submitDetails = trpc.signing.submitSigningDetails.useMutation({
    onSuccess: () => {
      toast.success(t("signingDetails.saved"));
      refetchDetails();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const initiateSigning = trpc.signing.initiate.useMutation({
    onSuccess: () => {
      toast.success(t("toastMessages.signingStarted"));
      refetch();
    },
    onError: (error) => {
      toast.error(t("toastMessages.initiationFailed", { error: error.message }));
    },
  });

  const recordSignature = trpc.signing.recordSignature.useMutation({
    onSuccess: () => {
      toast.success(t("toastMessages.signatureRecorded"));
      setTypedSignature("");
      setConfirmChecked(false);
      refetch();
    },
    onError: (error) => {
      toast.error(t("toastMessages.signatureFailed", { error: error.message }));
    },
  });

  // Firmas hand-off: each party can self-mint a hand-off (default),
  // and the initiator can additionally mint on the respondent's
  // behalf (the "send the link by email" case).
  const requestFirmasHandoff = trpc.signing.requestFirmasHandoff.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.emailedTo ? t("toastMessages.firmasSent") : t("toastMessages.firmasMinted"),
      );
      refetch();
    },
    onError: (error) => {
      toast.error(t("toastMessages.firmasSendFailed", { error: error.message }));
    },
  });

  // Cancel: clear my own Firmas token before I've signed, so I can
  // switch back to type-to-sign. Undo: clear my recorded signature
  // entirely; only allowed when the counterparty hasn't yet signed.
  const cancelFirmasHandoff = trpc.signing.cancelFirmasHandoff.useMutation({
    onSuccess: () => {
      toast.success(t("toastMessages.firmasCancelled"));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  const undoSignature = trpc.signing.undoSignature.useMutation({
    onSuccess: () => {
      toast.success(t("toastMessages.signatureUndone"));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Desktop poller: active while EITHER party's hand-off is in
  // flight. The query disables itself the moment status leaves
  // SENT/PARTIALLY_SIGNED, so it stops on its own when both parties
  // have settled (or the request gets DECLINED).
  const firmasPollEnabled =
    (!!signingRequest?.initiatorFirmasToken ||
      !!signingRequest?.respondentFirmasToken) &&
    (signingRequest?.status === "SENT" ||
      signingRequest?.status === "PARTIALLY_SIGNED");
  const { data: firmasStatusData } = trpc.signing.firmasStatus.useQuery(
    { dealRoomId: dealId },
    { refetchInterval: 3000, enabled: firmasPollEnabled },
  );

  // When the poll observes either party's signature, refresh the main
  // signingRequest snapshot so the existing party-by-party signature
  // cards repaint with the new state.
  const initiatorFirmasSignedAt = firmasStatusData?.initiator?.signedAt ?? null;
  const respondentFirmasSignedAt = firmasStatusData?.respondent?.signedAt ?? null;
  useEffect(() => {
    if (initiatorFirmasSignedAt || respondentFirmasSignedAt) {
      refetch();
    }
  }, [initiatorFirmasSignedAt, respondentFirmasSignedAt, refetch]);

  const isLoading = dealLoading || signingLoading || detailsLoading;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="card-brutal animate-pulse h-16"></div>
        <div className="card-brutal animate-pulse h-64"></div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="card-brutal border-yellow-500">
        <div className="flex items-center gap-3 text-yellow-600">
          <AlertCircle className="w-5 h-5" />
          <span>{t("failedToLoad")}</span>
        </div>
      </div>
    );
  }

  const initiator = deal.parties.find((p) => p.role === "INITIATOR");
  const respondent = deal.parties.find((p) => p.role === "RESPONDENT");
  const isInitiator = deal.currentUserRole === "INITIATOR";
  const isSoloMode = deal?.dealMode === "SOLO";
  // DPA in solo mode is the one asymmetric-role contract where the filling
  // party must declare whether they are the Controller or the Processor; the
  // other party's block is left blank in the output.
  const isDpaSolo = isSoloMode && deal.contractTemplate?.contractType === "DPA";

  // Check if all clauses are agreed
  const allAgreed = deal.clauses.every((c) => c.status === "AGREED");

  if (!allAgreed) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/deals/${dealId}`)}
            className="p-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{t("eSignature")}</h1>
            <p className="text-sm text-muted-foreground">{deal.name}</p>
          </div>
        </div>

        <div className="card-brutal border-yellow-500 text-center py-8">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">{t("notReadyForSigning")}</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {t("allClausesMustBeAgreed")}
          </p>
          <button
            onClick={() => router.push(`/deals/${dealId}/review`)}
            className="btn-brutal-outline"
          >
            {t("returnToReview")}
          </button>
        </div>
      </div>
    );
  }

  // Block signing while attorney review is in progress
  if (reviewStatus && !reviewStatus.canProceedToSigning) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/deals/${dealId}`)}
            className="p-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{t("eSignature")}</h1>
            <p className="text-sm text-muted-foreground">{deal.name}</p>
          </div>
        </div>

        <div className="card-brutal border-purple-500/50 text-center py-8">
          <Shield className="w-12 h-12 text-purple-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">{t("attorneyReviewInProgress")}</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {t("signingAfterReview")}
          </p>
          <button
            onClick={() => router.push(`/deals/${dealId}/review`)}
            className="btn-brutal-outline"
          >
            {t("returnToReview")}
          </button>
        </div>
      </div>
    );
  }

  // Execution details state
  const ownDetailsConfirmed = !!signingDetails?.own.signingDetails;
  const otherDetailsConfirmed = !!signingDetails?.other?.signingDetails;
  const otherDetails = signingDetails?.other?.signingDetails;

  // Determine if current party has already signed (frozen details)
  const currentPartySigned = signingRequest
    ? deal.currentUserRole === "INITIATOR"
      ? !!signingRequest.initiatorSignedAt
      : !!signingRequest.respondentSignedAt
    : false;

  const detailsFormValid =
    detailsForm.legalName.trim() &&
    detailsForm.address.trim() &&
    detailsForm.signatoryName.trim() &&
    detailsForm.signatoryTitle.trim();

  function handleSaveDetails() {
    submitDetails.mutate({
      dealRoomId: dealId,
      details: {
        legalName: detailsForm.legalName.trim(),
        address: detailsForm.address.trim(),
        taxId: detailsForm.taxId.trim() || undefined,
        signatoryName: detailsForm.signatoryName.trim(),
        signatoryTitle: detailsForm.signatoryTitle.trim(),
        ...(isDpaSolo ? { fillRole: detailsForm.fillRole } : {}),
      },
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => router.push(`/deals/${dealId}`)}
            className="p-2 text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{t("eSignature")}</h1>
            <p className="text-sm text-muted-foreground truncate">
              {deal.name} • {deal.contractTemplate.displayName}
            </p>
          </div>
        </div>
      </div>

      {/* Certification Status */}
      {signingRequest && (
        <div className={`card-brutal flex items-start gap-3 ${
          signingRequest.ceremonyId
            ? "border-green-500/30 bg-green-500/5"
            : "border-muted bg-muted/20"
        }`}>
          {signingRequest.ceremonyId ? (
            <>
              <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-600 text-sm">{t("certifiedDocument")}</p>
                <p className="text-xs text-muted-foreground">{t("certifiedSigningDescription")}</p>
              </div>
            </>
          ) : (
            <>
              <ShieldAlert className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-muted-foreground text-sm">{t("uncertifiedDocument")}</p>
                <p className="text-xs text-muted-foreground">{t("uncertifiedSigningDescription")}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Contract Summary */}
      <div className="card-brutal">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-muted-foreground" />
          {t("contractSummary")}
        </h2>
        <div className={`grid grid-cols-1 ${isSoloMode ? "" : "sm:grid-cols-2"} gap-6 mb-6`}>
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{isSoloMode ? t("signingParty") : t("partyA")}</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary flex items-center justify-center text-primary-foreground font-semibold flex-shrink-0">
                  {(initiator?.name || initiator?.email || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{initiator?.name || initiator?.email}</p>
                  {initiator?.company && (
                    <p className="text-sm text-muted-foreground truncate">{initiator.company}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          {!isSoloMode && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{t("partyB")}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted flex items-center justify-center text-muted-foreground font-semibold flex-shrink-0">
                    {(respondent?.name || respondent?.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{respondent?.name || respondent?.email}</p>
                    {respondent?.company && (
                      <p className="text-sm text-muted-foreground truncate">{respondent.company}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Agreed Terms Summary */}
        <div className="border-t border-border pt-4">
          <p className="text-sm text-muted-foreground mb-3">{t("agreedTerms", { count: deal.clauses.length })}</p>
          <div className="space-y-2 max-h-72 sm:max-h-64 overflow-y-auto overscroll-contain">
            {deal.clauses.map((clause) => {
              const selection = clause.selections[0];
              return (
                <div key={clause.id} className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
                  <div className="flex items-start gap-2 flex-shrink-0 max-w-[50%]">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{clause.clauseTemplate.title}</span>
                  </div>
                  <span className="text-sm text-muted-foreground text-right">
                    {selection?.option?.label || "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Execution Details Alert */}
      {!ownDetailsConfirmed && (
        <div className="card-brutal border-warning/50 bg-warning/10">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-warning">{t("signingDetails.importantNote")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Execution Details */}
      <div className="card-brutal">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Building className="w-5 h-5 text-muted-foreground" />
          {t("signingDetails.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t("signingDetails.description")}
        </p>

        <div className={`grid grid-cols-1 ${isSoloMode ? "" : "sm:grid-cols-2"} gap-6`}>
          {/* Own Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {t("signingDetails.yourDetails")}
              </h3>
              {ownDetailsConfirmed && (
                <Badge className="bg-primary/20 text-primary">
                  <Check className="w-3 h-3 mr-1" />
                  {t("signingDetails.confirmed")}
                </Badge>
              )}
            </div>

            {ownDetailsConfirmed && !currentPartySigned ? (
              // Show confirmed details with edit option
              <div className="space-y-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-start gap-2">
                  <Building className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{signingDetails!.own.signingDetails!.legalName}</p>
                    <p className="text-xs text-muted-foreground">{t("signingDetails.legalName")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm">{signingDetails!.own.signingDetails!.address}</p>
                    <p className="text-xs text-muted-foreground">{t("signingDetails.address")}</p>
                  </div>
                </div>
                {signingDetails!.own.signingDetails!.taxId && (
                  <div className="flex items-start gap-2">
                    <Hash className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm">{signingDetails!.own.signingDetails!.taxId}</p>
                      <p className="text-xs text-muted-foreground">{t("signingDetails.taxId")}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm">{signingDetails!.own.signingDetails!.signatoryName}</p>
                    <p className="text-xs text-muted-foreground">{t("signingDetails.signatoryName")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm">{signingDetails!.own.signingDetails!.signatoryTitle}</p>
                    <p className="text-xs text-muted-foreground">{t("signingDetails.signatoryTitle")}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const saved = signingDetails!.own.signingDetails!;
                    setDetailsForm((prev) => ({
                      legalName: saved.legalName,
                      address: saved.address,
                      taxId: saved.taxId || "",
                      signatoryName: saved.signatoryName,
                      signatoryTitle: saved.signatoryTitle,
                      fillRole: (saved as { fillRole?: "CONTROLLER" | "PROCESSOR" }).fillRole || prev.fillRole,
                    }));
                    // Clear saved to show form again
                    submitDetails.reset();
                    refetchDetails();
                  }}
                  className="text-xs text-primary hover:underline mt-2"
                >
                  {t("signingDetails.edit")}
                </button>
              </div>
            ) : currentPartySigned ? (
              // Frozen after signing
              <div className="space-y-3 p-4 bg-muted/30 border border-border rounded-xl opacity-75">
                <div className="flex items-start gap-2">
                  <Building className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm">{signingDetails?.own.signingDetails?.legalName}</p>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm">{signingDetails?.own.signingDetails?.address}</p>
                </div>
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm">{signingDetails?.own.signingDetails?.signatoryName}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm">{signingDetails?.own.signingDetails?.signatoryTitle}</p>
                </div>
                <p className="text-xs text-muted-foreground italic">{t("signingDetails.frozenAfterSigning")}</p>
              </div>
            ) : (
              // Editable form
              <div className="space-y-3">
                {isDpaSolo && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t("signingDetails.completeAs")}
                    </label>
                    <p className="text-xs text-muted-foreground mb-2">
                      {t("signingDetails.completeAsHint")}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(["PROCESSOR", "CONTROLLER"] as const).map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setDetailsForm((f) => ({ ...f, fillRole: role }))}
                          aria-pressed={detailsForm.fillRole === role}
                          className={`p-3 text-sm border rounded-xl text-left transition-colors min-h-[44px] ${
                            detailsForm.fillRole === role
                              ? "border-primary bg-primary/5 font-medium"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          {t(`signingDetails.role.${role.toLowerCase()}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">{t("signingDetails.legalName")}</label>
                  <Input
                    value={detailsForm.legalName}
                    onChange={(e) => setDetailsForm((f) => ({ ...f, legalName: e.target.value }))}
                    placeholder={t("signingDetails.legalNamePlaceholder")}
                    className="input-brutal"
                    autoComplete="organization"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("signingDetails.address")}</label>
                  <Input
                    value={detailsForm.address}
                    onChange={(e) => setDetailsForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder={t("signingDetails.addressPlaceholder")}
                    className="input-brutal"
                    autoComplete="street-address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t("signingDetails.taxId")}
                    <span className="text-muted-foreground font-normal ml-1">({tCommon("optional")})</span>
                  </label>
                  <Input
                    value={detailsForm.taxId}
                    onChange={(e) => setDetailsForm((f) => ({ ...f, taxId: e.target.value }))}
                    placeholder={t("signingDetails.taxIdPlaceholder")}
                    className="input-brutal"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("signingDetails.signatoryName")}</label>
                  <Input
                    value={detailsForm.signatoryName}
                    onChange={(e) => setDetailsForm((f) => ({ ...f, signatoryName: e.target.value }))}
                    placeholder={t("signingDetails.signatoryNamePlaceholder")}
                    className="input-brutal"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("signingDetails.signatoryTitle")}</label>
                  <Input
                    value={detailsForm.signatoryTitle}
                    onChange={(e) => setDetailsForm((f) => ({ ...f, signatoryTitle: e.target.value }))}
                    placeholder={t("signingDetails.signatoryTitlePlaceholder")}
                    className="input-brutal"
                    autoComplete="organization-title"
                  />
                </div>
                <button
                  onClick={handleSaveDetails}
                  disabled={!detailsFormValid || submitDetails.isPending}
                  className="w-full btn-brutal flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitDetails.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("signingDetails.saving")}
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {t("signingDetails.confirmDetails")}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Other Party Details (hidden in SOLO mode) */}
          {!isSoloMode && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("signingDetails.otherPartyDetails")}
                </h3>
                {otherDetailsConfirmed ? (
                  <Badge className="bg-primary/20 text-primary">
                    <Check className="w-3 h-3 mr-1" />
                    {t("signingDetails.confirmed")}
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <Clock className="w-3 h-3 mr-1" />
                    {tCommon("pending")}
                  </Badge>
                )}
              </div>

              {otherDetailsConfirmed && otherDetails ? (
                <div className="space-y-3 p-4 bg-muted/30 border border-border rounded-xl">
                  <div className="flex items-start gap-2">
                    <Building className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{otherDetails.legalName}</p>
                      <p className="text-xs text-muted-foreground">{t("signingDetails.legalName")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm">{otherDetails.address}</p>
                      <p className="text-xs text-muted-foreground">{t("signingDetails.address")}</p>
                    </div>
                  </div>
                  {otherDetails.taxId && (
                    <div className="flex items-start gap-2">
                      <Hash className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm">{otherDetails.taxId}</p>
                        <p className="text-xs text-muted-foreground">{t("signingDetails.taxId")}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm">{otherDetails.signatoryName}</p>
                      <p className="text-xs text-muted-foreground">{t("signingDetails.signatoryName")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm">{otherDetails.signatoryTitle}</p>
                      <p className="text-xs text-muted-foreground">{t("signingDetails.signatoryTitle")}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 border border-dashed border-border rounded-xl text-center">
                  <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t("signingDetails.waitingForOtherParty")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Per-party Firmas hand-off cards. Each party with an active
          hand-off (token minted, not yet signed) OR a completed
          Firmas signature gets a card. The current user sees "open
          on phone" framing for their own card and "waiting for them"
          framing for the counterparty's. */}
      {!isSoloMode && (
        <>
          {(() => {
            const initiatorToken =
              firmasStatusData?.initiator?.firmasToken ??
              signingRequest?.initiatorFirmasToken ??
              null;
            const respondentToken =
              firmasStatusData?.respondent?.firmasToken ??
              signingRequest?.respondentFirmasToken ??
              null;
            const initiatorName =
              initiator?.user?.name || initiator?.name || initiator?.email || t("partyA");
            const respondentName =
              respondent?.user?.name || respondent?.name || respondent?.email || t("partyB");
            const governingLaw =
              (deal as { governingLaw?: string | null })?.governingLaw ?? null;
            return (
              <>
                {initiatorToken && (
                  <FirmasHandoffCard
                    isSelf={isInitiator}
                    partyName={initiatorName}
                    token={initiatorToken}
                    firmasSentAt={
                      firmasStatusData?.initiator?.firmasSentAt ??
                      signingRequest?.initiatorFirmasSentAt ??
                      null
                    }
                    signedAt={
                      firmasStatusData?.initiator?.signedAt ??
                      signingRequest?.initiatorSignedAt ??
                      null
                    }
                    attestedName={firmasStatusData?.initiator?.attestedName ?? null}
                    attestedRegion={firmasStatusData?.initiator?.attestedRegion ?? null}
                    dealId={dealId}
                    locale={locale}
                    governingLaw={governingLaw}
                  />
                )}
                {respondentToken && (
                  <FirmasHandoffCard
                    isSelf={!isInitiator}
                    partyName={respondentName}
                    token={respondentToken}
                    firmasSentAt={
                      firmasStatusData?.respondent?.firmasSentAt ??
                      signingRequest?.respondentFirmasSentAt ??
                      null
                    }
                    signedAt={
                      firmasStatusData?.respondent?.signedAt ??
                      signingRequest?.respondentSignedAt ??
                      null
                    }
                    attestedName={firmasStatusData?.respondent?.attestedName ?? null}
                    attestedRegion={firmasStatusData?.respondent?.attestedRegion ?? null}
                    dealId={dealId}
                    locale={locale}
                    governingLaw={governingLaw}
                  />
                )}
              </>
            );
          })()}
        </>
      )}

      {/* Signing Status */}
      {signingRequest ? (
        <div className="card-brutal">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-muted-foreground" />
            {t("signingStatus")}
          </h2>

          <div className={`grid grid-cols-1 ${isSoloMode ? "" : "sm:grid-cols-2"} gap-4 mb-6`}>
            <div className="p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{isSoloMode ? t("signature") : t("partyASignature")}</span>
                {signingRequest.initiatorSignedAt ? (
                  <Badge className="bg-primary/20 text-primary">
                    <Check className="w-3 h-3 mr-1" />
                    {t("signed")}
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <Clock className="w-3 h-3 mr-1" />
                    {tCommon("pending")}
                  </Badge>
                )}
              </div>
              {signingRequest.initiatorSignedAt && signingRequest.initiatorSignature && (
                <p
                  className="text-lg text-primary mt-2"
                  style={{ fontFamily: "var(--font-signature), 'Brush Script MT', cursive" }}
                >
                  {signingRequest.initiatorSignature}
                </p>
              )}
              {signingRequest.initiatorSignedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateTime(new Date(signingRequest.initiatorSignedAt), { locale, governingLaw: deal?.governingLaw })}
                </p>
              )}
            </div>
            {!isSoloMode && (
              <div className="p-4 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{t("partyBSignature")}</span>
                  {signingRequest.respondentSignedAt ? (
                    <Badge className="bg-primary/20 text-primary">
                      <Check className="w-3 h-3 mr-1" />
                      {t("signed")}
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <Clock className="w-3 h-3 mr-1" />
                      {tCommon("pending")}
                    </Badge>
                  )}
                </div>
                {signingRequest.respondentSignedAt && signingRequest.respondentSignature && (
                  <p
                    className="text-lg text-primary mt-2"
                    style={{ fontFamily: "var(--font-signature), 'Brush Script MT', cursive" }}
                  >
                    {signingRequest.respondentSignature}
                  </p>
                )}
                {signingRequest.respondentSignedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateTime(new Date(signingRequest.respondentSignedAt), { locale, governingLaw: deal?.governingLaw })}
                  </p>
                )}
              </div>
            )}
          </div>

          {signingRequest.status === "COMPLETED" ? (
            <div className="text-center py-6 border-t border-border">
              <Check className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">{t("contractSigned")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("contractSignedDescription")}
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <a
                  href={`/api/deals/${dealId}/document`}
                  className="btn-brutal inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {t("downloadSignedContract")}
                </a>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <a href={`/api/deals/${dealId}/document/docx`} className="hover:text-foreground underline underline-offset-2">DOCX</a>
                  <span aria-hidden>·</span>
                  <a href={`/api/deals/${dealId}/document/txt`} className="hover:text-foreground underline underline-offset-2">TXT</a>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Type-to-Sign Section */}
              {(() => {
                const currentPartyHasSigned = deal.currentUserRole === "INITIATOR"
                  ? signingRequest.initiatorSignedAt
                  : signingRequest.respondentSignedAt;
                const currentPartySignature = deal.currentUserRole === "INITIATOR"
                  ? signingRequest.initiatorSignature
                  : signingRequest.respondentSignature;
                const otherPartyHasSigned = deal.currentUserRole === "INITIATOR"
                  ? signingRequest.respondentSignedAt
                  : signingRequest.initiatorSignedAt;

                if (currentPartyHasSigned) {
                  // Undo is only available while the other party
                  // hasn't yet committed. After both signatures, the
                  // contract is COMPLETED and locked in.
                  const canUndo = !otherPartyHasSigned;
                  return (
                    <div className="py-6 border-t border-border">
                      <div className="text-center mb-4">
                        <Check className="w-8 h-8 text-primary mx-auto mb-3" />
                        <h3 className="text-lg font-semibold mb-2">{t("youHaveSigned")}</h3>
                        <p className="text-muted-foreground">
                          {otherPartyHasSigned
                            ? t("waitingForDocument")
                            : t("waitingForOtherParty")}
                        </p>
                      </div>
                      {currentPartySignature && (
                        <div className="max-w-md mx-auto">
                          <p className="text-xs text-muted-foreground mb-2 text-center">{t("yourSignature")}</p>
                          <div className="p-4 border border-primary/30 bg-muted/20">
                            <p
                              className="text-2xl text-center text-primary break-words overflow-hidden"
                              style={{ fontFamily: "var(--font-signature), 'Brush Script MT', cursive" }}
                            >
                              {currentPartySignature}
                            </p>
                          </div>
                        </div>
                      )}
                      {canUndo && (
                        <div className="text-center mt-4">
                          <button
                            onClick={() =>
                              undoSignature.mutate({ dealRoomId: dealId })
                            }
                            disabled={undoSignature.isPending}
                            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50"
                          >
                            {undoSignature.isPending
                              ? t("undoingSignature")
                              : t("undoSignature")}
                          </button>
                        </div>
                      )}
                      <DownloadLinks dealId={dealId} className="mt-6" />
                    </div>
                  );
                }

                // Gate: require execution details before signing
                if (!ownDetailsConfirmed) {
                  return (
                    <div className="py-6 border-t border-border text-center">
                      <AlertCircle className="w-8 h-8 text-warning mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        {t("signingDetails.requiredBeforeSigning")}
                      </p>
                    </div>
                  );
                }

                // If this party already requested a Firmas hand-off,
                // the FirmasHandoffCard at the top of the page is
                // doing the work. Replace the type-to-sign UI with a
                // pointer so the user doesn't accidentally do both.
                // "Switch back" lets them abandon Firmas in favour of
                // type-to-sign, since they may have picked it by
                // mistake or changed their mind.
                const myFirmasToken = deal.currentUserRole === "INITIATOR"
                  ? signingRequest.initiatorFirmasToken
                  : signingRequest.respondentFirmasToken;
                if (myFirmasToken) {
                  return (
                    <div className="py-6 border-t border-border text-center">
                      <Smartphone className="w-8 h-8 text-primary mx-auto mb-3" />
                      <p className="font-semibold mb-1">{t("firmas.usingFirmas")}</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        {t("firmas.usingFirmasDescription")}
                      </p>
                      <button
                        onClick={() =>
                          cancelFirmasHandoff.mutate({ dealRoomId: dealId })
                        }
                        disabled={cancelFirmasHandoff.isPending}
                        className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50"
                      >
                        {cancelFirmasHandoff.isPending
                          ? t("firmas.cancelling")
                          : t("firmas.cancelAndType")}
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="py-6 border-t border-border">
                    <div className="max-w-md mx-auto">
                      <div className="text-center mb-6">
                        <PenTool className="w-8 h-8 text-primary mx-auto mb-3" />
                        <h3 className="text-lg font-semibold mb-2">{t("signTheContract")}</h3>
                        <p className="text-sm text-muted-foreground">
                          {t("typeYourFullName")}
                        </p>
                      </div>

                      {/* Signature Input */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            {t("typeFullName")}
                          </label>
                          <Input
                            type="text"
                            value={typedSignature}
                            onChange={(e) => setTypedSignature(e.target.value)}
                            placeholder={t("typeFullNamePlaceholder")}
                            className="input-brutal text-lg"
                          />
                        </div>

                        {/* Signature Preview */}
                        {typedSignature && (
                          <div>
                            <label className="block text-xs text-muted-foreground mb-2">
                              {t("signaturePreview")}
                            </label>
                            <div className="p-6 border-2 border-dashed border-border bg-muted/20 text-center overflow-hidden">
                              <p
                                className="text-xl sm:text-2xl md:text-3xl text-foreground break-words"
                                style={{ fontFamily: "var(--font-signature), 'Brush Script MT', cursive" }}
                              >
                                {typedSignature}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Confirmation Checkbox */}
                        <label className="flex items-start gap-3 p-3 border border-border hover:bg-muted/20 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmChecked}
                            onChange={(e) => setConfirmChecked(e.target.checked)}
                            className="mt-1 accent-primary"
                          />
                          <span className="text-sm text-muted-foreground">
                            {t("signatureConfirmation")}
                          </span>
                        </label>

                        {/* Sign Button */}
                        <button
                          onClick={() => {
                            if (!signingRequest || !deal.currentUserRole) return;
                            recordSignature.mutate({
                              signingRequestId: signingRequest.id,
                              partyRole: deal.currentUserRole,
                              signature: typedSignature,
                            });
                          }}
                          disabled={
                            !typedSignature.trim() ||
                            !confirmChecked ||
                            recordSignature.isPending
                          }
                          className="w-full btn-brutal flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {recordSignature.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t("signingInProgress")}
                            </>
                          ) : (
                            <>
                              <FileSignature className="w-4 h-4" />
                              {t("signContract")}
                            </>
                          )}
                        </button>
                      </div>

                      {/* Alternate signing method — Firmas on phone.
                          Mints a token for the current user's role
                          and pivots the UI into the hand-off panel
                          above. Available to either party. */}
                      {!isSoloMode && (
                        <div className="mt-6 pt-6 border-t border-border text-center">
                          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">
                            {t("firmas.orInsteadHeader")}
                          </p>
                          <button
                            onClick={() =>
                              requestFirmasHandoff.mutate({ dealRoomId: dealId })
                            }
                            disabled={requestFirmasHandoff.isPending}
                            className="btn-brutal-outline inline-flex items-center gap-2 disabled:opacity-50"
                          >
                            {requestFirmasHandoff.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t("firmas.sending")}
                              </>
                            ) : (
                              <>
                                <Smartphone className="w-4 h-4" />
                                {t("firmas.signWithFirmas")}
                              </>
                            )}
                          </button>
                          <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">
                            {t("firmas.signWithFirmasDescription")}
                          </p>
                        </div>
                      )}
                    </div>

                    <DownloadLinks dealId={dealId} className="mt-6" />
                  </div>
                );
              })()}
            </>
          )}
        </div>
      ) : (() => {
        // Dual-fill gate. Mirrors the server-side precondition in
        // signing.initiate / signing.requestFirmasHandoff. We render the buttons
        // either way so users see what's possible, but disable them
        // with a tooltip explaining *why* until both parties' details
        // are submitted. The asymmetric messaging — "add yours" vs
        // "waiting for them" — gives each side a clear next action.
        const ownDetailsFilled = !!signingDetails?.own.signingDetails;
        const otherDetailsFilled = !!signingDetails?.other?.signingDetails;
        const otherName =
          (deal.parties.find((p) => p.role !== deal.currentUserRole) as
            | { user?: { name?: string | null } | null; name?: string | null; email?: string | null }
            | undefined)?.user?.name ||
          (deal.parties.find((p) => p.role !== deal.currentUserRole) as
            | { name?: string | null; email?: string | null }
            | undefined)?.name ||
          (deal.parties.find((p) => p.role !== deal.currentUserRole) as
            | { email?: string | null }
            | undefined)?.email ||
          t("theOtherParty");

        // SOLO has no respondent, so the dual-fill collapses to
        // "your details only."
        const dualFillSatisfied = isSoloMode
          ? ownDetailsFilled
          : ownDetailsFilled && otherDetailsFilled;

        let blockReason: string | null = null;
        if (!ownDetailsFilled) {
          blockReason = t("blocked.yourDetails");
        } else if (!isSoloMode && !otherDetailsFilled) {
          blockReason = t("blocked.theirDetails", { name: otherName });
        }

        const startDisabled = initiateSigning.isPending || !dualFillSatisfied;
        const firmasDisabled = requestFirmasHandoff.isPending || !dualFillSatisfied;

        return (
          <div className="card-brutal text-center py-6">
            <FileSignature className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-2">{t("readyForSignatures")}</h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              {t("readyForSignaturesDescription")}
            </p>
            <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
              <button
                onClick={() => initiateSigning.mutate({ dealRoomId: dealId })}
                disabled={startDisabled}
                title={blockReason ?? undefined}
                aria-disabled={startDisabled}
                className="btn-brutal flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {initiateSigning.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("starting")}
                  </>
                ) : (
                  <>
                    <PenTool className="w-4 h-4" />
                    {t("startSigningProcess")}
                  </>
                )}
              </button>
              {!isSoloMode && (
                <button
                  onClick={() => requestFirmasHandoff.mutate({ dealRoomId: dealId })}
                  disabled={firmasDisabled}
                  title={blockReason ?? undefined}
                  aria-disabled={firmasDisabled}
                  className="btn-brutal-outline flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {requestFirmasHandoff.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("firmas.sending")}
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4" />
                      {t("firmas.signWithFirmas")}
                    </>
                  )}
                </button>
              )}
            </div>
            {blockReason && (
              <div className="card-brutal border-border bg-muted/30 max-w-md mx-auto mb-4 flex items-start gap-3 text-left">
                <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{blockReason}</p>
              </div>
            )}
            <DownloadLinks dealId={dealId} className="mb-4" />
            <p className="text-xs text-muted-foreground">
              {t("canSignImmediately")}
            </p>
          </div>
        );
      })()}

      {/* Legal Notice */}
      <div className="card-brutal bg-muted/30 space-y-2">
        <p className="text-xs text-muted-foreground">
          <strong>{t("legalNotice")}</strong> {t("legalNoticeText")}
        </p>
        <p className="text-xs text-muted-foreground">
          <strong>{t("simpleSignatureNotice")}</strong> {t("simpleSignatureNoticeText")}
        </p>
      </div>
    </div>
  );
}

interface FirmasHandoffCardProps {
  /** Whether the current viewer is the party whose hand-off this is. */
  isSelf: boolean;
  /** Display name of the party this card is about. */
  partyName: string;
  token: string;
  firmasSentAt: Date | null;
  signedAt: Date | null;
  attestedName: string | null;
  attestedRegion: string | null;
  dealId: string;
  locale: string;
  governingLaw: string | null;
}

/**
 * Per-party Firmas hand-off card. Three display states:
 *   - SELF + waiting:   "Open this link on your phone…" + copy-link
 *     button. The current user is being asked to scan/copy onto their
 *     own phone.
 *   - OTHER + waiting:  "Waiting for {name} to sign on their phone…"
 *     Read-only status — we don't surface their token to the watcher.
 *   - Signed (either):  "Signed by {attestedName} at {time}" with a
 *     download link.
 *
 * Pure renderer — parent owns the polling and feeds in the resolved
 * fields. Same component covers initiator and respondent hand-offs.
 */
function FirmasHandoffCard({
  isSelf,
  partyName,
  token,
  firmasSentAt,
  signedAt,
  attestedName,
  attestedRegion,
  dealId,
  locale,
  governingLaw,
}: FirmasHandoffCardProps) {
  const t = useTranslations("signing");
  const firmasBase =
    process.env.NEXT_PUBLIC_FIRMAS_BASE_URL ?? "https://www.firmas.io";
  const signUrl = `${firmasBase}/sign/${token}`;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  // Generate the QR code lazily on the client. The qrcode package is
  // dynamic-imported so it lands in its own webpack chunk and doesn't
  // bloat the sign page for users who never see a Firmas hand-off.
  useEffect(() => {
    if (!isSelf || signedAt) return;
    let cancelled = false;
    import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(signUrl, {
          width: 220,
          margin: 1,
          errorCorrectionLevel: "M",
        }),
      )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        // Silently fail — the primary "Open in Firmas" button still
        // works without the QR fallback.
      });
    return () => {
      cancelled = true;
    };
  }, [isSelf, signedAt, signUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(signUrl);
      toast.success(t("toastMessages.firmasLinkCopied"));
    } catch {
      // Clipboard API can fail in iframes / older browsers — silent
      // fallback: the link is on screen and still selectable.
    }
  }

  if (signedAt) {
    return (
      <div className="card-brutal border-primary/40 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Check className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">
              {t("firmas.signedTitle", { name: attestedName ?? partyName })}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {attestedRegion ? (
                <>
                  {t("firmas.signedFromRegion", { region: attestedRegion })}
                  {" · "}
                </>
              ) : null}
              {t("firmas.signedAt", {
                time: formatDateTime(new Date(signedAt), {
                  locale,
                  governingLaw: governingLaw ?? undefined,
                }),
              })}
            </p>
            <div className="mt-3">
              <a
                href={`/api/deals/${dealId}/document`}
                className="text-sm inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Download className="w-4 h-4" />
                {t("firmas.downloadBundle")}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Waiting state — split by who's looking. The OTHER party gets a
  // compact read-only "waiting for them" notice. The CURRENT user
  // (isSelf) gets the full hand-off surface: a big tappable
  // "Open in Firmas" button (Universal Link / App Link, which iOS
  // and Android intercept to launch the native app), a QR code for
  // the cross-device case (signing on a separate phone), and
  // copy-link / show-URL as secondary affordances.
  if (!isSelf) {
    return (
      <div className="card-brutal border-primary/30 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">
              {t("firmas.waitingForOtherTitle", { name: partyName })}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("firmas.waitingForOtherDescription", { name: partyName })}
            </p>
            {firmasSentAt ? (
              <p className="text-xs text-muted-foreground mt-1">
                {formatDateTime(new Date(firmasSentAt), {
                  locale,
                  governingLaw: governingLaw ?? undefined,
                })}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-brutal border-primary/30 bg-primary/5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{t("firmas.openOnPhoneTitle")}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("firmas.openOnPhoneDescription")}
          </p>
          {firmasSentAt ? (
            <p className="text-xs text-muted-foreground mt-1">
              {formatDateTime(new Date(firmasSentAt), {
                locale,
                governingLaw: governingLaw ?? undefined,
              })}
            </p>
          ) : null}
        </div>
      </div>

      {/* Primary action — direct anchor so iOS / Android resolves
          firmas.io/sign/<token> as a Universal Link / App Link to
          the native Firmas app if installed. Falls back to opening
          the mobile-web signer at firmas.io otherwise. rel=noopener
          isn't strictly needed for a same-window navigation, but
          some inter-app handoffs prefer it not be there — leaving
          off so iOS gets the cleanest hand-off semantics. */}
      <a
        href={signUrl}
        className="btn-brutal flex items-center justify-center gap-2 w-full text-base font-semibold py-3"
      >
        <Smartphone className="w-5 h-5" />
        {t("firmas.openInFirmas")}
      </a>

      {/* Cross-device fallback — QR code for the case where the
          signer's phone is a different device from the one viewing
          this card (e.g. initiator on desktop, signer on phone).
          Lazy-loaded so the qrcode package only enters the bundle
          when this card actually renders. */}
      <div className="mt-5 pt-5 border-t border-border/40">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 text-center">
          {t("firmas.qrLabel")}
        </p>
        <div className="flex justify-center">
          {qrDataUrl ? (
            <div className="bg-white p-3 rounded-md inline-block">
              <img
                src={qrDataUrl}
                alt={t("firmas.qrAlt")}
                width={180}
                height={180}
                className="block"
              />
            </div>
          ) : (
            <div className="w-[180px] h-[180px] bg-muted/30 rounded-md flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Secondary controls — small text buttons so they don't
          compete with the primary action above. */}
      <div className="mt-4 flex items-center justify-center gap-4 text-sm">
        <button
          onClick={copyLink}
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Copy className="w-3.5 h-3.5" />
          {t("firmas.copyLink")}
        </button>
        <span aria-hidden className="text-muted-foreground/50">·</span>
        <button
          onClick={() => setShowUrl((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
        >
          {showUrl ? t("firmas.hideUrl") : t("firmas.showUrl")}
        </button>
      </div>
      {showUrl && (
        <div className="mt-3 text-center">
          <a
            href={signUrl}
            className="text-xs text-muted-foreground break-all underline underline-offset-2 hover:text-foreground"
          >
            {signUrl}
          </a>
        </div>
      )}
    </div>
  );
}
