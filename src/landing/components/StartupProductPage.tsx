import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { useAuth, GoogleSignInButton } from "../auth/AuthContext";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export interface Feature {
  id: string;
  icon: LucideIcon;
  title: string;
  headline: string;
  description: string;
  highlights: string[];
}

export interface WorkflowStep {
  title: string;
  desc: string;
}

export interface ValueProp {
  title: string;
  desc: string;
}

interface StartupProductPageProps {
  t: (key: string) => string;
  tAuth: (key: string) => string;
  features: Feature[];
  workflowSteps: WorkflowStep[];
  valueProps: ValueProp[];
  socialProofs: string[];
  heroVideo: string;
  accentGradient?: string;
  onAuthenticated?: () => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const StartupProductPage = ({
  t,
  tAuth,
  features,
  workflowSteps,
  valueProps,
  socialProofs,
  heroVideo,
  accentGradient = "from-accent/20 to-accent/5",
  onAuthenticated,
}: StartupProductPageProps) => {
  const platformUrl = t("hero.platform_url");
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isAuthenticated, requestMagicLink, magicLinkSent, sending, error, login, clearError } = useAuth();
  const [cardMode, setCardMode] = useState<"signup" | "login" | "sent">("signup");
  const [emailInput, setEmailInput] = useState("");

