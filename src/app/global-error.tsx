"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Last-resort boundary: replaces the root layout when the layout itself
 * fails, so it brings its own <html> and <body> and the global styles.
 */

import "./globals.css";
import { ErrorScreen } from "@/components/ErrorScreen";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased min-h-screen bg-background text-foreground">
        <ErrorScreen error={error} reset={reset} backHref="/" />
      </body>
    </html>
  );
}
