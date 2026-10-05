// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { redirect } from "next/navigation";
import { features } from "@/config/features";
import { API_KEYS_SETTINGS_PATH } from "@/lib/api-key-scopes";
import { PilotSettings } from "./PilotSettings";

// The hosted pilot shows its counters here. Once billing is on there is no
// pilot, and Settings opens on API keys (the layout 404s everywhere else).
export default function SettingsPage() {
  if (!features.hostedPilot) redirect(API_KEYS_SETTINGS_PATH);
  return <PilotSettings />;
}
