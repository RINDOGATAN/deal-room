"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  FileText,
  Users,
  ArrowRight,
  AlertCircle,
  Check,
  Loader2,
  Mail,
} from "lucide-react";
import Link from "next/link";

export default function InvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { data: session, status: sessionStatus } = useSession();
  const t = useTranslations("invite");

  const { data: invitation, isLoading, error } = trpc.invitation.getByToken.useQuery(
    { token },
    { enabled: !!token }
  );

  const acceptInvitation = trpc.invitation.accept.useMutation({
    onSuccess: (result) => {
      toast.success(t("acceptedToast"));
      router.push(`/deals/${result.dealRoomId}/negotiate`);
    },
    onError: (error) => {
      toast.error(t("acceptFailedToast", { error: error.message }));
    },
  });

  if (isLoading || sessionStatus === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="card-brutal text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card-brutal max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t("invalid")}</h1>
          <p className="text-muted-foreground mb-6">{t("invalidDescription")}</p>
          <Link href="/sign-in" className="btn-brutal inline-flex items-center gap-2">
            {t("goToSignIn")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (invitation.status === "ACCEPTED") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card-brutal max-w-md w-full text-center">
          <div className="w-16 h-16 bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t("alreadyAccepted")}</h1>
          <p className="text-muted-foreground mb-6">{t("alreadyAcceptedDescription")}</p>
          <Link href="/deals" className="btn-brutal inline-flex items-center gap-2">
            {t("viewYourDeals")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (invitation.status === "EXPIRED") {
    const inviterEmail = invitation.invitedBy?.email;
    const inviterName = invitation.invitedBy?.name;
    const dealName = invitation.dealRoom?.name;
    const requestSubject = encodeURIComponent(
      t("requestNewSubject", { dealName: dealName || "Dealroom" }),
    );
    const requestBody = encodeURIComponent(
      t("requestNewBody", { name: inviterName || "there", dealName: dealName || "" }),
    );
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card-brutal max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t("expired")}</h1>
          <p className="text-muted-foreground mb-6">{t("expiredDescription")}</p>
          <div className="flex flex-col gap-3 items-center">
            {inviterEmail && (
              <a
                href={`mailto:${inviterEmail}?subject=${requestSubject}&body=${requestBody}`}
                className="btn-brutal inline-flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {t("requestNew", { name: inviterName || inviterEmail })}
              </a>
            )}
            <Link
              href="/sign-in"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {t("goToSignIn")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (invitation.status === "CANCELLED") {
    const inviterEmail = invitation.invitedBy?.email;
    const inviterName = invitation.invitedBy?.name;
    const dealName = invitation.dealRoom?.name;
    const requestSubject = encodeURIComponent(
      t("requestNewSubject", { dealName: dealName || "Dealroom" }),
    );
    const requestBody = encodeURIComponent(
      t("requestNewBody", { name: inviterName || "there", dealName: dealName || "" }),
    );
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card-brutal max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t("cancelled")}</h1>
          <p className="text-muted-foreground mb-6">{t("cancelledDescription")}</p>
          <div className="flex flex-col gap-3 items-center">
            {inviterEmail && (
              <a
                href={`mailto:${inviterEmail}?subject=${requestSubject}&body=${requestBody}`}
                className="btn-brutal inline-flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {t("requestNew", { name: inviterName || inviterEmail })}
              </a>
            )}
            <Link
              href="/sign-in"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {t("goToSignIn")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Not signed in - show sign in prompt
  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-6">
          {/* Invitation Details */}
          <div className="card-brutal">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">{t("youveBeenInvited")}</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">{invitation.dealRoom.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                {invitation.dealRoom.contractTemplate.displayName}
              </span>
              <span>•</span>
              <span>{t("clauseCount", { count: invitation.dealRoom._count.clauses })}</span>
            </div>
            <div className="p-4 bg-muted/30 border border-border">
              <p className="text-sm text-muted-foreground mb-1">{t("invitedBy")}</p>
              <p className="font-medium">{invitation.invitedBy.name || invitation.invitedBy.email}</p>
              {invitation.invitedBy.company && (
                <p className="text-sm text-muted-foreground">{invitation.invitedBy.company}</p>
              )}
            </div>
          </div>

          {/* Sign In to Accept */}
          <div className="card-brutal">
            <h2 className="font-semibold mb-4">{t("signInToAccept")}</h2>
            <p className="text-muted-foreground text-sm mb-6">
              {t("signInDescription", { email: invitation.email })}
            </p>
            <button
              onClick={() => signIn("email", { email: invitation.email, callbackUrl: `/invite/${token}` })}
              className="btn-brutal w-full flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              {t("signInWith", { email: invitation.email })}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Signed in - check if email matches and show accept button
  const emailMatches = session.user?.email?.toLowerCase() === invitation.email.toLowerCase();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        {/* Invitation Details */}
        <div className="card-brutal">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">{t("contractNegotiationInvitation")}</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">{invitation.dealRoom.name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
            <span className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              {invitation.dealRoom.contractTemplate.displayName}
            </span>
            <span>•</span>
            <span>{t("clauseCount", { count: invitation.dealRoom._count.clauses })}</span>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-muted/30 border border-border">
              <p className="text-sm text-muted-foreground mb-1">{t("invitedBy")}</p>
              <p className="font-medium">{invitation.invitedBy.name || invitation.invitedBy.email}</p>
              {invitation.invitedBy.company && (
                <p className="text-sm text-muted-foreground">{invitation.invitedBy.company}</p>
              )}
            </div>

            {invitation.name && (
              <div className="p-4 bg-muted/30 border border-border">
                <p className="text-sm text-muted-foreground mb-1">{t("yourRole")}</p>
                <p className="font-medium">{invitation.name}</p>
                {invitation.company && (
                  <p className="text-sm text-muted-foreground">{invitation.company}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Email Mismatch Warning */}
        {!emailMatches && (
          <div className="card-brutal border-yellow-500">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-500">{t("emailMismatch")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.rich("emailMismatchDescription", {
                    invited: () => <span className="text-foreground">{invitation.email}</span>,
                    current: () => <span className="text-foreground">{session.user?.email}</span>,
                  })}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {t("emailMismatchHint")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Accept Button */}
        <div className="card-brutal">
          <h2 className="font-semibold mb-4">{t("readyToNegotiate")}</h2>
          <p className="text-muted-foreground text-sm mb-6">
            {t("acceptDescription")}
          </p>
          <button
            onClick={() => acceptInvitation.mutate({ token })}
            disabled={acceptInvitation.isPending}
            className="btn-brutal w-full flex items-center justify-center gap-2"
          >
            {acceptInvitation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("accepting")}
              </>
            ) : (
              <>
                {t("acceptAndStart")}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
