"use client";

import { Cloud, AlertTriangle, ArrowRight, X } from "lucide-react";

interface HostedModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HostedModal({ open, onClose }: HostedModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative bg-card border border-border rounded-2xl max-w-lg w-full p-8 animate-fade-in"
        style={{ boxShadow: "var(--shadow-hover)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-5">
          <Cloud className="w-6 h-6 text-accent" />
        </div>

        <h3 className="text-2xl font-heading mb-2">Dealroom on TODO.LAW</h3>
        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
          Free access to the full Dealroom platform, hosted on our managed infrastructure.
        </p>

        <div className="bg-secondary/50 border border-border rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <h4 className="text-sm font-heading text-warning">Important Considerations</h4>
          </div>
          <ul className="space-y-3 text-sm text-muted-foreground font-body">
            <li className="flex items-start gap-2">
              <span className="text-warning mt-1">&bull;</span>
              <span>
                <strong className="text-foreground">No SLA.</strong> The service is offered as-is without uptime guarantees.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-warning mt-1">&bull;</span>
              <span>
                <strong className="text-foreground">No independent certifications.</strong> Security certifications are limited to those obtained by our subprocessors.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-warning mt-1">&bull;</span>
              <span>
                <strong className="text-foreground">No regional storage options.</strong> Data is stored in Frankfurt (EU) via Neon.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-warning mt-1">&bull;</span>
              <span>
                <strong className="text-foreground">Avoid confidential contract terms.</strong> Use the platform for negotiation workflows and structure, but consider your own deployment for highly sensitive deal terms.
              </span>
            </li>
          </ul>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/sign-in"
            className="btn-primary text-sm flex-1 text-center"
          >
            Continue to Dealroom
            <ArrowRight className="w-4 h-4 ml-2 inline" />
          </a>
          <button
            onClick={onClose}
            className="btn-secondary text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
