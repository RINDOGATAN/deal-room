"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ArrowRight,
  Building,
  MapPin,
  Users,
  Plus,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateEquity } from "@/lib/journey/equity";

type FounderDraft = {
  name: string;
  email: string;
  title: string;
  equityPercent: string;
};

const emptyFounder = (): FounderDraft => ({ name: "", email: "", title: "", equityPercent: "" });

export default function NewJourneyPage() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [step, setStep] = useState<"company" | "founders" | "review">("company");
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [founders, setFounders] = useState<FounderDraft[]>([emptyFounder()]);

  const totalEquity = founders.reduce((sum, f) => {
    const n = parseFloat(f.equityPercent);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const equityCheck = validateEquity(founders);
  const equityError = !equityCheck.valid
    ? equityCheck.reason === "PARTIAL_EQUITY"
      ? "Either every founder needs an equity %, or none do."
      : `Equity must sum to 100% (currently ${equityCheck.total}%).`
    : null;

  const createJourney = trpc.journey.create.useMutation({
    onSuccess: async (j) => {
      // Refresh the client session so the role set server-side (BUSINESS_OWNER)
      // is reflected immediately — prevents the onboarding modal from firing
      // when the founder navigates from /launch to /deals/[id].
      await updateSession();
      toast.success("Your journey is ready to begin.");
      router.push(`/launch/${j.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  function updateFounder(idx: number, patch: Partial<FounderDraft>) {
    setFounders((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }
  function addFounder() {
    if (founders.length >= 6) return;
    setFounders((prev) => [...prev, emptyFounder()]);
  }
  function removeFounder(idx: number) {
    if (founders.length <= 1) return;
    setFounders((prev) => prev.filter((_, i) => i !== idx));
  }

  const companyStepValid = companyName.trim().length > 0;
  const foundersStepValid =
    founders.every(
      (f) => f.name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()),
    ) && equityCheck.valid;

  function handleSubmit() {
    createJourney.mutate({
      companyName: companyName.trim(),
      companyAddress: companyAddress.trim() || undefined,
      state: "DELAWARE",
      entityType: "C_CORP",
      authorizedShares: 10_000_000,
      founders: founders.map((f, i) => ({
        name: f.name.trim(),
        email: f.email.trim(),
        title: f.title.trim() || undefined,
        equityPercent: f.equityPercent ? parseFloat(f.equityPercent) : undefined,
        isIncorporator: i === 0,
        isPrimary: i === 0,
      })),
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/launch"
          className="p-2 -ml-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Start your company</h1>
          <p className="text-sm text-muted-foreground">
            Step {step === "company" ? 1 : step === "founders" ? 2 : 3} of 3
          </p>
        </div>
      </div>

      <div className="h-1 bg-muted rounded-full overflow-hidden" aria-hidden>
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{
            width: step === "company" ? "33%" : step === "founders" ? "66%" : "100%",
          }}
        />
      </div>

      {step === "company" && (
        <div className="space-y-6">
          <div className="card-brutal space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Building className="w-5 h-5 text-primary" /> Company basics
            </h2>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name *</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Acme, Inc."
                autoComplete="organization"
                className="input-brutal"
              />
              <p className="text-xs text-muted-foreground">
                Must end in a corporate designator like "Inc.", "Corporation", or "Company".
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyAddress" className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" /> Principal business address
              </Label>
              <Input
                id="companyAddress"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="e.g., 548 Market St #1234, San Francisco, CA 94104"
                autoComplete="street-address"
                className="input-brutal"
              />
              <p className="text-xs text-muted-foreground">
                Optional &mdash; we'll ask for your Delaware registered agent separately when you run the Formation step.
              </p>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              Your entity: <span className="font-mono">Delaware C-Corp</span>
            </span>
            <button
              disabled={!companyStepValid}
              onClick={() => setStep("founders")}
              className="btn-brutal inline-flex items-center gap-2 disabled:opacity-40"
            >
              Next: founders
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === "founders" && (
        <div className="space-y-6">
          <div className="card-brutal space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Users className="w-5 h-5 text-primary" /> Founders
              </h2>
              <span className="text-xs text-muted-foreground">
                Total:{" "}
                <span
                  className={`font-mono ${equityError ? "text-destructive" : ""}`}
                >
                  {totalEquity.toFixed(1)}%
                </span>
              </span>
            </div>
            {equityError && (
              <p className="text-xs text-destructive">{equityError}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Add up to six founders. The first listed is the incorporator + primary contact.
            </p>
            <div className="space-y-4">
              {founders.map((f, i) => (
                <div key={i} className="p-4 border border-border rounded-md space-y-3 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      {i === 0 ? "Primary / Incorporator" : `Co-founder ${i}`}
                    </span>
                    {founders.length > 1 && i > 0 && (
                      <button
                        onClick={() => removeFounder(i)}
                        className="text-muted-foreground hover:text-destructive p-2.5 -mr-2 -my-1"
                        aria-label="Remove founder"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`f-${i}-name`} className="text-xs">Full name</Label>
                      <Input
                        id={`f-${i}-name`}
                        value={f.name}
                        onChange={(e) => updateFounder(i, { name: e.target.value })}
                        placeholder="Alice Founder"
                        autoComplete="name"
                        className="input-brutal"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`f-${i}-email`} className="text-xs">Email</Label>
                      <Input
                        id={`f-${i}-email`}
                        type="email"
                        value={f.email}
                        onChange={(e) => updateFounder(i, { email: e.target.value })}
                        placeholder="alice@acme.com"
                        autoComplete="email"
                        className="input-brutal"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`f-${i}-title`} className="text-xs">Title (optional)</Label>
                      <Input
                        id={`f-${i}-title`}
                        value={f.title}
                        onChange={(e) => updateFounder(i, { title: e.target.value })}
                        placeholder="CEO"
                        autoComplete="organization-title"
                        className="input-brutal"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`f-${i}-eq`} className="text-xs">Equity %</Label>
                      <Input
                        id={`f-${i}-eq`}
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="0"
                        max="100"
                        value={f.equityPercent}
                        onChange={(e) => updateFounder(i, { equityPercent: e.target.value })}
                        placeholder="60"
                        className="input-brutal"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {founders.length < 6 && (
                <button
                  onClick={addFounder}
                  className="btn-brutal-outline inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add another founder
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center gap-3">
            <button
              onClick={() => setStep("company")}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Back
            </button>
            <button
              disabled={!foundersStepValid}
              onClick={() => setStep("review")}
              className="btn-brutal inline-flex items-center gap-2 disabled:opacity-40"
            >
              Review
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-6">
          <div className="card-brutal space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Check className="w-5 h-5 text-primary" /> Everything look right?
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Company</dt>
                <dd className="font-medium">{companyName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Entity</dt>
                <dd className="font-mono text-xs">Delaware C-Corp</dd>
              </div>
              {companyAddress && (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Address</dt>
                  <dd>{companyAddress}</dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Founders</dt>
                <dd className="space-y-1">
                  {founders.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{f.name}</span>
                      <span className="text-muted-foreground">{f.email}</span>
                      {f.title && <span className="text-xs text-muted-foreground">&middot; {f.title}</span>}
                      {f.equityPercent && (
                        <span className="font-mono text-xs text-primary">{f.equityPercent}%</span>
                      )}
                      {i === 0 && (
                        <span className="text-[10px] uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          Incorporator
                        </span>
                      )}
                    </div>
                  ))}
                </dd>
              </div>
            </dl>
          </div>
          <div className="flex justify-between items-center gap-3">
            <button
              onClick={() => setStep("founders")}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Edit founders
            </button>
            <button
              disabled={createJourney.isPending}
              onClick={handleSubmit}
              className="btn-brutal inline-flex items-center gap-2 disabled:opacity-40"
            >
              {createJourney.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  Create journey
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
