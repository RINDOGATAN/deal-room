"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";

function AuthErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth");
  const error = searchParams.get("error") || "Default";
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    // Admin and supervisor portals have their own error pages — keep
    // those flows unchanged. Otherwise this is a regular-user error
    // and we render the explanation in-place.
    const cookies = document.cookie;
    if (cookies.includes("admin_csrf") || cookies.includes("admin_callback")) {
      router.replace(`/admin/error?error=${error}`);
      return;
    }
    if (cookies.includes("supervisor_csrf") || cookies.includes("supervisor_callback")) {
      router.replace(`/supervise/error?error=${error}`);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- must run after the cookie check above, which needs document.cookie (unavailable during render); flips off the redirect placeholder exactly once
    setRedirecting(false);
  }, [router, error]);

  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Map known NextAuth error codes to user-readable copy.
  const messageKey = (() => {
    switch (error) {
      case "Verification":
        return "errorVerification";
      case "AccessDenied":
        return "errorAccessDenied";
      case "Configuration":
        return "errorConfiguration";
      case "OAuthSignin":
      case "OAuthCallback":
      case "OAuthCreateAccount":
      case "EmailCreateAccount":
      case "Callback":
        return "errorOAuth";
      default:
        return "errorDefault";
    }
  })();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card-brutal max-w-md w-full">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <h1 className="text-lg font-semibold mb-1">{t("errorTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t(messageKey)}</p>
          </div>
        </div>
        <Link
          href="/sign-in"
          className="btn-brutal inline-flex items-center justify-center w-full mt-2"
        >
          {t("backToSignIn")}
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
