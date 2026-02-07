"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Loader2, ArrowRight } from "lucide-react";
import { brand } from "@/config/brand";

export default function SignInPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEmailLoading(true);
    setError(null);

    try {
      await signIn("email", {
        email,
        callbackUrl: "/deals",
        redirect: false,
      });
      setIsEmailSent(true);
    } catch (err) {
      setError(t("failedMagicLink"));
    } finally {
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
    } catch (err) {
      setError(t("googleSignInFailed"));
      setIsGoogleLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="w-full max-w-md">
        <div className="card-brutal text-center">
          <h1 className="text-3xl font-bold mb-2 text-white uppercase tracking-wide">
            {t("checkEmail")}
          </h1>
          <p className="text-muted-foreground mb-6">
            {t.rich("magicLinkSent", {
              email: () => (
                <span className="text-foreground font-medium">{email}</span>
              ),
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("didntReceive")}{" "}
            <button
              onClick={() => setIsEmailSent(false)}
              className="text-primary hover:underline"
            >
              {t("tryAgain")}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="card-brutal">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-white uppercase tracking-wide">DEALROOM</h1>
          <p className="text-muted-foreground mb-4">
            {brand.tagline}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500 text-yellow-600 text-sm rounded-xl">
            {error}
          </div>
        )}

        {/* Email Magic Link */}
        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              {t("emailAddress")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="input-brutal w-full"
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={isEmailLoading || !email}
            className="btn-brutal w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isEmailLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("sending")}
              </>
            ) : (
              <>
                {t("continueWithEmail")}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            {t("noPasswordNeeded")}
          </p>
        </form>

        {/* Divider */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground text-center mb-4">
            {t("orContinueWith")}
          </p>

          {/* Google Sign In - Dark Mode */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-full bg-transparent text-foreground border border-border hover:bg-secondary transition-colors disabled:opacity-50"
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

        <div className="mt-6 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            {t.rich("bySigningIn", {
              termsLink: () => (
                <a
                  href={brand.links.terms}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {t("termsOfUse")}
                </a>
              ),
              privacyLink: () => (
                <a
                  href={brand.links.privacy}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {t("privacyPolicy")}
                </a>
              ),
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
