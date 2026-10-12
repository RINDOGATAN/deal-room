"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The home page hero: the background video behind a dark scrim, the headline
 * and subtitle on the left, and the sign-up card (magic link or Google) on the
 * right, so a visitor can start straight away.
 *
 * Page speed: the first paint is a small poster image (the video's first
 * frame), never the video. The video is attached after hydration, and only on
 * wide screens, without reduced motion and without Save-Data; phones keep the
 * still poster. Nothing in the hero animates in, so the headline paints at once.
 *
 * Sign-in goes through the next-auth REST endpoints (csrf, then signin), so the
 * public page does not download the next-auth client.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { isBlockedAccountEmail } from "@/lib/email-policy";

export const HERO_VIDEO = "/hero-dealroom-bg.mp4";
export const HERO_POSTER = "/hero-dealroom-poster.webp";

/** Wide screens only; phones and tablets in portrait keep the poster. */
const VIDEO_MEDIA = "(min-width: 768px) and (prefers-reduced-motion: no-preference)";

interface HomeHeroProps {
  t: (key: string) => string;
  tAuth: (key: string) => string;
  /** Where the visitor lands after signing in. */
  callbackUrl: string;
}

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

/** POST to a next-auth sign-in endpoint; returns the URL next-auth answers with. */
async function postSignIn(providerId: string, fields: Record<string, string>): Promise<{ ok: boolean; url: URL | null }> {
  // A 400 from the e-mail policy also carries JSON with an error URL.
  const csrfRes = await fetch("/api/auth/csrf");
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const res = await fetch(`/api/auth/signin/${providerId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...fields, csrfToken, json: "true" }),
  });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const data = (await res.json()) as { url?: string };
    const url = data.url ? new URL(data.url, window.location.origin) : null;
    return { ok: res.ok && !url?.searchParams.get("error"), url };
  }
  return { ok: res.ok, url: null };
}

/** Whether the visitor asked to save data (Chromium's Network Information API). */
function saveData(): boolean {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(conn?.saveData);
}

export default function HomeHero({ t, tAuth, callbackUrl }: HomeHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [cardMode, setCardMode] = useState<"signup" | "login" | "sent">("signup");
  const [emailInput, setEmailInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // The e-mail policy message, shown under the e-mail field (email-policy.ts).
  const [emailError, setEmailError] = useState("");
  const emailProviderRef = useRef<string | null>(null);

  // Detect which email-type provider is registered (v4 "email" vs v5 "resend").
  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((providers) => {
        const ep = providers.email || providers.resend;
        emailProviderRef.current = ep?.id ?? null;
      })
      .catch(() => {});
  }, []);

  // The video only where it costs nothing to the first paint.
  useEffect(() => {
    if (!window.matchMedia(VIDEO_MEDIA).matches || saveData()) return;
    // The media query and Save-Data are only known in the browser; the server renders the poster.
    setShowVideo(true);
  }, []);

  // Robust autoplay with an interaction fallback.
  useEffect(() => {
    const vid = videoRef.current;
    if (!showVideo || !vid) return;
    const tryPlay = () => {
      vid.play().catch(() => {
        const handler = () => {
          vid.play().catch(() => {});
          document.removeEventListener("click", handler);
          document.removeEventListener("touchstart", handler);
        };
        document.addEventListener("click", handler, { once: true });
        document.addEventListener("touchstart", handler, { once: true });
      });
    };
    if (vid.readyState >= 3) tryPlay();
    else vid.addEventListener("canplay", tryPlay, { once: true });
  }, [showVideo]);

  const sendMagicLink = async (email: string): Promise<boolean | "refused"> => {
    if (isBlockedAccountEmail(email)) return "refused";
    const providerId = emailProviderRef.current;
    if (!providerId) return false;
    const res = await postSignIn(providerId, { email, callbackUrl });
    if (res.url?.searchParams.get("error") === "EmailNotAccepted") return "refused";
    return res.ok;
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const ok = await sendMagicLink(emailInput);
      if (ok === "refused") {
        setEmailError(tAuth("emailNotAccepted"));
      } else if (ok) {
        setCardMode("sent");
      } else {
        setError("Email sign-in is not available. Please use Google.");
      }
    } catch {
      setError("Failed to send sign-in link. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleResendMagicLink = async () => {
    setError("");
    setSending(true);
    try {
      const ok = await sendMagicLink(emailInput);
      if (ok === "refused") {
        setError(tAuth("emailNotAccepted"));
      } else if (!ok) {
        setError("Failed to resend link. Please try again.");
      }
    } catch {
      setError("Failed to resend link. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    // Without an answer from next-auth, fall back to the sign-in page.
    let target = new URL("/sign-in", window.location.origin);
    try {
      target = (await postSignIn("google", { callbackUrl })).url ?? target;
    } catch {
      // keep the fallback
    }
    window.location.assign(target.toString());
  };

  const googleDivider = (
    <>
      <div className="flex items-center gap-4 my-5">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground font-body">{tAuth("or")}</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
      >
        <GoogleIcon />
        {tAuth("continueWithGoogle")}
      </button>
    </>
  );

  const emailField = (
    <div className="space-y-2">
      <input
        type="email"
        required
        aria-label="Email"
        autoComplete="email"
        value={emailInput}
        onChange={(e) => {
          setEmailInput(e.target.value);
          setEmailError("");
        }}
        aria-invalid={emailError ? true : undefined}
        aria-describedby={emailError ? "hero-email-error" : undefined}
        placeholder="you@startup.com"
        className="w-full px-4 py-3 bg-secondary/80 border border-border rounded-xl text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
      />
      {emailError && (
        <p id="hero-email-error" role="alert" className="text-sm text-danger font-body">
          {emailError}
        </p>
      )}
    </div>
  );

  const submitClass =
    "w-full btn-primary text-base py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2";

  return (
    <section
      className="relative min-h-[calc(100svh-4.5rem)] flex items-center overflow-hidden"
      data-testid="home-hero"
    >
      <div className="absolute inset-0 z-0">
        {/* The still first frame: what phones show, and what wide screens show until the video plays. */}
        {/* A plain img: the poster is already compressed, and the image optimiser would add a round trip. */}
        <img
          src={HERO_POSTER}
          alt=""
          aria-hidden
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {showVideo && (
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            poster={HERO_POSTER}
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover"
            src={HERO_VIDEO}
          />
        )}
        {/* The scrim is what the hero text is read against; it is dark
            enough that white type stays legible over any frame. */}
        <div className="absolute inset-0 bg-black/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/20" />
      </div>

      <div className="relative z-10 w-full px-6 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-accent/15 backdrop-blur-sm rounded-full border border-accent/30">
                <span className="text-xs uppercase tracking-wider text-accent font-medium font-body">{t("hero.badge")}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl leading-[1.1] tracking-tight mb-6 text-white">
                {t("hero.title.prefix")}
                <span className="text-accent">{t("hero.title.accent")}</span>
                {t("hero.title.suffix")}
              </h1>
              <p className="text-lg text-white leading-relaxed font-body max-w-lg">{t("hero.subtitle")}</p>
            </div>

            <div>
              <div className="bg-card/90 backdrop-blur-xl rounded-2xl border border-border/80 p-8 md:p-10 relative overflow-hidden shadow-2xl">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-accent/10 rounded-full blur-3xl" />

                {cardMode === "sent" ? (
                  <div className="relative">
                    <div className="w-12 h-12 bg-accent/15 rounded-full flex items-center justify-center mb-4">
                      <Check className="w-6 h-6 text-accent" aria-hidden />
                    </div>
                    <h2 className="text-xl md:text-2xl font-display mb-2">{tAuth("sent.heading")}</h2>
                    <p className="text-sm text-muted-foreground font-body mb-1">
                      {tAuth("sent.desc")} <span className="text-foreground font-medium">{emailInput}</span>
                    </p>
                    <p className="text-sm text-muted-foreground font-body mb-6">{tAuth("sent.action")}</p>
                    <button
                      onClick={handleResendMagicLink}
                      disabled={sending}
                      className="text-sm text-accent hover:text-accent/80 transition-colors font-body flex items-center gap-1"
                    >
                      {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
                      {tAuth("sent.resend")}
                    </button>
                    {error && <p className="text-sm text-danger mt-3">{error}</p>}
                  </div>
                ) : cardMode === "login" ? (
                  <div className="relative">
                    <h2 className="text-xl md:text-2xl font-display mb-2">{tAuth("login.heading")}</h2>
                    <p className="text-sm text-muted-foreground font-body mb-6">{tAuth("login.subtitle")}</p>
                    <form onSubmit={handleMagicLink} className="space-y-4">
                      {emailField}
                      <button type="submit" disabled={sending} className={submitClass}>
                        {sending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
                        {tAuth("login.magicLink")}
                      </button>
                    </form>
                    {googleDivider}
                    {error && <p className="text-sm text-danger mt-3">{error}</p>}
                    <button
                      onClick={() => {
                        setCardMode("signup");
                        setError("");
                      }}
                      className="block w-full text-center text-sm text-muted-foreground hover:text-accent transition-colors mt-4 font-body"
                    >
                      {tAuth("login.newHere")}
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <h2 className="text-xl md:text-2xl font-display mb-2">{t("hero.cta")}</h2>
                    <p className="text-sm text-muted-foreground font-body mb-6">{t("hero.cta.subtitle")}</p>
                    <form onSubmit={handleMagicLink} className="space-y-4">
                      {emailField}
                      <button type="submit" disabled={sending} className={submitClass}>
                        {sending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
                        {t("hero.cta")}
                        <ArrowRight className="w-4 h-4" aria-hidden />
                      </button>
                    </form>
                    {googleDivider}
                    {error && <p className="text-sm text-danger mt-3">{error}</p>}
                    <button
                      onClick={() => {
                        setCardMode("login");
                        setError("");
                      }}
                      className="block w-full text-center text-sm text-muted-foreground hover:text-accent transition-colors mt-4 font-body"
                    >
                      {t("hero.login")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
