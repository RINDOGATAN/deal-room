"use client";

import Link from "next/link";
import { brand } from "@/config/brand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-heading tracking-tight text-foreground">
            TODO.LAW<sup className="text-[10px] ml-0.5 align-super text-muted-foreground">TM</sup>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
          <a
            href={brand.links.privacy}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Privacy Policy
          </a>
          <span className="hidden sm:inline">&middot;</span>
          <a
            href={brand.links.terms}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Terms of Service
          </a>
          <span className="hidden sm:inline">&middot;</span>
          <Link
            href="/docs/how-it-works"
            className="hover:text-foreground transition-colors"
          >
            How It Works
          </Link>
        </div>
      </footer>
    </div>
  );
}
