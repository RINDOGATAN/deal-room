"use client";

import { useState } from "react";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";
import InterfacePreview from "@/components/landing/InterfacePreview";
import DeploymentPicker from "@/components/landing/DeploymentPicker";
import FeatureShowcase from "@/components/landing/FeatureShowcase";
import HostedModal from "@/components/landing/HostedModal";
import { FileText, ArrowRight } from "lucide-react";

export default function HomePage() {
  const [showHostedModal, setShowHostedModal] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />
      <main>
        {/* Hero */}
        <section className="relative pt-32 pb-8 overflow-hidden">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-card rounded-full border border-border shadow-sm">
                <FileText className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium font-body">
                  Transaction Management
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight mb-6 text-balance">
                Dealroom
              </h1>

              <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground leading-relaxed font-body mb-10">
                Stop emailing Word documents back and forth. Negotiate contracts directly on a secure platform that finds the best compromise for both parties.
              </p>

              <button
                onClick={() => setShowHostedModal(true)}
                className="btn-primary text-base px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
              >
                Launch on TODO.LAW
                <ArrowRight className="w-5 h-5 ml-2 inline" />
              </button>
              <p className="mt-4 text-sm text-muted-foreground font-body">
                Or{" "}
                <a href="#alt-deployment" className="text-accent hover:underline">
                  explore alternative deployment options
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Interface Preview */}
        <section className="pb-24 pt-4">
          <div className="container mx-auto px-6">
            <InterfacePreview />
          </div>
        </section>

        {/* Deployment Picker */}
        <div className="bg-secondary/30 border-y border-border scroll-mt-24">
          <DeploymentPicker />
        </div>

        {/* Feature Showcase */}
        <FeatureShowcase />

        {/* How It Works */}
        <section className="py-24 bg-secondary/30 border-y border-border" id="how-it-works">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <span className="section-label">Workflow</span>
              <h2 className="text-2xl md:text-4xl mb-6 mt-4">
                How It <span className="text-accent">Works</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Two-party async negotiation with AI-powered compromise suggestions.
              </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-6">
              {[
                {
                  step: "01",
                  title: "Understand and customize each clause",
                  description: "Your chosen contract type and selected jurisdiction will determine the initial template and available variables for each clause.",
                },
                {
                  step: "02",
                  title: "Set priorities",
                  description: "Mark each clause with a priority score (must-have vs. nice-to-have) and flexibility level.",
                },
                {
                  step: "03",
                  title: "Invite counterparty",
                  description: "Your negotiation partner joins the dealroom and sets their own priorities.",
                },
                {
                  step: "04",
                  title: "Get smart suggestions",
                  description: "Our algorithm analyzes both positions and suggests the optimal compromise for each clause.",
                },
                {
                  step: "05",
                  title: "Export and sign",
                  description: "The Dealroom generates a final version for all parties to sign. You may also invite an attorney to review it or help you along the way.",
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-6 paper-card">
                  <div className="text-3xl font-heading text-accent/30 flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-lg font-heading mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-body">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-2xl md:text-4xl mb-6">
              Ready to close your next <span className="text-accent">deal</span>?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto font-body">
              Start a new contract negotiation today. Free to use, open source, and deploy anywhere.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="/sign-in"
                className="btn-primary"
              >
                Try Dealroom Free
              </a>
              <a
                href="https://github.com/rindogatan"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                View Source Code
              </a>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
      <HostedModal open={showHostedModal} onClose={() => setShowHostedModal(false)} />
    </div>
  );
}
