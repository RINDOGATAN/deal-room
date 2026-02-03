import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Minimal Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/nel-icon.png" alt="NEL" className="h-8" />
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
              className="btn-brutal-outline text-sm"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/nel-icon.png" alt="NEL" className="h-6" />
              <span className="text-sm text-muted-foreground">
                Dealroom by NEL
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/docs" className="hover:text-foreground transition-colors">
                Documentation
              </Link>
              <Link href="/docs/how-it-works" className="hover:text-foreground transition-colors">
                How It Works
              </Link>
              <Link href="/docs/compromise" className="hover:text-foreground transition-colors">
                Algorithm
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
