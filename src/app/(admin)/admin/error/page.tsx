"use client";

import { useSearchParams } from "next/navigation";
import { AlertCircle, Shield } from "lucide-react";
import Link from "next/link";

export default function AdminErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The verification link has expired or has already been used.",
    Default: "An error occurred during authentication.",
  };

  const errorMessage = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default;

  return (
    <div className="w-full max-w-md">
      <div className="card-brutal">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-destructive/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-primary text-sm font-medium">Platform Admin</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
          <p className="text-muted-foreground mb-2">{errorMessage}</p>
          {error && (
            <p className="text-xs text-muted-foreground font-mono">
              Error code: {error}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Link
            href="/admin/sign-in"
            className="btn-brutal w-full flex items-center justify-center"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="block text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
