"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FileText,
  Plus,
  LogOut,
  User,
  Menu,
  X,
  Scale,
  ClipboardCheck,
  BookOpen,
  CreditCard,
  Store,
  MessageSquareWarning,
} from "lucide-react";
import { brand } from "@/config/brand";
import { features } from "@/config/features";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FeedbackDialog } from "@/components/FeedbackDialog";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tLawyer = useTranslations("lawyer");
  const tFooter = useTranslations("footer");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLawyerDialog, setShowLawyerDialog] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const { data: lawyerProfile } = trpc.lawyer.getProfile.useQuery(
    undefined,
    { enabled: status === "authenticated", retry: false }
  );
  const utils = trpc.useUtils();
  const registerLawyer = trpc.lawyer.register.useMutation({
    onSuccess: () => {
      toast.success(tLawyer("registered"));
      setShowLawyerDialog(false);
      utils.lawyer.getProfile.invalidate();
    },
  });

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
    ...(features.lawyerInvolvement && lawyerProfile?.isLawyer
      ? [{ href: "/lawyer/vettings", label: tLawyer("myVettings"), icon: ClipboardCheck }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Floating Glassmorphism Header */}
      <header className="sticky top-0 z-20 px-4 pt-3">
        <div className="max-w-7xl mx-auto bg-card/80 backdrop-blur-sm border border-border rounded-xl md:rounded-full px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <Link href="/deals" className="text-lg font-bold tracking-tight text-foreground">
              {brand.company}<sup className="text-xs align-super">™</sup>{" "}
              <span className="text-muted-foreground">DEALROOM</span>
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
              {features.lawyerInvolvement && lawyerProfile && !lawyerProfile.isLawyer && (
                <button
                  onClick={() => setShowLawyerDialog(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors border border-border"
                >
                  <Scale className="w-3.5 h-3.5" />
                  {tLawyer("iAmALawyer")}
                </button>
              )}
              <button
                onClick={() => setFeedbackOpen(true)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
                title="Feedback"
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
              className="md:hidden p-2 text-muted-foreground hover:text-foreground"
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
              <Link href="/deals" className="text-lg font-bold tracking-tight text-foreground" onClick={() => setMobileMenuOpen(false)}>
                TODO.LAW<sup className="text-xs align-super">™</sup>{" "}
                <span className="text-muted-foreground">DEALROOM</span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-muted-foreground hover:text-foreground"
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
              {features.lawyerInvolvement && lawyerProfile && !lawyerProfile.isLawyer && (
                <button
                  onClick={() => { setMobileMenuOpen(false); setShowLawyerDialog(true); }}
                  className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary transition-colors w-full"
                >
                  <Scale className="w-4 h-4" />
                  {tLawyer("iAmALawyer")}
                </button>
              )}
              <button
                onClick={() => { setMobileMenuOpen(false); setFeedbackOpen(true); }}
                className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-secondary transition-colors w-full"
              >
                <MessageSquareWarning className="w-4 h-4" />
                Feedback
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
          <p className="hidden sm:block">
            {tFooter.rich("service", {
              link: (chunks) => (
                <a
                  href={brand.links.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
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
            {features.marketplace && (
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
            {features.marketplace && (
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
            <LanguageSwitcher />
          </div>
        </div>
      </footer>

      {/* Lawyer Registration Dialog */}
      <Dialog open={showLawyerDialog} onOpenChange={setShowLawyerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
                <Scale className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle>{tLawyer("registerTitle")}</DialogTitle>
                <DialogDescription className="mt-1">
                  {tLawyer("registerDescription")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <button
              onClick={() => setShowLawyerDialog(false)}
              className="px-4 py-2 border border-border text-sm hover:bg-muted/50 rounded-full"
            >
              {tCommon("cancel")}
            </button>
            <button
              onClick={() => registerLawyer.mutate()}
              disabled={registerLawyer.isPending}
              className="btn-brutal text-sm"
            >
              {registerLawyer.isPending ? tLawyer("registering") : tLawyer("registerConfirm")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}
