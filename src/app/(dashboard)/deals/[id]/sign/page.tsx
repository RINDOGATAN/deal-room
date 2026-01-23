"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileSignature,
  AlertCircle,
  Check,
  Download,
  ExternalLink,
  Clock,
  Loader2,
  FileText,
  Building,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function SigningPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;

  const { data: deal, isLoading: dealLoading } = trpc.deal.getById.useQuery({ id: dealId });
  const { data: signingRequest, isLoading: signingLoading, refetch } = trpc.signing.getRequest.useQuery({ dealRoomId: dealId });

  const initiateSigning = trpc.signing.initiate.useMutation({
    onSuccess: () => {
      toast.success("Signing initiated! Check your email for the signing link.");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to initiate signing: ${error.message}`);
    },
  });

  const isLoading = dealLoading || signingLoading;

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
      <div className="card-brutal border-destructive">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load deal</span>
        </div>
      </div>
    );
  }

  const initiator = deal.parties.find((p) => p.role === "INITIATOR");
  const respondent = deal.parties.find((p) => p.role === "RESPONDENT");
  const isInitiator = deal.currentUserRole === "INITIATOR";

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
            <h1 className="text-xl font-bold">E-Signature</h1>
            <p className="text-sm text-muted-foreground">{deal.name}</p>
          </div>
        </div>

        <div className="card-brutal border-yellow-500 text-center py-8">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Not Ready for Signing</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            All clauses must be agreed upon by both parties before the contract can be signed.
          </p>
          <button
            onClick={() => router.push(`/deals/${dealId}/review`)}
            className="btn-brutal-outline"
          >
            Return to Review
          </button>
        </div>
      </div>
    );
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
            <h1 className="text-xl font-bold">E-Signature</h1>
            <p className="text-sm text-muted-foreground">
              {deal.name} • {deal.contractTemplate.displayName}
            </p>
          </div>
        </div>
      </div>

      {/* Contract Summary */}
      <div className="card-brutal">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-muted-foreground" />
          Contract Summary
        </h2>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Party A</p>
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
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Party B</p>
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
        </div>

        {/* Agreed Terms Summary */}
        <div className="border-t border-border pt-4">
          <p className="text-sm text-muted-foreground mb-3">Agreed Terms ({deal.clauses.length} clauses)</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {deal.clauses.map((clause) => {
              // Find the agreed option from selections or compromise
              const selection = clause.selections[0];
              return (
                <div key={clause.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">{clause.clauseTemplate.title}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {selection?.option?.label || "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Signing Status */}
      {signingRequest ? (
        <div className="card-brutal">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-muted-foreground" />
            Signing Status
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Party A Signature</span>
                {signingRequest.initiatorSignedAt ? (
                  <Badge className="bg-primary/20 text-primary">
                    <Check className="w-3 h-3 mr-1" />
                    Signed
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <Clock className="w-3 h-3 mr-1" />
                    Pending
                  </Badge>
                )}
              </div>
              {signingRequest.initiatorSignedAt && (
                <p className="text-xs text-muted-foreground">
                  Signed on {format(new Date(signingRequest.initiatorSignedAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              )}
            </div>
            <div className="p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Party B Signature</span>
                {signingRequest.respondentSignedAt ? (
                  <Badge className="bg-primary/20 text-primary">
                    <Check className="w-3 h-3 mr-1" />
                    Signed
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <Clock className="w-3 h-3 mr-1" />
                    Pending
                  </Badge>
                )}
              </div>
              {signingRequest.respondentSignedAt && (
                <p className="text-xs text-muted-foreground">
                  Signed on {format(new Date(signingRequest.respondentSignedAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              )}
            </div>
          </div>

          {signingRequest.status === "COMPLETED" ? (
            <div className="text-center py-6 border-t border-border">
              <Check className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Contract Signed!</h3>
              <p className="text-muted-foreground mb-6">
                Both parties have signed. The contract is now legally binding.
              </p>
              <div className="flex items-center justify-center gap-3">
                {signingRequest.documentUrl && (
                  <a
                    href={signingRequest.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-brutal inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Signed Contract
                  </a>
                )}
                <a
                  href={`/api/deals/${dealId}/document`}
                  className="btn-brutal-outline inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Contract PDF
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 border-t border-border">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Awaiting Signatures</h3>
              <p className="text-muted-foreground mb-6">
                Signing links have been sent to both parties via email.
                Please check your inbox for the secure signing link.
              </p>
              <div className="flex items-center justify-center gap-3">
                {signingRequest.documentUrl && (
                  <a
                    href={signingRequest.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-brutal inline-flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Document
                  </a>
                )}
                <a
                  href={`/api/deals/${dealId}/document`}
                  className="btn-brutal-outline inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Contract PDF
                </a>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card-brutal text-center py-8">
          <FileSignature className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Ready for Signatures</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            All terms have been agreed upon. Initiate the e-signature process to make this contract legally binding.
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
                  Initiating...
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4" />
                  Initiate E-Signature
                </>
              )}
            </button>
            <a
              href={`/api/deals/${dealId}/document`}
              className="btn-brutal-outline flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Contract PDF
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Both parties will receive an email with a secure signing link
          </p>
        </div>
      )}

      {/* Legal Notice */}
      <div className="card-brutal bg-muted/30">
        <p className="text-xs text-muted-foreground">
          <strong>Legal Notice:</strong> By signing this document electronically, you agree that your electronic signature
          is the legal equivalent of your manual signature on this agreement. This contract will become legally binding
          once both parties have signed.
        </p>
      </div>
    </div>
  );
}
