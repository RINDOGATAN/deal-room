"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, LogOut, Home, Users, FileText, Package, BarChart, UserCog } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname?.includes("/sign-in") ||
                     pathname?.includes("/verify-request") ||
                     pathname?.includes("/verify") ||
                     pathname?.includes("/error");

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="container mx-auto px-6 py-4 flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3">
              <img src="/nel-icon.png" alt="NEL" className="h-8" />
            </Link>
            <div className="h-6 w-px bg-border" />
            <span className="text-primary font-medium text-sm uppercase tracking-wide">Platform Admin</span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-6">
          <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
            <p>Platform Administration - Deal Room</p>
          </div>
        </footer>
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: Home, exact: true },
    { href: "/admin/supervisors", label: "Supervisors", icon: UserCog },
    { href: "/admin/deals", label: "All Deals", icon: FileText },
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/skills", label: "Skills", icon: Package },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-3">
              <img src="/nel-icon.png" alt="NEL" className="h-8" />
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-primary font-medium text-sm uppercase tracking-wide">Platform Admin</span>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? pathname === item.href
                : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2 px-3 py-2 text-sm font-medium
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
            <button
              onClick={() => {
                // Clear session cookies and redirect
                fetch("/api/auth/admin/signout", { method: "POST" })
                  .then(() => window.location.href = "/admin/sign-in");
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
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
