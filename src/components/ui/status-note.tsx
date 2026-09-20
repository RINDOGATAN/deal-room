// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import * as React from "react";
import { CircleCheck, Info, OctagonAlert, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { TONE_STYLES, type StatusTone } from "@/lib/status-colors";

/**
 * The one way to show a severity in the interface.
 *
 * Three signals always travel together: the icon shape, the border, and the
 * heading word. The hue is the fourth, never the only one. The sentence inside
 * stays in the body text colour, so a warning is not harder to read than the
 * rest of the page.
 */
const TONE_ICONS = {
  OctagonAlert,
  TriangleAlert,
  CircleCheck,
  Info,
} as const;

export function StatusIcon({
  tone,
  className,
}: {
  tone: StatusTone;
  className?: string;
}) {
  const style = TONE_STYLES[tone];
  const Icon = TONE_ICONS[style.iconName];
  return <Icon aria-hidden className={cn("w-5 h-5 flex-shrink-0", style.icon, className)} />;
}

export function StatusNote({
  tone,
  title,
  children,
  className,
  compact = false,
}: {
  tone: StatusTone;
  /** The word that carries the severity when the hue cannot be seen. */
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const style = TONE_STYLES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(style.panel, "rounded-2xl", compact ? "p-3" : "p-4 sm:p-6", className)}
    >
      <div className="flex items-start gap-3">
        <StatusIcon tone={tone} className={compact ? "w-4 h-4 mt-0.5" : "mt-0.5"} />
        <div className="space-y-1 min-w-0">
          {title && <p className={cn("font-semibold", style.heading)}>{title}</p>}
          {children && <div className={cn("text-sm", style.body)}>{children}</div>}
        </div>
      </div>
    </div>
  );
}
