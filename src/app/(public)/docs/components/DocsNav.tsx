"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Eye,
  Scale,
  ChevronDown,
  ClipboardCheck,
  HardDrive,
  Bot,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

interface NavSection {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    icon: BookOpen,
    items: [
      { href: "/docs", label: "Dashboard Overview", exact: true },
      { href: "/docs/how-it-works", label: "Deal Lifecycle" },
    ],
  },
  {
    id: "negotiation",
    label: "Negotiation",
    icon: Scale,
    items: [
      { href: "/docs/compromise", label: "Compromise Algorithm" },
      { href: "/docs/skills", label: "Skills & Licensing" },
    ],
  },
  {
    id: "lawyer-vetting",
    label: "Lawyer Vetting",
    icon: ClipboardCheck,
    items: [{ href: "/docs/vetting", label: "How Vetting Works" }],
  },
  {
    id: "self-hosted",
    label: "Self-Hosted",
    icon: HardDrive,
    items: [{ href: "/docs/local-deployment", label: "Local Deployment" }],
  },
  {
    id: "agent-api",
    label: "Agent API",
    icon: Bot,
    items: [{ href: "/docs/agent-api", label: "Negotiation API" }],
  },
  {
    id: "administration",
    label: "Administration",
    icon: Eye,
    items: [{ href: "/docs/supervision", label: "Supervision" }],
  },
];

function getSectionForPath(pathname: string): string | null {
  for (const section of navSections) {
    for (const item of section.items) {
      if (item.exact ? pathname === item.href : pathname.startsWith(item.href)) {
        return section.id;
      }
    }
  }
  return null;
}

export function DocsNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activeSection = getSectionForPath(pathname);

  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (activeSection) initial.add(activeSection);
    return initial;
  });

  // Auto-open the section containing the active page
  useEffect(() => {
    if (activeSection) {
      setOpenSections((prev) => {
        if (prev.has(activeSection)) return prev;
        const next = new Set(prev);
        next.add(activeSection);
        return next;
      });
    }
  }, [activeSection]);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <nav className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4 px-3">
        User Guide
      </p>

      {navSections.map((section) => {
        const Icon = section.icon;
        const isOpen = openSections.has(section.id);
        const isSectionActive = activeSection === section.id;

        return (
          <div key={section.id}>
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2 text-sm font-medium
                rounded-lg transition-colors
                ${
                  isSectionActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }
              `}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{section.label}</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  isOpen ? "rotate-0" : "-rotate-90"
                }`}
              />
            </button>

            {/* Sub-items */}
            {isOpen && (
              <div className="ml-5 pl-3 border-l border-border space-y-0.5 mt-0.5 mb-1">
                {section.items.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={`
                        block px-3 py-1.5 text-sm rounded-md transition-colors
                        ${
                          isActive
                            ? "text-primary bg-primary/5 font-medium border-l-2 border-primary -ml-[1px] pl-[11px]"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }
                      `}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
