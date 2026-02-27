import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import { decodeJwt } from "jose";
import { Loader2, Mail } from "lucide-react";
import { getSessionCookie, decodeSession, type PlanLevel } from "./session";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const API_BASE = "";

interface AuthState {
  email: string;
  name: string;
  entitlements: Record<string, PlanLevel>;
  skills: string[];
  authToken: string;
  authMethod: "google" | "magic-link";
  isAuthenticated: boolean;
  magicLinkSent: boolean;
  sending: boolean;
  error: string;
  login: (email: string, token: string, method: "google" | "magic-link", name?: string) => void;
  logout: () => void;
  requestMagicLink: (email: string) => Promise<void>;
  refreshEntitlements: () => Promise<void>;
  hasProduct: (productId: string, minPlan?: PlanLevel) => boolean;
  hasSkill: (skillId: string) => boolean;
  clearError: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

const SESSION_KEY = "todolaw_auth";

interface SavedSession {
  email: string;
  token: string;
  method: "google" | "magic-link";
  name?: string;
  entitlements?: Record<string, PlanLevel>;
  skills?: string[];
}

function saveSession(data: SavedSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function loadSession(): SavedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Issue the shared .todo.law session cookie via the session API. */
async function issueSessionCookie(
  email: string,
  name: string,
  method: "google" | "magic-link",
): Promise<{ entitlements?: Record<string, PlanLevel>; skills?: string[] } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, method }),
      credentials: "include",
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Non-critical: session cookie is a cross-app convenience
  }
  return null;
}

/** Derive a first name from an email address (e.g. "jane.doe@..." -> "Jane"). */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0];
  const first = local.split(/[._-]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function clearSessionStorage() {
  sessionStorage.removeItem(SESSION_KEY);
}

const PLAN_RANK: Record<string, number> = { starter: 1, pro: 2 };

export function AuthProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [entitlements, setEntitlements] = useState<Record<string, PlanLevel>>({});
  const [skills, setSkills] = useState<string[]>([]);
  const [authToken, setAuthToken] = useState("");
  const [authMethod, setAuthMethod] = useState<"google" | "magic-link">("google");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const isAuthenticated = !!email && !!authToken;

  // Restore session on mount — cookie is source of truth, sessionStorage is fast cache
  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setEmail(saved.email);
      setAuthToken(saved.token);
      setAuthMethod(saved.method);
      setName(saved.name || nameFromEmail(saved.email));
      setEntitlements(saved.entitlements ?? {});
      setSkills(saved.skills ?? []);
      return;
    }

    // Fall back to shared session cookie (set by another *.todo.law app)
    const jwt = getSessionCookie();
    if (jwt) {
      const session = decodeSession(jwt);
      if (session) {
        setEmail(session.email);
        setName(session.name);
        setEntitlements(session.entitlements);
        setSkills(session.skills);
        setAuthToken(jwt);
        setAuthMethod(session.method);
        saveSession({
          email: session.email,
          token: jwt,
          method: session.method,
          name: session.name,
          entitlements: session.entitlements,
          skills: session.skills,
        });
      }
    }
  }, []);

  // Handle magic link token from URL
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      try {
        const payload = decodeJwt(token);
        if (payload.email && typeof payload.email === "string") {
          const derived = nameFromEmail(payload.email);
          setEmail(payload.email);
          setName(derived);
          setAuthMethod("magic-link");
          setAuthToken(token);
          saveSession({ email: payload.email, token, method: "magic-link", name: derived });
          issueSessionCookie(payload.email, derived, "magic-link").then((resp) => {
            if (resp?.entitlements) setEntitlements(resp.entitlements);
            if (resp?.skills) setSkills(resp.skills);
          });
        }
      } catch {
        setError("Invalid or expired link. Please try again.");
      }
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  const login = useCallback((loginEmail: string, token: string, method: "google" | "magic-link", givenName?: string) => {
    const resolvedName = givenName || nameFromEmail(loginEmail);
    setEmail(loginEmail);
    setName(resolvedName);
    setAuthToken(token);
    setAuthMethod(method);
    setError("");
    saveSession({ email: loginEmail, token, method, name: resolvedName });
    issueSessionCookie(loginEmail, resolvedName, method).then((resp) => {
      if (resp?.entitlements) setEntitlements(resp.entitlements);
      if (resp?.skills) setSkills(resp.skills);
    });
  }, []);

  const logout = useCallback(() => {
    setEmail("");
    setName("");
    setEntitlements({});
    setSkills([]);
    setAuthToken("");
    setMagicLinkSent(false);
    setError("");
    clearSessionStorage();
    fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
  }, []);

  const refreshEntitlements = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.authenticated) {
        const newEnt = data.entitlements ?? {};
        const newSkills = data.skills ?? [];
        setEntitlements(newEnt);
        setSkills(newSkills);
        const saved = loadSession();
        if (saved) {
          saveSession({ ...saved, entitlements: newEnt, skills: newSkills });
        }
      }
    } catch {
      // Non-critical
    }
  }, []);

  const hasProduct = useCallback((productId: string, minPlan?: PlanLevel): boolean => {
    const userPlan = entitlements[productId];
    if (!userPlan) return false;
    if (!minPlan) return true;
    return (PLAN_RANK[userPlan] ?? 0) >= (PLAN_RANK[minPlan] ?? 0);
  }, [entitlements]);

  const hasSkill = useCallback((skillId: string): boolean => {
    return skills.includes(skillId);
  }, [skills]);

  const requestMagicLink = useCallback(async (emailInput: string) => {
    if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/contact/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput, returnTo: window.location.pathname, origin: window.location.origin }),
      });
      if (!res.ok) throw new Error();
      setMagicLinkSent(true);
    } catch {
      setError("Failed to send link. Please try again.");
    } finally {
      setSending(false);
    }
  }, []);

  const clearError = useCallback(() => setError(""), []);

  return (
    <AuthContext.Provider
      value={{
        email,
        name,
        entitlements,
        skills,
        authToken,
        authMethod,
        isAuthenticated,
        magicLinkSent,
        sending,
        error,
        login,
        logout,
        requestMagicLink,
        refreshEntitlements,
        hasProduct,
        hasSkill,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Shared Google Sign-In button
export function GoogleSignInButton({
  onSuccess,
  onError,
}: {
  onSuccess: (email: string, token: string, name?: string) => void;
  onError: () => void;
}) {
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const data = await res.json();
        if (data.email) {
          onSuccess(data.email, tokenResponse.access_token, data.given_name);
        } else {
          onError();
        }
      } catch {
        onError();
      }
    },
    onError: () => onError(),
  });

  return (
    <button
      onClick={() => googleLogin()}
      className="w-full h-10 px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-secondary/50 transition-colors flex items-center justify-center gap-3"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      Continue with Google
    </button>
  );
}

