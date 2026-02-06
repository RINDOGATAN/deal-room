"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FileText,
  Plus,
  LogOut,
  User,
  Menu,
  X,
} from "lucide-react";
import { brand } from "@/config/brand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Floating Glassmorphism Header */}
      <header className="sticky top-0 z-20 px-4 pt-3">
        <div className="max-w-7xl mx-auto bg-card/80 backdrop-blur-md border border-border rounded-xl md:rounded-full px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <Link href="/deals" className="flex items-center">
              <img src={brand.assets.logo} alt={brand.companyShort} className="h-8" />
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
              <LanguageSwitcher />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span>{session?.user?.email}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/sign-in" })}
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
              <Link href="/deals" className="flex items-center" onClick={() => setMobileMenuOpen(false)}>
                <img src={brand.assets.logo} alt={brand.companyShort} className="h-8" />
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
              <LanguageSwitcher />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span>{session?.user?.email}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/sign-in" })}
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
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
