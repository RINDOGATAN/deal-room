import Link from "next/link";
import {
  Workflow,
  Package,
  Eye,
  Scale,
  ArrowRight,
} from "lucide-react";

const sections = [
  {
    href: "/docs/how-it-works",
    icon: Workflow,
    title: "How It Works",
    description:
      "Learn the complete deal lifecycle from creation to signature, including the 6-stage workflow.",
  },
  {
    href: "/docs/skills",
    icon: Package,
    title: "Skills & Licensing",
    description:
      "Understand how attorney-created contract templates power negotiations with multi-language support.",
  },
  {
    href: "/docs/supervision",
    icon: Eye,
    title: "Supervision",
    description:
      "Explore the two-level administration system with platform admins and supervisors.",
  },
  {
    href: "/docs/compromise",
    icon: Scale,
    title: "Compromise Algorithm",
    description:
      "Discover the weighted stake-based algorithm that suggests fair compromises. Try it interactively.",
  },
];

export default function DocsPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold">
          How <span className="text-primary">Dealroom</span> Works
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Two-party asynchronous contract negotiation with a weighted compromise
          algorithm that helps both sides reach fair agreements.
        </p>
      </div>

      {/* Value Props */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 border border-border">
          <p className="font-semibold mb-1">Asynchronous</p>
          <p className="text-sm text-muted-foreground">
            Negotiate on your schedule. No coordinated meetings required.
          </p>
        </div>
        <div className="p-4 border border-border">
          <p className="font-semibold mb-1">Fair Algorithm</p>
          <p className="text-sm text-muted-foreground">
            Stake-weighted suggestions that balance both parties' priorities.
          </p>
        </div>
        <div className="p-4 border border-border">
          <p className="font-semibold mb-1">Attorney-Crafted</p>
          <p className="text-sm text-muted-foreground">
            Professional contract templates with jurisdiction-aware options.
          </p>
        </div>
      </div>

      {/* Section Cards */}
      <div>
        <h2 className="text-xl font-bold mb-6">Documentation Sections</h2>
        <div className="grid grid-cols-2 gap-6">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group block p-6 border-2 border-border hover:border-primary transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 border border-border flex items-center justify-center group-hover:border-primary group-hover:text-primary transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors flex items-center gap-2">
                      {section.title}
                      <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {section.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Start */}
      <div className="border-2 border-primary/30 p-6 bg-primary/5">
        <h2 className="text-xl font-bold mb-4">Quick Start</h2>
        <div className="space-y-3">
          <p className="text-muted-foreground">
            The typical Dealroom workflow:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              <span className="text-foreground font-medium">Create a deal</span>{" "}
              <span className="text-muted-foreground">
                — Select a contract type and jurisdiction
              </span>
            </li>
            <li>
              <span className="text-foreground font-medium">
                Invite the other party
              </span>{" "}
              <span className="text-muted-foreground">
                — They receive an email invitation to join
              </span>
            </li>
            <li>
              <span className="text-foreground font-medium">
                Both parties submit preferences
              </span>{" "}
              <span className="text-muted-foreground">
                — Select options and set priority/flexibility for each clause
              </span>
            </li>
            <li>
              <span className="text-foreground font-medium">
                Algorithm suggests compromises
              </span>{" "}
              <span className="text-muted-foreground">
                — Weighted stake calculation finds fair middle ground
              </span>
            </li>
            <li>
              <span className="text-foreground font-medium">
                Accept or counter
              </span>{" "}
              <span className="text-muted-foreground">
                — Review suggestions and negotiate if needed
              </span>
            </li>
            <li>
              <span className="text-foreground font-medium">
                Sign the contract
              </span>{" "}
              <span className="text-muted-foreground">
                — E-signature integration for final execution
              </span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
