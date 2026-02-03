"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Package, Calendar, Hash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssignSkillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedCustomerId?: string;
  preSelectedSkillId?: string;
  onSuccess?: () => void;
}

type LicenseType = "TRIAL" | "SUBSCRIPTION" | "PERPETUAL";

export function AssignSkillModal({
  open,
  onOpenChange,
  preSelectedCustomerId,
  preSelectedSkillId,
  onSuccess,
}: AssignSkillModalProps) {
  const [customerId, setCustomerId] = useState(preSelectedCustomerId || "");
  const [skillId, setSkillId] = useState(preSelectedSkillId || "");
  const [licenseType, setLicenseType] = useState<LicenseType>("SUBSCRIPTION");
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<string[]>([]);
  const [maxActivations, setMaxActivations] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");

  // Reset form when modal opens with new selections
  useEffect(() => {
    if (open) {
      setCustomerId(preSelectedCustomerId || "");
      setSkillId(preSelectedSkillId || "");
      setLicenseType("SUBSCRIPTION");
      setSelectedJurisdictions([]);
      setMaxActivations(1);
      setExpiresAt("");
    }
  }, [open, preSelectedCustomerId, preSelectedSkillId]);

  const utils = trpc.useUtils();

  // Fetch customers and skills for dropdowns
  const { data: customers } = trpc.platformAdmin.listCustomers.useQuery({ search: "" });
  const { data: skills } = trpc.platformAdmin.listSkillPackages.useQuery();

  // Get currently selected skill's available jurisdictions
  const selectedSkill = skills?.find((s) => s.skillId === skillId);
  const availableJurisdictions = selectedSkill?.jurisdictions || [];

  // Clear jurisdictions when skill changes
  useEffect(() => {
    setSelectedJurisdictions([]);
  }, [skillId]);

  const createMutation = trpc.platformAdmin.createEntitlement.useMutation({
    onSuccess: () => {
      utils.platformAdmin.listCustomers.invalidate();
      utils.platformAdmin.getCustomer.invalidate();
      utils.platformAdmin.listSkillPackages.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !skillId || selectedJurisdictions.length === 0) return;

    createMutation.mutate({
      customerId,
      skillId,
      licenseType,
      jurisdictions: selectedJurisdictions,
      maxActivations,
      expiresAt: expiresAt || undefined,
    });
  };

  const toggleJurisdiction = (jurisdiction: string) => {
    setSelectedJurisdictions((prev) =>
      prev.includes(jurisdiction)
        ? prev.filter((j) => j !== jurisdiction)
        : [...prev, jurisdiction]
    );
  };

  const isFormValid = customerId && skillId && selectedJurisdictions.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Assign Skill License
          </DialogTitle>
          <DialogDescription>
            Grant a customer access to a skill package with specific license terms.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Selection (shown if not pre-selected) */}
          {!preSelectedCustomerId && (
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} ({customer.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Skill Selection (shown if not pre-selected) */}
          {!preSelectedSkillId && (
            <div className="space-y-2">
              <Label htmlFor="skill">Skill Package *</Label>
              <Select value={skillId} onValueChange={setSkillId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a skill" />
                </SelectTrigger>
                <SelectContent>
                  {skills?.filter((s) => s.isActive).map((skill) => (
                    <SelectItem key={skill.skillId} value={skill.skillId}>
                      {skill.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* License Type */}
          <div className="space-y-2">
            <Label htmlFor="licenseType">License Type *</Label>
            <Select value={licenseType} onValueChange={(v) => setLicenseType(v as LicenseType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select license type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TRIAL">Trial (Time-limited evaluation)</SelectItem>
                <SelectItem value="SUBSCRIPTION">Subscription (Renewable)</SelectItem>
                <SelectItem value="PERPETUAL">Perpetual (No expiration)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Jurisdictions */}
          <div className="space-y-2">
            <Label>Jurisdictions * {skillId && `(${selectedJurisdictions.length} selected)`}</Label>
            {!skillId ? (
              <p className="text-sm text-muted-foreground">Select a skill to see available jurisdictions</p>
            ) : availableJurisdictions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jurisdictions available for this skill</p>
            ) : (
              <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/30">
                {availableJurisdictions.map((jurisdiction) => (
                  <button
                    key={jurisdiction}
                    type="button"
                    onClick={() => toggleJurisdiction(jurisdiction)}
                    className={`px-3 py-1 text-sm border rounded transition-colors ${
                      selectedJurisdictions.includes(jurisdiction)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-muted"
                    }`}
                  >
                    {jurisdiction}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Max Activations */}
          <div className="space-y-2">
            <Label htmlFor="maxActivations" className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Max Activations
            </Label>
            <Input
              id="maxActivations"
              type="number"
              min={1}
              value={maxActivations}
              onChange={(e) => setMaxActivations(parseInt(e.target.value) || 1)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Number of installations allowed for this license
            </p>
          </div>

          {/* Expiration Date */}
          {licenseType !== "PERPETUAL" && (
            <div className="space-y-2">
              <Label htmlFor="expiresAt" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Expires At {licenseType === "TRIAL" && "*"}
              </Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-64"
                required={licenseType === "TRIAL"}
              />
            </div>
          )}

          {/* Error Display */}
          {createMutation.error && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500 text-yellow-600 text-sm rounded">
              {createMutation.error.message}
            </div>
          )}

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 border border-border text-sm hover:bg-muted/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !isFormValid}
              className="btn-brutal flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Package className="w-4 h-4" />
              )}
              Assign License
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
