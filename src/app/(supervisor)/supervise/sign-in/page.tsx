"use client";

import { useState } from "react";
import { getCsrfToken } from "next-auth/react";
import { Mail, ArrowRight, Loader2, Scale } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SupervisorSignInPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Get CSRF token from the supervisor auth endpoint
      const csrfResponse = await fetch("/api/auth/supervisor/csrf");
      const { csrfToken } = await csrfResponse.json();

      // Call the supervisor sign-in endpoint directly
      const response = await fetch("/api/auth/supervisor/signin/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          csrfToken,
          email,
          callbackUrl: "/supervise",
        }),
      });

      if (response.ok || response.redirected) {
        setIsEmailSent(true);
      } else {
        const data = await response.json().catch(() => ({}));
        if (data.error?.includes("Not authorized")) {
          setError("This email is not registered as a supervisor.");
        } else {
          setError("Failed to send magic link. Please try again.");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="w-full max-w-md">
        <div className="card-brutal text-center">
          <div className="w-16 h-16 bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-purple-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
          <p className="text-muted-foreground mb-6">
            We've sent a magic link to <span className="text-foreground font-medium">{email}</span>.
            Click the link in the email to sign in to the Supervisor Portal.
          </p>
          <p className="text-sm text-muted-foreground">
            Didn't receive it?{" "}
            <button
              onClick={() => setIsEmailSent(false)}
              className="text-purple-500 hover:underline"
            >
              Try again
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
          <div className="w-16 h-16 bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <Scale className="w-8 h-8 text-purple-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Supervisor Portal</h1>
          <p className="text-muted-foreground">
            Sign in to monitor your assigned negotiations
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="supervisor@lawfirm.com"
              className="input-brutal"
              required
              autoFocus
            />
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive text-destructive text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-500 text-white font-semibold border-2 border-purple-600 shadow-[4px_4px_0px_0px_rgba(88,28,135,1)] hover:shadow-[2px_2px_0px_0px_rgba(88,28,135,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                Continue with Email
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          No password needed. We'll send you a secure link.
        </p>
      </div>
    </div>
  );
}
