"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const submit = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      setMessage("");
      setSent(true);
    },
    onError: () => {
      // keep form visible so user can retry
    },
  });

  function handleClose(value: boolean) {
    if (!value) {
      setSent(false);
      submit.reset();
    }
    onOpenChange(value);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="text-lg font-medium">Thanks for your feedback!</p>
            <p className="text-sm text-muted-foreground">We&apos;ll use it to improve this tool.</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>What&apos;s wrong?</DialogTitle>
            </DialogHeader>
            {submit.isError && (
              <p className="text-sm text-destructive">Failed to send. Please try again.</p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit.mutate({ message, page: pathname ?? undefined });
              }}
              className="space-y-4"
            >
              <Textarea
                placeholder="How can we improve this tool?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={2000}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={!message.trim() || submit.isPending}
                >
                  {submit.isPending ? "Sending..." : "Send Feedback"}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
