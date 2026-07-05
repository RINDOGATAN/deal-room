"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, Key } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export default function SupervisorVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: twoFactorStatus, isLoading: statusLoading, isError } =
    trpc.supervisorTwoFactor.getStatus.useQuery();

  const setupMutation = trpc.supervisorTwoFactor.setup.useMutation({
    onError: (err: { message: string }) => setError(err.message),
  });

  const verifyMutation = trpc.supervisorTwoFactor.verify.useMutation({
    onSuccess: (_data, variables) => {
      // Set httpOnly cookie via API route; it re-verifies the TOTP code server-side
      fetch("/api/supervisor-2fa-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: variables.code }),
      }).then(() => {
        router.push("/supervise");
      });
    },
    onError: (err: { message: string }) => setError(err.message),
  });

  useEffect(() => {
    if (isError || (twoFactorStatus && !twoFactorStatus.isSupervisor)) {
      router.push("/supervise/sign-in");
    }
  }, [twoFactorStatus, isError, router]);

  // Start setup if supervisor hasn't set up 2FA yet
  useEffect(() => {
    if (twoFactorStatus?.isSupervisor && !twoFactorStatus.isSetup && !setupMutation.data && !setupMutation.isPending) {
      setupMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twoFactorStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    verifyMutation.mutate({ code });
  };

  if (statusLoading) {
    return (
      <div className="w-full max-w-md">
        <div className="card-brutal text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // First-time setup: show QR code
  if (twoFactorStatus?.isSupervisor && !twoFactorStatus.isSetup) {
    return (
      <div className="w-full max-w-md">
        <div className="card-brutal">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Setup Two-Factor Auth</h1>
            <p className="text-muted-foreground">
              Scan this QR code with your authenticator app
            </p>
          </div>

          {setupMutation.isPending && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {setupMutation.data && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="p-4 bg-white">
                  <img
                    src={setupMutation.data.qrCode}
                    alt="2FA QR Code"
                    className="w-40 h-40 sm:w-48 sm:h-48"
                  />
                </div>
              </div>

              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2">
                  Or enter this code manually:
                </p>
                <code className="text-sm bg-muted px-3 py-1.5 font-mono">
                  {setupMutation.data.secret}
                </code>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="input-brutal text-center text-2xl tracking-widest"
                    autoComplete="one-time-code"
                    required
                  />
                </div>

                {error && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500 text-yellow-600 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verifyMutation.isPending || code.length !== 6}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-semibold border-2 border-primary/80 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50"
                >
                  {verifyMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      Verify & Continue
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  // No valid session — show loading while redirect fires
  if (!twoFactorStatus?.isSupervisor) {
    return (
      <div className="w-full max-w-md">
        <div className="card-brutal text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  // Subsequent logins: just enter code
  return (
    <div className="w-full max-w-md">
      <div className="card-brutal">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Supervisor Verification</h1>
          <p className="text-muted-foreground">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="input-brutal text-center text-2xl tracking-widest"
              autoComplete="one-time-code"
              autoFocus
              required
            />
          </div>

          {error && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500 text-yellow-600 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={verifyMutation.isPending || code.length !== 6}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-semibold border-2 border-primary/80 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50"
          >
            {verifyMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                Verify
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
