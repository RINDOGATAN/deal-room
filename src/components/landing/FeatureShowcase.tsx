"use client";

import { Lock, Brain, Clock, RefreshCw, Globe, FileSignature, ArrowRight } from "lucide-react";

const features = [
  {
    id: "encryption",
    icon: Lock,
    title: "End-to-End Encryption",
    headline: "Security beyond email.",
    description:
      "Unlike email, every negotiation happens on a secure, encrypted platform. No more sensitive contract terms floating across inboxes.",
    highlights: [
      "Encrypted negotiation channels",
      "Secure document exchange",
      "Full audit trail",
      "Role-based access control",
    ],
  },
  {
    id: "ai-compromise",
    icon: Brain,
    title: "AI-Powered Compromise",
    headline: "Find the middle ground, automatically.",
    description:
      "Weighted algorithms analyze both parties' priorities and suggest the optimal middle ground for each clause. Turn adversarial negotiations into collaborative ones.",
    highlights: [
      "Priority-weighted suggestions",
      "Clause-by-clause analysis",
      "Optimal compromise scoring",
      "Transparent reasoning",
    ],
  },
  {
    id: "async",
    icon: Clock,
    title: "Async Negotiation",
    headline: "No scheduling conflicts.",
    description:
      "Both parties work on their own time. Set priorities, review positions, and respond when it suits you — no more coordinating across time zones.",
    highlights: [
      "Work at your own pace",
      "Cross-timezone friendly",
      "Deadline tracking",
      "Notification preferences",
    ],
  },
  {
    id: "realtime",
    icon: RefreshCw,
    title: "Real-Time Sync",
    headline: "No more v12_final_FINAL.docx.",
    description:
      "See changes instantly as they happen. One single source of truth for the contract, with full version history and clause-level commenting.",
    highlights: [
      "Live document updates",
      "Version history & diffing",
      "Clause-level comments",
      "Single source of truth",
    ],
  },
  {
    id: "cross-border",
    icon: Globe,
    title: "Cross-Border Ready",
    headline: "Pre-configured for key jurisdictions.",
    description:
      "Clause libraries and templates tailored for California, England & Wales, and Spain — with more jurisdictions coming soon. Navigate multi-jurisdictional requirements automatically.",
    highlights: [
      "California clause library",
      "England & Wales templates",
      "Spain jurisdiction support",
      "More jurisdictions coming",
    ],
  },
  {
    id: "export",
    icon: FileSignature,
    title: "Export & Sign",
    headline: "From negotiation to execution.",
    description:
      "Generate a final version for all parties to sign. Invite an attorney to review at any stage. Supports MSAs, DPAs, SaaS Agreements, NDAs, Pilot Contracts, and Statements of Work.",
    highlights: [
      "One-click final export",
      "Attorney review workflow",
      "Six contract types supported",
      "Digital signature ready",
    ],
  },
];

export default function FeatureShowcase() {
  return (
    <section className="py-24" id="features">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="section-label">Core Capabilities</span>
          <h2 className="text-2xl md:text-4xl mb-6 mt-4">
            A Smarter Way to <span className="text-accent">Negotiate</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Purpose-built for the complexities of cross-border contract negotiation.
          </p>
        </div>

        <div className="space-y-8 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={feature.id}
              className="paper-card group hover:border-accent/50 transition-all duration-300"
            >
              <div className={`flex flex-col md:flex-row gap-6 md:gap-10 ${index % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                {/* Icon + Title block */}
                <div className="md:w-2/5 flex flex-col">
                  <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-4">
                    <feature.icon className="w-7 h-7 text-accent" />
                  </div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium font-body mb-1">
                    {feature.title}
                  </span>
                  <h3 className="text-xl md:text-2xl font-heading mb-3">
                    {feature.headline}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed font-body">
                    {feature.description}
                  </p>
                </div>

                {/* Highlights */}
                <div className="md:w-3/5 flex items-center">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    {feature.highlights.map((h) => (
                      <div
                        key={h}
                        className="flex items-center gap-3 bg-secondary/50 rounded-xl px-4 py-3 border border-border/50"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                        <span className="text-sm font-body">{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
