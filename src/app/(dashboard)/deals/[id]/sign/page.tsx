"use client";

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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NextIntlClientProvider, useTranslations, useLocale } from "next-intl";
import { formatDateTime } from "@/lib/date";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";

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
  const contractLang = (deal as any)?.contractLanguage || "en";
  const messages = contractLang === "es" ? esMessages : enMessages;

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
  const [detailsForm, setDetailsForm] = useState({
    legalName: "",
    address: "",
    taxId: "",
    signatoryName: "",
    signatoryTitle: "",
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
      setDetailsForm({
        legalName: saved.legalName,
        address: saved.address,
        taxId: saved.taxId || "",
        signatoryName: saved.signatoryName,
        signatoryTitle: saved.signatoryTitle,
      });
    } else {
      setDetailsForm((prev) => ({
        ...prev,
        legalName: prev.legalName || signingDetails.own.company || "",
        signatoryName: prev.signatoryName || signingDetails.own.name || "",
      }));
    }
  }, [signingDetails]);

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
  const isSoloMode = (deal as any)?.dealMode === "SOLO";

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
      },
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/deals/${dealId}`)}
            className="p-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{t("eSignature")}</h1>
            <p className="text-sm text-muted-foreground">
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
        <div className={`grid grid-cols-1 ${isSoloMode ? "" : "md:grid-cols-2"} gap-6 mb-6`}>
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{isSoloMode ? t("signingParty") : t("partyA")}</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                  {(initiator?.name || initiator?.email || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{initiator?.name || initiator?.email}</p>
                  {initiator?.company && (
                    <p className="text-sm text-muted-foreground">{initiator.company}</p>
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
                  <div className="w-10 h-10 bg-muted flex items-center justify-center text-muted-foreground font-semibold">
                    {(respondent?.name || respondent?.email || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{respondent?.name || respondent?.email}</p>
                    {respondent?.company && (
                      <p className="text-sm text-muted-foreground">{respondent.company}</p>
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
          <div className="space-y-2 max-h-48 overflow-y-auto">
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

        <div className={`grid grid-cols-1 ${isSoloMode ? "" : "md:grid-cols-2"} gap-6`}>
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
                    setDetailsForm({
                      legalName: saved.legalName,
                      address: saved.address,
                      taxId: saved.taxId || "",
                      signatoryName: saved.signatoryName,
                      signatoryTitle: saved.signatoryTitle,
                    });
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
                              className="text-2xl text-center text-primary"
                              style={{ fontFamily: "var(--font-signature), 'Brush Script MT', cursive" }}
                            >
                              {currentPartySignature}
                            </p>
                          </div>
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
                    </div>

                    <DownloadLinks dealId={dealId} className="mt-6" />
                  </div>
                );
              })()}
            </>
          )}
        </div>
      ) : (
        <div className="card-brutal text-center py-6">
          <FileSignature className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">{t("readyForSignatures")}</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            {t("readyForSignaturesDescription")}
          </p>
          <div className="flex items-center justify-center gap-3 mb-4">
            <button
              onClick={() => initiateSigning.mutate({ dealRoomId: dealId })}
              disabled={initiateSigning.isPending}
              className="btn-brutal flex items-center gap-2"
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
          </div>
          <DownloadLinks dealId={dealId} className="mb-4" />
          <p className="text-xs text-muted-foreground">
            {t("canSignImmediately")}
          </p>
        </div>
      )}

      {/* Legal Notice */}
      <div className="card-brutal bg-muted/30">
        <p className="text-xs text-muted-foreground">
          <strong>{t("legalNotice")}</strong> {t("legalNoticeText")}
        </p>
      </div>
    </div>
  );
}
