"use client";

import { ArrowRight } from "lucide-react";

interface FlowStep {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface FlowDiagramProps {
  steps: FlowStep[];
  currentStep?: string;
  orientation?: "horizontal" | "vertical";
  showArrows?: boolean;
}

export function FlowDiagram({
  steps,
  currentStep,
  orientation = "horizontal",
  showArrows = true,
}: FlowDiagramProps) {
  const isHorizontal = orientation === "horizontal";

  return (
    <div
      className={`flex ${isHorizontal ? "flex-row items-center" : "flex-col"} gap-2`}
    >
      {steps.map((step, index) => {
        const isActive = currentStep === step.id;
        const isPast = currentStep
          ? steps.findIndex((s) => s.id === currentStep) > index
          : false;

        return (
          <div
            key={step.id}
            className={`flex ${isHorizontal ? "flex-row items-center" : "flex-col"}`}
          >
            {/* Step Box */}
            <div
              className={`
                flex flex-col items-center justify-center
                px-4 py-3 border-2 transition-colors min-w-[140px]
                ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : isPast
                    ? "border-primary/50 bg-primary/5 text-foreground"
                    : "border-border bg-card text-muted-foreground"
                }
              `}
            >
              {step.icon && <div className="mb-2">{step.icon}</div>}
              <span className="text-sm font-semibold text-center">{step.label}</span>
              {step.description && (
                <span className="text-xs text-center mt-1 opacity-80">
                  {step.description}
                </span>
              )}
            </div>

            {/* Arrow */}
            {showArrows && index < steps.length - 1 && (
              <div
                className={`flex items-center justify-center ${
                  isHorizontal ? "px-2" : "py-2 rotate-90"
                }`}
              >
                <ArrowRight
                  className={`w-5 h-5 ${
                    isPast ? "text-primary" : "text-muted-foreground"
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Compact version for inline use
export function FlowDiagramCompact({
  steps,
  currentStep,
}: {
  steps: FlowStep[];
  currentStep?: string;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((step, index) => {
        const isActive = currentStep === step.id;
        const isPast = currentStep
          ? steps.findIndex((s) => s.id === currentStep) > index
          : false;

        return (
          <div key={step.id} className="flex items-center">
            <span
              className={`
                px-2 py-1 text-xs font-mono border
                ${
                  isActive
                    ? "border-primary text-primary bg-primary/10"
                    : isPast
                    ? "border-primary/50 text-primary/80"
                    : "border-border text-muted-foreground"
                }
              `}
            >
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <ArrowRight
                className={`w-3 h-3 mx-1 ${
                  isPast ? "text-primary" : "text-muted-foreground/50"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
