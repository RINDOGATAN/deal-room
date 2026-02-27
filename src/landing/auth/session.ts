const SESSION_COOKIE_NAME = "todolaw_session";

/** Read the raw todolaw_session JWT from document.cookie. */
export function getSessionCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]+)`)
  );
  return match?.[1] ?? null;
}

export type PlanLevel = "starter" | "pro";

export interface SessionInfo {
  email: string;
  name: string;
  method: "magic-link" | "google";
  entitlements: Record<string, PlanLevel>;
  skills: string[];
  entV: string;
}

/** Decode the JWT payload without signature verification (client-side). */
export function decodeSession(jwt: string): SessionInfo | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));

    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    const entitlements: Record<string, PlanLevel> = payload.ent ?? {};
    const skills: string[] = payload.skills ?? [];
    const entV: string = payload.entV ?? "";

    return {
      email: payload.sub,
      name: payload.name,
      method: payload.method || "magic-link",
      entitlements,
      skills,
      entV,
    };
  } catch {
    return null;
  }
}
