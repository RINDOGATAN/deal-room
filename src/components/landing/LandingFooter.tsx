"use client";

import { Github } from "lucide-react";
import { brand } from "@/config/brand";

export default function LandingFooter() {
  return (
    <footer className="py-12 border-t border-border">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <a href="/" className="flex items-center">
            <img src={brand.assets.logo} alt={brand.companyShort} className="h-8 w-auto" />
          </a>

          {/* Legal Links */}
          <div className="flex items-center gap-6">
            <a
              href={brand.links.privacy}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href={brand.links.terms}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms of Service
            </a>
          </div>

          {/* Copyright & GitHub */}
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              <a
                href="https://creativecommons.org/licenses/by-nd/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                CC BY-ND
              </a>
              {" "}Sergio Maldonado &{" "}
              <a
                href="https://rindogatan.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Rindogatan
              </a>
            </div>
            <a
              href="https://github.com/rindogatan"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-accent transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
