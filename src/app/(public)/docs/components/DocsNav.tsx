"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Workflow,
  Package,
  Eye,
  Scale,
} from "lucide-react";

const navItems = [
  {
    href: "/docs",
    label: "Overview",
    icon: BookOpen,
    exact: true,
  },
  {
    href: "/docs/how-it-works",
    label: "How It Works",
    icon: Workflow,
  },
  {
    href: "/docs/skills",
    label: "Skills & Licensing",
    icon: Package,
  },
  {
    href: "/docs/supervision",
    label: "Supervision",
    icon: Eye,
  },
  {
    href: "/docs/compromise",
    label: "Compromise Algorithm",
    icon: Scale,
  },
];

export function DocsNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4 px-3">
        Documentation
      </p>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex items-center gap-3 px-3 py-2 text-sm font-medium
              border-l-2 transition-colors
              ${
                isActive
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              }
            `}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
