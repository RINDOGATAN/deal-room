// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { redirect } from "next/navigation";
import { API_KEYS_SETTINGS_PATH } from "@/lib/api-key-scopes";

// Settings opens on API keys (the layout 404s where they do not exist).
export default function SettingsPage() {
  redirect(API_KEYS_SETTINGS_PATH);
}
