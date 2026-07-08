"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  Scale,
  ChevronDown,
  HardDrive,
  Bot,
  Shield,
} from "lucide-react";

interface NavItem {
  href: string;
  labelKey: string;
  exact?: boolean;
}

interface NavSection {
  id: string;
  labelKey: string;
  icon: React.ElementType;
  items: NavItem[];
}

const navSectionsDef: NavSection[] = [
  {
    id: "getting-started",
    labelKey: "gettingStarted",
    icon: BookOpen,
    items: [
      { href: "/docs", labelKey: "dashboardOverview", exact: true },
      { href: "/docs/how-it-works", labelKey: "navigation" },
    ],
  },
  {
    id: "negotiation",
    labelKey: "negotiation",
    icon: Scale,
    items: [
      { href: "/docs/compromise", labelKey: "compromiseAlgorithm" },
      { href: "/docs/skills", labelKey: "skillsLicensing" },
    ],
  },
  {
    id: "self-hosted",
    labelKey: "selfHosted",
    icon: HardDrive,
    items: [{ href: "/docs/local-deployment", labelKey: "localDeployment" }],
  },
  {
    id: "agent-api",
    labelKey: "agentApi",
    icon: Bot,
    items: [
      { href: "/docs/agent-api", labelKey: "negotiationApi" },
      { href: "/docs/a2a-skills", labelKey: "a2aSkillsCatalog" },
    ],
  },
  {
    id: "agent-prep",
    labelKey: "agentPrep",
    icon: Shield,
    items: [
      { href: "/docs/agent-preparation", labelKey: "prepOverview", exact: true },
      { href: "/docs/agent-preparation/policy", labelKey: "prepPolicy" },
      { href: "/docs/agent-preparation/playbook", labelKey: "prepPlaybook" },
      { href: "/docs/agent-preparation/disputes", labelKey: "prepDisputes" },
    ],
  },
  // The Administration section (/docs/supervision) is intentionally
  // omitted — that content covers platform-admin and supervisor 2FA
  // flows, which are only relevant to our internal team and to
  // self-hosters of the OSS build. Restore the block (and remove the
  // notFound() in /docs/supervision/page.tsx) if it ever needs to be
  // public again.
];

function getSectionForPath(pathname: string): string | null {
  for (const section of navSectionsDef) {
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
  const t = useTranslations("docs");
  const activeSection = getSectionForPath(pathname);

  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (activeSection) initial.add(activeSection);
    return initial;
  });

  // Auto-open the section containing the active page
  useEffect(() => {
    if (activeSection) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- merges the route-derived active section into user-toggleable open/closed state; deriving during render would discard the user's manual toggles
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
        {t("title")}
      </p>

      {navSectionsDef.map((section) => {
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
              <span className="flex-1 text-left">{t(section.labelKey)}</span>
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
                      {t(item.labelKey)}
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
