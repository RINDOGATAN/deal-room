"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import { brand } from "@/config/brand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isDocsActive = pathname.startsWith("/docs");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Floating Glassmorphism Header — matches dashboard */}
      <header className="sticky top-0 z-20 px-4 pt-3">
        <div className="max-w-7xl mx-auto bg-card/80 backdrop-blur-md border border-border rounded-xl md:rounded-full px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-foreground"
            >
              TODO.LAW<sup className="text-xs align-super">™</sup>{" "}
              <span className="text-muted-foreground">DEALROOM</span>
            </Link>

            <nav className="flex items-center gap-1">
              <Link
                href="/docs"
                className={`
                  flex items-center gap-2 px-4 py-2 text-sm font-medium
                  rounded-full transition-colors
                  ${
                    isDocsActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }
                `}
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">User Guide</span>
              </Link>
              <Link
                href="/sign-in"
                className="px-4 py-1.5 text-sm font-medium text-primary border border-primary rounded-full hover:bg-secondary transition-colors"
              >
                Sign In
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer — matches dashboard */}
      <footer className="py-4 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Link
              href="/docs"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              User Guide
            </Link>
            <span className="text-border">&middot;</span>
            <a
              href={brand.links.terms}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Terms of Use
            </a>
            <span className="text-border">&middot;</span>
            <a
              href={brand.links.privacy}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Privacy Notice
            </a>
            <span className="text-border">&middot;</span>
            <LanguageSwitcher />
          </div>
        </div>
      </footer>
    </div>
  );
}
