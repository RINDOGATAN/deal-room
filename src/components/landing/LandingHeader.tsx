"use client";

import { useState } from "react";
import Link from "next/link";
import { Github, Menu, X } from "lucide-react";
import { brand } from "@/config/brand";

export default function LandingHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl">
      <div className="nav-header px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <img src={brand.assets.logo} alt={brand.companyShort} className="h-4 w-auto" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#alt-deployment" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Deployment
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </a>
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://github.com/rindogatan"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-4 h-4" />
            </a>
            <Link
              href="/sign-in"
              className="btn-primary text-sm py-2 px-4"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 px-2 border-t border-border">
            <nav className="flex flex-col gap-3">
              <a href="#features" className="text-sm text-muted-foreground px-2 py-1" onClick={() => setIsMenuOpen(false)}>Features</a>
              <a href="#alt-deployment" className="text-sm text-muted-foreground px-2 py-1" onClick={() => setIsMenuOpen(false)}>Deployment</a>
              <a href="#how-it-works" className="text-sm text-muted-foreground px-2 py-1" onClick={() => setIsMenuOpen(false)}>How It Works</a>
              <a href="https://github.com/rindogatan" className="flex items-center gap-2 text-sm text-muted-foreground px-2 py-1">
                <Github className="w-4 h-4" />
                GitHub
              </a>
              <Link href="/sign-in" className="btn-primary text-sm py-2 px-4 mt-2 text-center" onClick={() => setIsMenuOpen(false)}>
                Get Started
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
