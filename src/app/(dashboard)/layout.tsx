"use client";

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
} from "lucide-react";
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
      {/* Top Navigation */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/deals" className="flex items-center">
            <img src="/nel-icon.png" alt="NEL" className="h-8" />
          </Link>

          <nav className="flex items-center gap-1">
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
                    border transition-colors
                    ${isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>{session?.user?.email}</span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/sign-in" })}
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {t("signOut")}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