// Inline auth prompt for use in modals/pages
export function InlineAuthPrompt({ onAuthenticated }: { onAuthenticated?: () => void }) {
  const { login, requestMagicLink, magicLinkSent, sending, error } = useAuth();
  const [emailInput, setEmailInput] = useState("");

  return (
    <div className="flex flex-col gap-4">
      {/* Magic Link */}
      <div>
        <p className="text-sm font-medium mb-3">
          <Mail className="w-4 h-4 inline-block mr-2 -mt-0.5" />
          Magic Link
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Enter your email and we'll send you a one-time link.
        </p>
        {magicLinkSent ? (
          <div className="text-sm text-muted-foreground">
            <p className="mb-1">
              Check your inbox at{" "}
              <span className="text-foreground font-medium">{emailInput}</span>
            </p>
            <p>Click the link in the email to continue.</p>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="you@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && requestMagicLink(emailInput)}
              className="flex-1 h-10 px-3 rounded-md border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button
              onClick={() => requestMagicLink(emailInput)}
              disabled={sending}
              className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
            >
              {sending && <Loader2 className="w-4 h-4 animate-spin" />}
              Send link
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      {GOOGLE_CLIENT_ID && (
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* Google */}
      {GOOGLE_CLIENT_ID && (
        <div>
          <p className="text-sm font-medium mb-3">Google Account</p>
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <GoogleSignInButton
              onSuccess={(email, token, name) => {
                login(email, token, "google", name);
                onAuthenticated?.();
              }}
              onError={() => {}}
            />
          </GoogleOAuthProvider>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
