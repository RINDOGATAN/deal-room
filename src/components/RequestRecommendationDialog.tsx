"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Mail } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type GoverningLaw = "CALIFORNIA" | "ENGLAND_WALES" | "SPAIN";

const jurisdictionKeys: Record<string, string> = {
  CALIFORNIA: "jurisdictionCalifornia",
  ENGLAND_WALES: "jurisdictionEnglandWales",
  SPAIN: "jurisdictionSpain",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lawyerId: string;
  lawyerName: string;
  lawyerJurisdictions: GoverningLaw[];
}

export function RequestRecommendationDialog({
  open,
  onOpenChange,
  lawyerId,
  lawyerName,
  lawyerJurisdictions,
}: Props) {
  const t = useTranslations("requests");
  const tCommon = useTranslations("common");
  const { data: session } = useSession();
  const requesterEmail = session?.user?.email ?? "";

  const [contractType, setContractType] = useState("");
  const [governingLaw, setGoverningLaw] = useState<GoverningLaw | "">("");
  const [message, setMessage] = useState("");

  const { data: templates } = trpc.skills.listTemplates.useQuery();

  const requestMutation = trpc.lawyer.requestRecommendation.useMutation({
    onSuccess: () => {
      toast.success(t("requestSent"));
      onOpenChange(false);
      setContractType("");
      setGoverningLaw("");
      setMessage("");
    },
    onError: (error) => {
      toast.error(t("requestFailed", { error: error.message }));
    },
  });

  const handleSubmit = () => {
    if (!contractType || !governingLaw) return;
    requestMutation.mutate({
      lawyerId,
      contractType,
      governingLaw,
      message: message.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("submitRequest")}</DialogTitle>
          <DialogDescription>
            {lawyerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Contract Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("contractType")}</label>
            <select
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground"
            >
              <option value="">{t("selectContractType")}</option>
              {templates?.map((tmpl) => (
                <option key={tmpl.contractType} value={tmpl.contractType}>
                  {tmpl.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Jurisdiction — filtered to lawyer's jurisdictions */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("jurisdiction")}</label>
            <select
              value={governingLaw}
              onChange={(e) => setGoverningLaw(e.target.value as GoverningLaw)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground"
            >
              <option value="">{t("selectJurisdiction")}</option>
              {lawyerJurisdictions.map((j) => (
                <option key={j} value={j}>
                  {tCommon(jurisdictionKeys[j] || j)}
                </option>
              ))}
            </select>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t("message")} <span className="text-muted-foreground font-normal">({tCommon("optional")})</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePlaceholder")}
              rows={3}
              maxLength={1000}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Reply-to address — what the lawyer will see and use to reach
              the requester back. Pulled from the session so the user can't
              get this wrong by accident. */}
          {requesterEmail && (
            <div className="flex items-start gap-2 px-3 py-2 bg-secondary/40 border border-border rounded-lg text-xs text-muted-foreground">
              <Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <p>
                {t.rich("replyEmailNotice", {
                  email: () => <strong className="text-foreground">{requesterEmail}</strong>,
                })}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm border border-border rounded-full hover:bg-secondary transition-colors"
          >
            {tCommon("cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!contractType || !governingLaw || requestMutation.isPending}
            className="btn-brutal text-sm disabled:opacity-50"
          >
            {requestMutation.isPending ? t("submitting") : t("submitRequest")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
