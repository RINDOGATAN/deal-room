"use client";

import { Server, Cpu, Check, ArrowRight } from "lucide-react";

export default function DeploymentPicker() {
  return (
    <section className="py-24" id="alt-deployment">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <span className="section-label">Self-Hosted Options</span>
          <h2 className="text-2xl md:text-4xl mb-6 mt-4">
            Alternative <span className="text-accent">Deployment</span> Options
          </h2>
          <p className="text-lg text-muted-foreground">
            Need full control or air-gapped security? Deploy Dealroom on your own terms.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Option 1: Your Cloud */}
          <a
            href="https://github.com/rindogatan"
            target="_blank"
            rel="noopener noreferrer"
            className="paper-card group hover:border-accent/50 transition-all duration-300"
          >
            <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-6">
              <Server className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-xl font-heading mb-3">Your Cloud</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Full control over every layer of the stack. Your choice of AI models, security guarantees, and backups.
            </p>
            <ul className="space-y-2 mb-6">
              {[
                "AGPL-3 open source",
                "Your regional IaaS/PaaS",
                "Custom AI model selection",
                "Your SLA & certifications",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-accent" />
                  </div>
                  {f}
                </li>
              ))}
            </ul>
            <div className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
              View on GitHub <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          {/* Option 2: Portable Hardware */}
          <a
            href="https://todo.law/hardware"
            target="_blank"
            rel="noopener noreferrer"
            className="paper-card group hover:border-accent/50 transition-all duration-300"
          >
            <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-6">
              <Cpu className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-xl font-heading mb-3">Portable Hardware</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Maximum security and confidentiality. Run multiple client portals entirely offline with open-weight AI.
            </p>
            <ul className="space-y-2 mb-6">
              {[
                "Full air-gap capability",
                "Open models (OLMo 3, Qwen 2.5)",
                "Multiple offline instances",
                "NVIDIA DGX Spark ready",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-accent" />
                  </div>
                  {f}
                </li>
              ))}
            </ul>
            <div className="inline-flex items-center gap-2 text-sm text-accent hover:underline">
              Learn more <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
