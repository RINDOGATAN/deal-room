"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * What a person sees when a page fails: a plain sentence, a way back, and a
 * reference id they can quote when they report it. The error itself goes to
 * the log with the same id, never to the screen (no message from a
 * programming error, no stack trace).
 *
 * Used by every route group's `error.tsx` and by `global-error.tsx`. It
 * carries its own two-language text instead of next-intl, because the
 * global boundary renders outside the providers.
 */

import { useEffect, useMemo } from "react";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { brand } from "@/config/brand";
import { errorReference, userSafeErrorMessage } from "@/lib/error-reference";
import { createLogger } from "@/lib/logger";

const logger = createLogger("error-boundary");

const TEXT = {
  en: {
    title: "Something went wrong",
    body: "This page could not be shown. Please try again, or go back.",
    retry: "Try again",
    back: "Go back",
    reference: "Reference",
    help: "If it keeps happening, report it with this reference (Feedback button, or see how to report a problem).",
    helpLink: "How to report a problem",
  },
  es: {
    title: "Algo ha fallado",
    body: "No se ha podido mostrar esta página. Inténtalo de nuevo o vuelve atrás.",
    retry: "Reintentar",
    back: "Volver",
    reference: "Referencia",
    help: "Si vuelve a ocurrir, comunícalo con esta referencia (botón de comentarios, o consulta cómo informar de un problema).",
    helpLink: "Cómo informar de un problema",
  },
} as const;

/** Public page explaining how to report a problem and what the reference is for. */
export const STATUS_AND_SUPPORT_URL = `${brand.links.sourceCode}/blob/main/docs/status-and-support.md`;

export function ErrorScreen({
  error,
  reset,
  backHref = "/",
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  backHref?: string;
}) {
  const reference = useMemo(() => errorReference(error.digest), [error.digest]);
  const lang =
    typeof document !== "undefined" && document.documentElement.lang?.startsWith("es") ? "es" : "en";
  const t = TEXT[lang];
  const detail = userSafeErrorMessage(error);

  useEffect(() => {
    // The server logs a server-side failure under the same digest.
    logger.error("page failed", {
      reference,
      name: error.name,
      err: error.message,
      digest: error.digest ?? null,
    });
  }, [error, reference]);

  return (
    <div role="alert" className="max-w-lg mx-auto py-16 px-4 text-center space-y-6">
      <AlertCircle className="w-12 h-12 text-danger mx-auto" aria-hidden />
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t.title}</h2>
        <p className="text-sm text-foreground">{detail ?? t.body}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {reset && (
          <button onClick={reset} className="btn-brutal inline-flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" aria-hidden />
            {t.retry}
          </button>
        )}
        <a href={backHref} className="btn-brutal-outline inline-flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" aria-hidden />
          {t.back}
        </a>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          {t.reference}: <span className="font-mono select-all">{reference}</span>
        </p>
        <p>
          {t.help}{" "}
          <a
            href={STATUS_AND_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {t.helpLink}
          </a>
        </p>
      </div>
    </div>
  );
}
