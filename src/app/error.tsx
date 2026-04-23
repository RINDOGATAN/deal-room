"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { formatUserError } from "@/lib/format-error";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = formatUserError(error, "An unexpected error occurred.");
  return (
    <div className="max-w-lg mx-auto py-16 text-center space-y-6">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
      <div>
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <button
        onClick={reset}
        className="btn-brutal inline-flex items-center gap-2 text-sm"
      >
        <RefreshCw className="w-4 h-4" />
        Try again
      </button>
    </div>
  );
}
