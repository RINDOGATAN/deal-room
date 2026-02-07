import Link from "next/link";
import { BookOpen } from "lucide-react";
import { brand } from "@/config/brand";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
            DPO CENTRAL{" "}
            <span className="text-sm font-normal text-muted-foreground">- Privacy Program Management Platform</span>
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              href="/docs"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Documentation
            </Link>
            <Link
              href="/sign-in"
              className="px-4 py-1.5 text-sm font-medium text-primary border border-primary rounded-full hover:bg-secondary transition-colors"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

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
        </div>
      </footer>
    </div>
  );
}
