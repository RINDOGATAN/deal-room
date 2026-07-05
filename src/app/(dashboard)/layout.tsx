"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  FileText,
  Plus,
  LogOut,
  User,
  Menu,
  X,
  Scale,
  BookOpen,
  CreditCard,
  Store,
  MessageSquareWarning,
  Briefcase,
  ArrowRightLeft,
  Rocket,
} from "lucide-react";
import { brand } from "@/config/brand";
import { features } from "@/config/features";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { trpc } from "@/lib/trpc";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { OnboardingModal } from "@/components/OnboardingModal";
import { TesterBar } from "@/components/TesterBar";
import { UserRoleProvider } from "@/contexts/UserRoleContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tFooter = useTranslations("footer");
  const tOnboarding = useTranslations("onboarding");
  const locale = useLocale();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showOnboardingOverride, setShowOnboardingOverride] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const { data: lawyerProfile } = trpc.lawyer.getProfile.useQuery(
    undefined,
    { enabled: status === "authenticated", retry: false }
  );

  const userRole = session?.user?.role ?? null;
  // Founders arriving on /launch have self-identified as startup owners;
  // don't block them with the business-vs-lawyer onboarding modal. They can
  // pick a role later if they visit another part of the product.
  const onLaunchRoute = pathname?.startsWith("/launch") ?? false;
  const needsOnboarding =
    features.lawyerInvolvement && status === "authenticated" && !userRole && !onLaunchRoute;
  const showOnboarding = needsOnboarding || showOnboardingOverride;

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{tCommon("loading")}</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    redirect("/sign-in");
  }

  const navItems = [
    { href: "/deals", label: t("myDeals"), icon: FileText },
    { href: "/deals/new", label: t("newDeal"), icon: Plus },
    // The /launch journey is Delaware C-Corp formation — US-only.
    // Hide it for Spanish-locale users to avoid the misleading entry point.
    ...(features.startupJourney && !lawyerProfile?.isLawyer && locale !== "es"
      ? [{ href: "/launch", label: t("launch"), icon: Rocket }]
      : []),
  ];

  return (
    <UserRoleProvider>
    <div className="min-h-screen bg-background">
      {/* Floating Glassmorphism Header */}
      <header className="sticky top-0 z-20 px-4 pt-3">
        <div className="max-w-7xl mx-auto bg-card/80 backdrop-blur-sm border border-border rounded-xl md:rounded-full px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <Link href="/deals" className="flex items-center gap-2">
              <img src={brand.assets.logo} alt={brand.company} style={{ height: "28px", width: "auto" }} />
              <span className="text-muted-foreground" style={{ fontFamily: "var(--font-display), 'Jost', sans-serif", fontWeight: 600 }}>DEALROOM</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href ||
                  (item.href !== "/deals" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      flex items-center gap-2 px-4 py-2 text-sm font-medium
                      rounded-full transition-colors
                      ${isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => setFeedbackOpen(true)}
                className="p-2.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
                title={tCommon("feedback")}
                aria-label={tCommon("feedback")}
              >
                <MessageSquareWarning className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span>{session?.user?.email}</span>
              </div>
              <button
                onClick={async () => {
                  await fetch("/api/auth/cross-logout", { method: "POST" });
                  window.location.href = "/sign-in";
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {t("signOut")}
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label={tCommon("openMenu")}
              className="md:hidden p-2.5 text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-30 md:hidden">
          <div className="flex flex-col h-full p-6">
            <div className="flex items-center justify-between mb-8">
              <Link href="/deals" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                <img src={brand.assets.logo} alt={brand.company} style={{ height: "28px", width: "auto" }} />
                <span className="text-muted-foreground" style={{ fontFamily: "var(--font-display), 'Jost', sans-serif", fontWeight: 600 }}>DEALROOM</span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 text-muted-foreground hover:text-foreground"
                aria-label={tCommon("closeMenu")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-2 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href ||
                  (item.href !== "/deals" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 text-lg font-medium
                      rounded-xl transition-colors
                      ${isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-border pt-6 space-y-4">
              <button
                onClick={() => { setMobileMenuOpen(false); setFeedbackOpen(true); }}
                className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary transition-colors w-full"
              >
                <MessageSquareWarning className="w-4 h-4" />
                {tCommon("feedback")}
              </button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span>{session?.user?.email}</span>
              </div>
              <button
                onClick={async () => {
                  await fetch("/api/auth/cross-logout", { method: "POST" });
                  window.location.href = "/sign-in";
                }}
                className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary transition-colors w-full"
              >
                <LogOut className="w-4 h-4" />
                {t("signOut")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-4 px-4 md:px-6 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-2 text-sm text-muted-foreground">
          {/* Role badge + directory link */}
          {features.lawyerInvolvement && userRole && (
            <div className="flex items-center gap-3 pb-1">
              <button
                onClick={() => setShowOnboardingOverride(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground rounded-full border border-border hover:border-muted-foreground/50 transition-colors"
              >
                {userRole === "LAWYER" ? <Scale className="w-3.5 h-3.5" /> : <Briefcase className="w-3.5 h-3.5" />}
                <span>{userRole === "LAWYER" ? tOnboarding("roleLawyer") : tOnboarding("roleBusiness")}</span>
                <ArrowRightLeft className="w-3 h-3 ml-0.5 text-primary" />
              </button>
              {userRole === "LAWYER" && (
                <>
                  <span className="text-border">&middot;</span>
                  <Link
                    href="/lawyers/requests"
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    {t("requests")}
                  </Link>
                </>
              )}
            </div>
          )}
          <p className="hidden sm:block">
            {tFooter.rich("service", {
              link: (chunks) => (
                <a
                  href={brand.links.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline decoration-primary/30 hover:decoration-primary"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
          {/* Mobile: 2-column grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-center sm:hidden">
            {features.publicDocs && (
              <Link
                href={brand.links.userGuide}
                target="_blank"
                className="flex items-center justify-center gap-1.5 hover:text-foreground transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                {tFooter("userGuide")}
              </Link>
            )}
            {features.marketplace && !features.allSkillsFree && (
              <Link
                href="/marketplace"
                className="flex items-center justify-center gap-1.5 hover:text-foreground transition-colors"
              >
                <Store className="w-3.5 h-3.5" />
                {tFooter("marketplace")}
              </Link>
            )}
            {features.billing && (
              <Link
                href="/billing"
                className="flex items-center justify-center gap-1.5 hover:text-foreground transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                {tFooter("billing")}
              </Link>
            )}
            <a
              href={brand.links.terms}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              {tFooter("termsOfUse")}
            </a>
            <a
              href={brand.links.privacy}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              {tFooter("privacyNotice")}
            </a>
            {/* AGPL §13: offer of Corresponding Source to network users */}
            <a
              href={brand.links.sourceCode}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2 flex items-center justify-center gap-1.5 hover:text-foreground transition-colors"
            >
              {tFooter("sourceCode")}
            </a>
            <div className="col-span-2 flex justify-center pt-1">
              <LanguageSwitcher />
            </div>
          </div>
          {/* Desktop: inline row */}
          <div className="hidden sm:flex items-center gap-3">
            {features.publicDocs && (
              <>
                <Link
                  href={brand.links.userGuide}
                  target="_blank"
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {tFooter("userGuide")}
                </Link>
                <span className="text-border">&middot;</span>
              </>
            )}
            {features.marketplace && !features.allSkillsFree && (
              <>
                <Link
                  href="/marketplace"
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  <Store className="w-3.5 h-3.5" />
                  {tFooter("marketplace")}
                </Link>
                <span className="text-border">&middot;</span>
              </>
            )}
            {features.billing && (
              <>
                <Link
                  href="/billing"
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  {tFooter("billing")}
                </Link>
                <span className="text-border">&middot;</span>
              </>
            )}
            <a
              href={brand.links.terms}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              {tFooter("termsOfUse")}
            </a>
            <span className="text-border">&middot;</span>
            <a
              href={brand.links.privacy}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              {tFooter("privacyNotice")}
            </a>
            <span className="text-border">&middot;</span>
            {/* AGPL §13: offer of Corresponding Source to network users */}
            <a
              href={brand.links.sourceCode}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              {tFooter("sourceCode")}
            </a>
            <span className="text-border">&middot;</span>
            <LanguageSwitcher />
          </div>
        </div>
      </footer>

      {/* Onboarding Modal */}
      {features.lawyerInvolvement && (
        <OnboardingModal
          open={showOnboarding}
          dismissible={showOnboardingOverride}
          onComplete={() => setShowOnboardingOverride(false)}
        />
      )}

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <TesterBar />
    </div>
    </UserRoleProvider>
  );
}
