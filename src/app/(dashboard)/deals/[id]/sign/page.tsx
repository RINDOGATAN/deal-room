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
  PenTool,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

export default function SigningPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;
  const [typedSignature, setTypedSignature] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);

  const { data: deal, isLoading: dealLoading } = trpc.deal.getById.useQuery({ id: dealId });
  const { data: signingRequest, isLoading: signingLoading, refetch } = trpc.signing.getRequest.useQuery({ dealRoomId: dealId });

  const initiateSigning = trpc.signing.initiate.useMutation({
    onSuccess: () => {
      toast.success("Signing process started. You can now sign below.");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to initiate signing: ${error.message}`);
    },
  });

  const recordSignature = trpc.signing.recordSignature.useMutation({
    onSuccess: () => {
      toast.success("Signature recorded successfully!");
      setTypedSignature("");
      setConfirmChecked(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to record signature: ${error.message}`);
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
      <div className="card-brutal border-yellow-500">
        <div className="flex items-center gap-3 text-yellow-600">
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
                  {format(new Date(signingRequest.initiatorSignedAt), "MMM d, yyyy 'at' h:mm a")}
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
                  {format(new Date(signingRequest.respondentSignedAt), "MMM d, yyyy 'at' h:mm a")}
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
                <a
                  href={`/api/deals/${dealId}/document`}
                  className="btn-brutal inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Signed Contract
                </a>
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
                      <div className="text-center mb-6">
                        <Check className="w-12 h-12 text-primary mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">You Have Signed</h3>
                        <p className="text-muted-foreground">
                          {otherPartyHasSigned
                            ? "Waiting for the document to be finalized..."
                            : "Waiting for the other party to sign..."}
                        </p>
                      </div>
                      {currentPartySignature && (
                        <div className="max-w-md mx-auto">
                          <p className="text-xs text-muted-foreground mb-2 text-center">Your signature:</p>
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
                      <div className="flex items-center justify-center gap-3 mt-6">
                        <a
                          href={`/api/deals/${dealId}/document`}
                          className="btn-brutal-outline inline-flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download Contract PDF
                        </a>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="py-6 border-t border-border">
                    <div className="max-w-md mx-auto">
                      <div className="text-center mb-6">
                        <PenTool className="w-8 h-8 text-primary mx-auto mb-3" />
                        <h3 className="text-lg font-semibold mb-2">Sign the Contract</h3>
                        <p className="text-sm text-muted-foreground">
                          Type your full legal name below to create your electronic signature
                        </p>
                      </div>

                      {/* Signature Input */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Type your full name
                          </label>
                          <Input
                            type="text"
                            value={typedSignature}
                            onChange={(e) => setTypedSignature(e.target.value)}
                            placeholder="e.g., John Smith"
                            className="input-brutal text-lg"
                          />
                        </div>

                        {/* Signature Preview */}
                        {typedSignature && (
                          <div>
                            <label className="block text-xs text-muted-foreground mb-2">
                              Signature Preview
                            </label>
                            <div className="p-6 border-2 border-dashed border-border bg-muted/20 text-center">
                              <p
                                className="text-3xl text-foreground"
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
                            I confirm that I am authorized to sign this contract and that my typed name above
                            constitutes my legal electronic signature with the same validity as a handwritten signature.
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
                              Signing...
                            </>
                          ) : (
                            <>
                              <FileSignature className="w-4 h-4" />
                              Sign Contract
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-3 mt-6">
                      <a
                        href={`/api/deals/${dealId}/document`}
                        className="btn-brutal-outline inline-flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download Contract PDF
                      </a>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      ) : (
        <div className="card-brutal text-center py-8">
          <FileSignature className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Ready for Signatures</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            All terms have been agreed upon. Start the signing process and both parties can sign by typing their full legal name.
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
                  Starting...
                </>
              ) : (
                <>
                  <PenTool className="w-4 h-4" />
                  Start Signing Process
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
            You&apos;ll be able to sign immediately after starting the process
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
