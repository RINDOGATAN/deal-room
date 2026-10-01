// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { ImageResponse } from "next/og";

/**
 * The one Open Graph image shared by the contract guide pages (the app
 * generates no per-page images). Rendered once at build time.
 */
export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0b0d12",
          color: "#f5f5f5",
        }}
      >
        <div style={{ fontSize: 40, letterSpacing: 6, color: "#a1a1aa" }}>DEALROOM</div>
        <div style={{ fontSize: 76, fontWeight: 700, marginTop: 24, lineHeight: 1.1 }}>
          Contract guides
        </div>
        <div style={{ fontSize: 34, marginTop: 28, color: "#d4d4d8" }}>
          NDA, DPA, SaaS, MSA, BAA, employment, startup documents and more
        </div>
        <div style={{ fontSize: 28, marginTop: 48, color: "#a1a1aa" }}>dealroom.todo.law/contracts</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
