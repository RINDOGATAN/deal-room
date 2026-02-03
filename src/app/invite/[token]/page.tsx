"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
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

  const { data: invitation, isLoading, error } = trpc.invitation.getByToken.useQuery(
    { token },
    { enabled: !!token }
  );

  const acceptInvitation = trpc.invitation.accept.useMutation({
    onSuccess: (result) => {
      toast.success("Invitation accepted!");
      router.push(`/deals/${result.dealRoomId}/negotiate`);
    },
    onError: (error) => {
      toast.error(`Failed to accept invitation: ${error.message}`);
    },
  });

  if (isLoading || sessionStatus === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="card-brutal text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading invitation...</p>
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
          <h1 className="text-2xl font-bold mb-2">Invalid Invitation</h1>
          <p className="text-muted-foreground mb-6">
            This invitation link is invalid, has expired, or has already been used.
          </p>
          <Link href="/sign-in" className="btn-brutal inline-flex items-center gap-2">
            Go to Sign In
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
          <h1 className="text-2xl font-bold mb-2">Already Accepted</h1>
          <p className="text-muted-foreground mb-6">
            This invitation has already been accepted.
          </p>
          <Link href="/deals" className="btn-brutal inline-flex items-center gap-2">
            View Your Deals
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (invitation.status === "EXPIRED") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card-brutal max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Invitation Expired</h1>
          <p className="text-muted-foreground mb-6">
            This invitation has expired. Please contact the sender to get a new invitation.
          </p>
          <Link href="/sign-in" className="btn-brutal inline-flex items-center gap-2">
            Go to Sign In
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (invitation.status === "CANCELLED") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="card-brutal max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Invitation Cancelled</h1>
          <p className="text-muted-foreground mb-6">
            This invitation has been cancelled by the sender.
          </p>
          <Link href="/sign-in" className="btn-brutal inline-flex items-center gap-2">
            Go to Sign In
            <ArrowRight className="w-4 h-4" />
          </Link>
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
              <span className="text-sm text-muted-foreground">You've been invited</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">{invitation.dealRoom.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                {invitation.dealRoom.contractTemplate.displayName}
              </span>
              <span>•</span>
              <span>{invitation.dealRoom._count.clauses} clauses</span>
            </div>
            <div className="p-4 bg-muted/30 border border-border">
              <p className="text-sm text-muted-foreground mb-1">Invited by</p>
              <p className="font-medium">{invitation.invitedBy.name || invitation.invitedBy.email}</p>
              {invitation.invitedBy.company && (
                <p className="text-sm text-muted-foreground">{invitation.invitedBy.company}</p>
              )}
            </div>
          </div>

          {/* Sign In to Accept */}
          <div className="card-brutal">
            <h2 className="font-semibold mb-4">Sign in to accept</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Sign in with your email ({invitation.email}) to accept this invitation and start negotiating.
            </p>
            <button
              onClick={() => signIn("email", { email: invitation.email, callbackUrl: `/invite/${token}` })}
              className="btn-brutal w-full flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Sign in with {invitation.email}
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
            <span className="text-sm text-muted-foreground">Contract Negotiation Invitation</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">{invitation.dealRoom.name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
            <span className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              {invitation.dealRoom.contractTemplate.displayName}
            </span>
            <span>•</span>
            <span>{invitation.dealRoom._count.clauses} clauses</span>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-muted/30 border border-border">
              <p className="text-sm text-muted-foreground mb-1">Invited by</p>
              <p className="font-medium">{invitation.invitedBy.name || invitation.invitedBy.email}</p>
              {invitation.invitedBy.company && (
                <p className="text-sm text-muted-foreground">{invitation.invitedBy.company}</p>
              )}
            </div>

            {invitation.name && (
              <div className="p-4 bg-muted/30 border border-border">
                <p className="text-sm text-muted-foreground mb-1">Your role</p>
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
                <p className="font-medium text-yellow-500">Email Mismatch</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This invitation was sent to <span className="text-foreground">{invitation.email}</span>,
                  but you're signed in as <span className="text-foreground">{session.user?.email}</span>.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  You can still accept if you have access to both emails.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Accept Button */}
        <div className="card-brutal">
          <h2 className="font-semibold mb-4">Ready to negotiate?</h2>
          <p className="text-muted-foreground text-sm mb-6">
            By accepting this invitation, you'll be able to review the contract terms and submit your preferred options.
          </p>
          <button
            onClick={() => acceptInvitation.mutate({ token })}
            disabled={acceptInvitation.isPending}
            className="btn-brutal w-full flex items-center justify-center gap-2"
          >
            {acceptInvitation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                Accept & Start Negotiating
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
