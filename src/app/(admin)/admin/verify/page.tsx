"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, Key } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

export default function AdminVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: twoFactorStatus, isLoading: statusLoading } =
    trpc.platformAdminTwoFactor.getStatus.useQuery();

  const setupMutation = trpc.platformAdminTwoFactor.setup.useMutation({
    onError: (err) => setError(err.message),
  });

  const verifyMutation = trpc.platformAdminTwoFactor.verify.useMutation({
    onSuccess: () => {
      // Set httpOnly cookie via API route
      fetch("/api/platform-admin-2fa-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: true }),
      }).then(() => {
        router.push("/admin");
      });
    },
    onError: (err) => setError(err.message),
  });

  useEffect(() => {
    if (twoFactorStatus && !twoFactorStatus.isAdmin) {
      router.push("/admin/sign-in");
    }
  }, [twoFactorStatus, router]);

  // Start setup if admin hasn't set up 2FA yet
  useEffect(() => {
    if (twoFactorStatus?.isAdmin && !twoFactorStatus.isSetup && !setupMutation.data) {
      setupMutation.mutate();
    }
  }, [twoFactorStatus, setupMutation]);

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
  if (twoFactorStatus?.isAdmin && !twoFactorStatus.isSetup) {
    return (
      <div className="w-full max-w-md">
        <div className="card-brutal">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-primary text-sm font-medium">Platform Admin</span>
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
                    className="w-48 h-48"
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
                  <div className="p-4 bg-destructive/10 border border-destructive text-destructive text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verifyMutation.isPending || code.length !== 6}
                  className="btn-brutal w-full flex items-center justify-center gap-2 disabled:opacity-50"
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

  // Subsequent logins: just enter code
  return (
    <div className="w-full max-w-md">
      <div className="card-brutal">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-primary text-sm font-medium">Platform Admin</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Admin Verification</h1>
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
            <div className="p-4 bg-destructive/10 border border-destructive text-destructive text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={verifyMutation.isPending || code.length !== 6}
            className="btn-brutal w-full flex items-center justify-center gap-2 disabled:opacity-50"
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
