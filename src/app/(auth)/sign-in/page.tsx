"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Loader2, Mail, KeyRound, Rocket, Scale, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brand } from "@/config/brand";
import { features } from "@/config/features";
import { TESTER_EMAILS } from "@/lib/tester";

const TESTER_MODE_ON = process.env.NEXT_PUBLIC_TESTER_MODE === "true";

// Sovereign/self-hosted posture: local credentials login replaces the
// cloud sign-in options (magic link / Google). Baked in at build time;
// cloud builds leave the var unset, so nothing changes there.
const LOCAL_AUTH_ON = process.env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED === "true";

const TESTER_PERSONAS: Array<{
  email: (typeof TESTER_EMAILS)[number];
  labelKey: "testerStartup" | "testerLawyer" | "testerBusiness";
  icon: typeof Rocket;
}> = [
  { email: "tester-startup@todo.law", labelKey: "testerStartup", icon: Rocket },
  { email: "tester-lawyer@todo.law", labelKey: "testerLawyer", icon: Scale },
  { email: "tester-business@todo.law", labelKey: "testerBusiness", icon: Briefcase },
];

export default function SignInPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsEmailLoading(true);
    setError(null);

    try {
      const result = await signIn("email", {
        email: email.trim(),
        redirect: false,
        callbackUrl: "/deals",
      });

      if (result?.error) {
        setError(t("failedMagicLink"));
        setIsEmailLoading(false);
      } else {
        setEmailSent(true);
      }
    } catch {
      setError(t("unexpectedError"));
      setIsEmailLoading(false);
    }
  };

  const handleInviteCodeSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !code.trim()) return;

    setIsEmailLoading(true);
    setError(null);

    try {
      const result = await signIn("invite-code", {
        email: email.trim(),
        code: code.trim(),
        redirect: false,
        callbackUrl: "/deals",
      });

      if (result?.error) {
        setError(t("invalidInviteCode"));
        setIsEmailLoading(false);
      } else if (result?.ok) {
        window.location.href = "/deals";
      }
    } catch {
      setError(t("unexpectedError"));
      setIsEmailLoading(false);
    }
  };

  const handleLocalSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsEmailLoading(true);
    setError(null);

    try {
      const result = await signIn("local", {
        email: email.trim(),
        redirect: false,
        callbackUrl: "/deals",
      });

      if (result?.error) {
        setError(t("unexpectedError"));
        setIsEmailLoading(false);
      } else if (result?.ok) {
        window.location.href = "/deals";
      }
    } catch {
      setError(t("unexpectedError"));
      setIsEmailLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);

    try {
      await signIn("google", {
        callbackUrl: "/deals",
      });
    } catch {
      setError(t("googleSignInFailed"));
      setIsGoogleLoading(false);
    }
  };

  // Show email sent confirmation (magic-link only)
  if (emailSent) {
    return (
      <div className="w-full max-w-md">
        <div className="card-brutal">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">{t("checkEmail")}</h1>
            <p className="text-muted-foreground">
              {t.rich("magicLinkSent", {
                email: () => <strong className="text-foreground">{email}</strong>,
              })}
            </p>
            <button
              onClick={() => {
                setEmailSent(false);
                setIsEmailLoading(false);
              }}
              className="mt-6 text-sm text-primary hover:underline"
            >
              {t("didntReceive")} {t("tryAgain")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="card-brutal">
        <div className="text-center mb-8">
          <h1 className="text-3xl mb-2 text-white uppercase tracking-wide" style={{ fontFamily: "var(--font-display), 'Jost', sans-serif", fontWeight: 600 }}>{t("dealroom")}</h1>
          <p className="text-muted-foreground mb-4">
            {t("poweredBy")}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500 text-yellow-600 text-sm">
            {error}
          </div>
        )}

        {/* Local credentials login (sovereign/self-hosted) */}
        {LOCAL_AUTH_ON && (
          <form onSubmit={handleLocalSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailAddress")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <button
              type="submit"
              disabled={isEmailLoading || !email.trim()}
              className="btn-brutal w-full flex items-center justify-center gap-3 py-3 disabled:opacity-50"
            >
              {isEmailLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t("signingIn")}
                </>
              ) : (
                <>
                  <KeyRound className="w-5 h-5" />
                  {t("localSignIn")}
                </>
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              {t("localSignInHint")}
            </p>
          </form>
        )}

        {/* Magic Link Email Form */}
        {!LOCAL_AUTH_ON && features.magicLinkAuth && (
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailAddress")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <button
              type="submit"
              disabled={isEmailLoading || !email.trim()}
              className="btn-brutal w-full flex items-center justify-center gap-3 py-3 disabled:opacity-50"
            >
              {isEmailLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t("sending")}
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  {t("continueWithEmail")}
                </>
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              {t("noPasswordNeeded")}
            </p>
          </form>
        )}

        {/* Invite Code Form */}
        {features.inviteCodeAuth && (
          <form onSubmit={handleInviteCodeSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailAddress")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">{t("inviteCode")}</Label>
              <Input
                id="code"
                type="text"
                placeholder="XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="bg-background font-mono tracking-wider"
              />
            </div>

            <button
              type="submit"
              disabled={isEmailLoading || !email.trim() || !code.trim()}
              className="btn-brutal w-full flex items-center justify-center gap-3 py-3 disabled:opacity-50"
            >
              {isEmailLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t("signingIn")}
                </>
              ) : (
                <>
                  <KeyRound className="w-5 h-5" />
                  {t("signInWithCode")}
                </>
              )}
            </button>
          </form>
        )}

        {/* Google Sign In */}
        {!LOCAL_AUTH_ON && (
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground text-center mb-4">
            {t("orContinueWith")}
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-full border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            <span className="font-medium">
              {isGoogleLoading ? t("signingIn") : t("continueWithGoogle")}
            </span>
          </button>
        </div>
        )}

        {TESTER_MODE_ON && (
          <div className="mt-8 pt-6 border-t border-dashed border-primary/30">
            <p className="text-xs text-muted-foreground text-center mb-3 uppercase tracking-wider">
              {t("testerSectionLabel")}
            </p>
            <p className="text-xs text-muted-foreground text-center mb-4">
              {t("testerSectionDescription")}
            </p>
            <div className="space-y-2">
              {TESTER_PERSONAS.map((persona) => {
                const Icon = persona.icon;
                return (
                  <button
                    key={persona.email}
                    type="button"
                    onClick={async () => {
                      setIsEmailLoading(true);
                      setError(null);
                      try {
                        const result = await signIn("tester", {
                          email: persona.email,
                          redirect: false,
                          callbackUrl: "/deals",
                        });
                        if (result?.error) {
                          setError(t("testerSignInFailed"));
                          setIsEmailLoading(false);
                        } else {
                          window.location.href = "/deals";
                        }
                      } catch {
                        setError(t("unexpectedError"));
                        setIsEmailLoading(false);
                      }
                    }}
                    disabled={isEmailLoading}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-full border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{t(persona.labelKey)}</span>
                    <span className="text-xs text-muted-foreground/70">{persona.email}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            {t.rich("bySigningIn", {
              termsLink: (chunks) => (
                <a
                  href={brand.links.terms}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {chunks}
                </a>
              ),
              privacyLink: (chunks) => (
                <a
                  href={brand.links.privacy}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
