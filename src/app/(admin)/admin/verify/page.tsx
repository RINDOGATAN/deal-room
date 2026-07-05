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
  const [setupData, setSetupData] = useState<{ qrCode: string; secret: string } | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  const { data: twoFactorStatus, isLoading: statusLoading, error: statusError } =
    trpc.platformAdminTwoFactor.getStatus.useQuery();

  const setupMutation = trpc.platformAdminTwoFactor.setup.useMutation({
    onSuccess: (data) => {
      setSetupData(data);
      setSetupLoading(false);
    },
    onError: (err) => {
      setError(err.message);
      setSetupLoading(false);
    },
  });

  const handleStartSetup = () => {
    if (setupLoading || setupData) return;
    setSetupLoading(true);
    setError(null);
    setupMutation.mutate();
  };

  const verifyMutation = trpc.platformAdminTwoFactor.verify.useMutation({
    onSuccess: (_data, variables) => {
      // Set httpOnly cookie via API route; it re-verifies the TOTP code server-side
      fetch("/api/platform-admin-2fa-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: variables.code }),
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

  // Show error if status query failed
  if (statusError) {
    return (
      <div className="w-full max-w-md">
        <div className="card-brutal">
          <div className="text-center mb-6">
            <Shield className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Session Error</h1>
            <p className="text-muted-foreground mb-4">
              {statusError.message}
            </p>
            <a
              href="/admin/sign-in"
              className="btn-brutal inline-block"
            >
              Back to Sign In
            </a>
          </div>
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

          {!setupData && !setupLoading && (
            <div className="flex justify-center py-4">
              <button
                onClick={handleStartSetup}
                className="btn-brutal flex items-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Generate QR Code
              </button>
            </div>
          )}

          {setupLoading && !setupData && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {setupData && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="p-4 bg-white">
                  <img
                    src={setupData.qrCode}
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
                  {setupData.secret}
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
            <div className="p-4 bg-yellow-500/10 border border-yellow-500 text-yellow-600 text-sm">
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
