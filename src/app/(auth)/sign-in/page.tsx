"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Mail, ArrowRight, Loader2, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDevLoading, setIsDevLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("email", {
        email,
        redirect: false,
        callbackUrl: "/deals",
      });

      if (result?.error) {
        setError("Failed to send magic link. Please try again.");
      } else {
        setIsEmailSent(true);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevLogin = async (userType: "user1" | "user2" | "admin") => {
    setIsDevLoading(true);
    setError(null);

    const emails = {
      user1: "alice@company-a.com",
      user2: "bob@company-b.com",
      admin: "admin@lawfirm.com",
    };

    try {
      await signIn("dev-login", {
        email: emails[userType],
        callbackUrl: userType === "admin" ? "/admin" : "/deals",
      });
    } catch (err) {
      setError("Dev login failed.");
      setIsDevLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="w-full max-w-md">
        <div className="card-brutal text-center">
          <div className="w-16 h-16 bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Check Your Email</h1>
          <p className="text-muted-foreground mb-6">
            We've sent a magic link to <span className="text-foreground font-medium">{email}</span>.
            Click the link in the email to sign in.
          </p>
          <p className="text-sm text-muted-foreground">
            Didn't receive it?{" "}
            <button
              onClick={() => setIsEmailSent(false)}
              className="text-primary hover:underline"
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
          <h1 className="text-2xl font-bold mb-2">Sign In</h1>
          <p className="text-muted-foreground">
            Enter your email to receive a magic link
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
              placeholder="you@company.com"
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
            className="btn-brutal w-full flex items-center justify-center gap-2 disabled:opacity-50"
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

        {/* Dev bypass - remove in production */}
        <div className="mt-6 pt-6 border-t border-border space-y-3">
          <p className="text-xs text-muted-foreground text-center mb-4">
            Dev Mode - Select a test persona
          </p>

          <button
            onClick={() => handleDevLogin("user1")}
            disabled={isDevLoading}
            className="w-full flex items-center justify-between px-4 py-3 border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Alice (Party A / Initiator)</span>
            </div>
            <span className="text-xs opacity-70">Company A</span>
          </button>

          <button
            onClick={() => handleDevLogin("user2")}
            disabled={isDevLoading}
            className="w-full flex items-center justify-between px-4 py-3 border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Bob (Party B / Respondent)</span>
            </div>
            <span className="text-xs opacity-70">Company B</span>
          </button>

          <button
            onClick={() => handleDevLogin("admin")}
            disabled={isDevLoading}
            className="w-full flex items-center justify-between px-4 py-3 border border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Admin (Supervising Attorney)</span>
            </div>
            <span className="text-xs opacity-70">Law Firm</span>
          </button>

          {isDevLoading && (
            <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Signing in...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