  // Robust autoplay with interaction fallback
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
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
  }, []);

  // Redirect to platform on authentication
  useEffect(() => {
    if (isAuthenticated) {
      if (onAuthenticated) {
        onAuthenticated();
      } else {
        window.location.href = platformUrl;
      }
    }
  }, [isAuthenticated, platformUrl, onAuthenticated]);

  // Switch to "sent" card state when magic link is sent
  useEffect(() => {
    if (magicLinkSent) setCardMode("sent");
  }, [magicLinkSent]);

  const handleMagicLink = (e: React.FormEvent) => {
    e.preventDefault();
    requestMagicLink(emailInput);
  };

  return (
    <main>
      {/* HERO with video background */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover"
            src={heroVideo}
          />
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/20" />
        </div>

        <div className="relative z-10 container px-6 py-20 md:py-28">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-accent/15 backdrop-blur-sm rounded-full border border-accent/30">
                    <span className="text-xs uppercase tracking-wider text-accent font-medium font-body">
                      {t("hero.badge")}
                    </span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl leading-[1.1] tracking-tight mb-6 text-white">
                    {t("hero.title.prefix")}
                    <span className="text-accent">{t("hero.title.accent")}</span>
                    {t("hero.title.suffix")}
                  </h1>
                  <p className="text-lg text-white/70 leading-relaxed font-body mb-8 max-w-lg">
                    {t("hero.subtitle")}
                  </p>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="lg:sticky lg:top-24"
              >
                <div className="bg-card/90 backdrop-blur-xl rounded-2xl border border-border/80 p-8 md:p-10 relative overflow-hidden shadow-2xl">
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-accent/10 rounded-full blur-3xl" />

                  {cardMode === "sent" ? (
                    <div className="relative animate-fade-in">
                      <div className="w-12 h-12 bg-accent/15 rounded-full flex items-center justify-center mb-4">
                        <Check className="w-6 h-6 text-accent" />
                      </div>
                      <h2 className="text-xl md:text-2xl font-display mb-2">{tAuth("sent.heading")}</h2>
                      <p className="text-sm text-muted-foreground font-body mb-1">
                        {tAuth("sent.desc")} <span className="text-foreground font-medium">{emailInput}</span>
                      </p>
                      <p className="text-sm text-muted-foreground font-body mb-6">{tAuth("sent.action")}</p>
                      <button
                        onClick={() => requestMagicLink(emailInput)}
                        disabled={sending}
                        className="text-sm text-accent hover:text-accent/80 transition-colors font-body flex items-center gap-1"
                      >
                        {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {tAuth("sent.resend")}
                      </button>
                    </div>
                  ) : cardMode === "login" ? (
                    <div className="relative animate-fade-in">
                      <h2 className="text-xl md:text-2xl font-display mb-2">{tAuth("login.heading")}</h2>
                      <p className="text-sm text-muted-foreground font-body mb-6">{tAuth("login.subtitle")}</p>
                      <form onSubmit={handleMagicLink} className="space-y-4">
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="you@startup.com"
                          className="w-full px-4 py-3 bg-secondary/80 border border-border rounded-xl text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                        />
                        <button
                          type="submit"
                          disabled={sending}
                          className="w-full btn-primary text-base py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] flex items-center justify-center gap-2"
                        >
                          {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                          {tAuth("login.magicLink")}
                        </button>
                      </form>
                      {GOOGLE_CLIENT_ID && (
                        <>
                          <div className="flex items-center gap-4 my-5">
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-xs text-muted-foreground font-body">{tAuth("or")}</span>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                            <GoogleSignInButton
                              onSuccess={(email, token, name) => login(email, token, "google", name)}
                              onError={() => {}}
                            />
                          </GoogleOAuthProvider>
                        </>
                      )}
                      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
                      <button
                        onClick={() => { setCardMode("signup"); clearError(); }}
                        className="block w-full text-center text-sm text-muted-foreground hover:text-accent transition-colors mt-4 font-body"
                      >
                        {tAuth("login.newHere")}
                      </button>
                    </div>
                  ) : (
                    <div className="relative animate-fade-in">
                      <h2 className="text-xl md:text-2xl font-display mb-2">{t("hero.cta")}</h2>
                      <p className="text-sm text-muted-foreground font-body mb-6">
                        {t("hero.subtitle").split(".")[0]}.
                      </p>
                      <form onSubmit={handleMagicLink} className="space-y-4">
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="you@startup.com"
                          className="w-full px-4 py-3 bg-secondary/80 border border-border rounded-xl text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-all"
                        />
                        <button
                          type="submit"
                          disabled={sending}
                          className="w-full btn-primary text-base py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] flex items-center justify-center gap-2"
                        >
                          {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                          {t("hero.cta")}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </form>
                      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
                      <button
                        onClick={() => { setCardMode("login"); clearError(); }}
                        className="block w-full text-center text-sm text-muted-foreground hover:text-accent transition-colors mt-4 font-body"
                      >
                        {t("hero.login")}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF BAR */}
      <section className="py-6 border-y border-border bg-secondary/20">
        <div className="container px-6">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
            <span className="text-xs text-muted-foreground font-body uppercase tracking-wider">
              {t("social.title")}
            </span>
            {socialProofs.map((proof) => (
              <div key={proof} className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-accent" />
                <span className="text-sm font-body text-foreground/80">{proof}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="py-20 md:py-28">
        <div className="container px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="section-label">{t("value.label")}</span>
            <h2 className="text-2xl md:text-4xl mb-4">
              {t("value.heading.prefix")}
              <span className="text-accent">{t("value.heading.accent")}</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {valueProps.map((vp, i) => (
              <motion.div
                key={vp.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                className="paper-card"
              >
                <h3 className="text-lg font-display mb-3">{vp.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-body">{vp.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 md:py-28 bg-secondary/20 border-y border-border">
        <div className="container px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="section-label">{t("workflow.label")}</span>
            <h2 className="text-2xl md:text-4xl mb-4">
              {t("workflow.heading.prefix")}
              <span className="text-accent">{t("workflow.heading.accent")}</span>
              {t("workflow.heading.suffix")}
            </h2>
          </div>
          <div className="max-w-3xl mx-auto">
            {workflowSteps.map((step, i) => (
              <motion.div
                key={step.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-30px" }}
                variants={fadeUp}
                className="flex items-start gap-6 mb-6"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <span className="text-lg font-display text-accent">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="paper-card flex-1">
                  <h3 className="text-lg font-display mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed font-body">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURE SHOWCASE */}
      <section className="py-20 md:py-28" id="features">
        <div className="container px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <span className="section-label">{t("feat.label")}</span>
            <h2 className="text-2xl md:text-4xl">
              {t("feat.heading.prefix")}
              <span className="text-accent">{t("feat.heading.accent")}</span>
            </h2>
          </div>
          <div className="space-y-8 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <motion.div
                key={feature.id}
                custom={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                className="paper-card group hover:border-accent/50 transition-all duration-300"
              >
                <div className={`flex flex-col md:flex-row gap-6 md:gap-10 ${index % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                  <div className="md:w-2/5 flex flex-col">
                    <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-4">
                      <feature.icon className="w-7 h-7 text-accent" />
                    </div>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium font-body mb-1">{feature.title}</span>
                    <h3 className="text-xl md:text-2xl font-display mb-3">{feature.headline}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-body">{feature.description}</p>
                  </div>
                  <div className="md:w-3/5 flex items-center">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                      {feature.highlights.map((h) => (
                        <div key={h} className="flex items-center gap-3 bg-secondary/50 rounded-xl px-4 py-3 border border-border/50">
                          <ArrowRight className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                          <span className="text-sm font-body">{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="py-20 md:py-28 border-t border-border bg-secondary/10">
        <div className="container px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl md:text-4xl mb-6">
              {t("cta.heading.prefix")}
              <span className="text-accent">{t("cta.heading.accent")}</span>
              {t("cta.heading.suffix")}
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto font-body">{t("cta.text")}</p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="btn-primary text-base px-10 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
            >
              {t("cta.button")}
              <ArrowRight className="w-5 h-5 ml-2 inline" />
            </button>
          </motion.div>
        </div>
      </section>
    </main>
  );
};

export default StartupProductPage;
