import type { Metadata } from "next";
import { Inter, Dancing_Script } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-signature",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Deal Room - Contract Negotiation Platform",
  description: "Two-party asynchronous contract negotiation platform with intelligent compromise suggestions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${dancingScript.variable} font-sans antialiased min-h-screen flex flex-col`}>
        <Providers>
          <div className="flex-1">
            {children}
          </div>
          <footer className="py-4 px-6 border-t border-border bg-background">
            <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
              Dealroom is a{" "}
              <a
                href="https://northend.law"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                North End Law
              </a>{" "}
              service.{" "}
              <a
                href="https://northend.law/terms-of-use"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Terms of Use
              </a>{" "}
              ·{" "}
              <a
                href="https://northend.law/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Privacy Notice
              </a>
            </div>
          </footer>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
