"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Scale,
  FileText,
  ArrowRight,
  AlertCircle,
  Check,
  Loader2,
  Mail,
  Shield,
} from "lucide-react";
import Link from "next/link";

export default function ClientInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { data: session, status: sessionStatus } = useSession();
  const t = useTranslations("lawyer");
  const tInvite = useTranslations("invite");

  const { data: invitation, isLoading, error } = trpc.lawyer.getClientInvitation.useQuery(
    { token },
    { enabled: !!token && sessionStatus === "authenticated" }
  );

  const acceptInvitation = trpc.lawyer.acceptClientInvitation.useMutation({
    onSuccess: (result) => {
      toast.success(t("alreadyAcceptedDescription"));
      router.push(`/deals/new?vetting=${result.vettingId}&invitation=${token}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Loading states
  if (sessionStatus === "loading" || (sessionStatus === "authenticated" && isLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="card-brutal text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t("acceptInvitation")}...</p>
        </div>
      </div>
    );
  }

  // Not signed in
  if (sessionStatus === "unauthenticated") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg w-full space-y-6">
          <div className="card-brutal">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">{t("vettedContract")}</span>
            </div>
            <h1 className="text-2xl font-bold mb-4">{t("startContract")}</h1>
            <p className="text-muted-foreground text-sm mb-6">{t("contractPrepared")}</p>
            <button
              onClick={() => signIn(undefined, { callbackUrl: `/client-invite/${token}` })}
              className="btn-brutal w-full flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              {tInvite("signInToContinue")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error or not found
  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card-brutal max-w-md w-full text-center">
          <div className="w-16 h-16 bg-warning/20 flex items-center justify-center mx-auto mb-6 rounded-2xl">
            <AlertCircle className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t("invalidInvitation")}</h1>
          <p className="text-muted-foreground mb-6">{t("invalidInvitationDescription")}</p>
          <Link href="/sign-in" className="btn-brutal inline-flex items-center gap-2">
            {tInvite("goToSignIn")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Already accepted
  if (invitation.status === "ACCEPTED") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card-brutal max-w-md w-full text-center">
          <div className="w-16 h-16 bg-primary/20 flex items-center justify-center mx-auto mb-6 rounded-2xl">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t("alreadyAccepted")}</h1>
          <p className="text-muted-foreground mb-6">{t("alreadyAcceptedDescription")}</p>
          <Link href="/deals" className="btn-brutal inline-flex items-center gap-2">
            {tInvite("viewYourDeals")}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Expired
  if (invitation.status === "EXPIRED" || invitation.expiresAt < new Date()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card-brutal max-w-md w-full text-center">
          <div className="w-16 h-16 bg-warning/20 flex items-center justify-center mx-auto mb-6 rounded-2xl">
            <AlertCircle className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t("expiredInvitation")}</h1>
          <p className="text-muted-foreground mb-6">{t("expiredInvitationDescription")}</p>
        </div>
      </div>
    );
  }

  // Main — show invitation details and accept button
  const lawyerName = invitation.vetting.lawyer.name || invitation.vetting.lawyer.email;
  const templateName = invitation.vetting.contractTemplate.displayName;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        {/* Invitation Details */}
        <div className="card-brutal">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">{t("vettedContract")}</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {t("vettedBadge")}
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-2">{templateName}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
            <span>{invitation.vetting.governingLaw.replace("_", " & ")}</span>
          </div>

          <div className="p-4 bg-muted/30 border border-border rounded-xl">
            <p className="text-sm text-muted-foreground mb-1">{t("vettedBy", { name: "" })}</p>
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              <p className="font-medium">{lawyerName}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t("contractPrepared")}
            </p>
          </div>
        </div>

        {/* Accept */}
        <div className="card-brutal">
          <h2 className="font-semibold mb-4">{t("startContract")}</h2>
          <p className="text-muted-foreground text-sm mb-6">
            {t("contractPrepared")}
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
                {t("acceptInvitation")}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
