import { Check } from "lucide-react";

interface WorkflowStepProps {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  status?: "completed" | "active" | "pending";
  actor?: string;
  children?: React.ReactNode;
}

export function WorkflowStep({
  number,
  title,
  description,
  icon,
  status = "pending",
  actor,
  children,
}: WorkflowStepProps) {
  return (
    <div
      className={`
        p-6 border-2 transition-colors
        ${
          status === "active"
            ? "border-primary bg-primary/5"
            : status === "completed"
            ? "border-primary/50 bg-card"
            : "border-border bg-card"
        }
      `}
    >
      <div className="flex items-start gap-4">
        {/* Step Number */}
        <div
          className={`
            w-10 h-10 flex items-center justify-center border-2 flex-shrink-0
            ${
              status === "completed"
                ? "border-primary bg-primary text-primary-foreground"
                : status === "active"
                ? "border-primary text-primary"
                : "border-muted-foreground text-muted-foreground"
            }
          `}
        >
          {status === "completed" ? (
            <Check className="w-5 h-5" />
          ) : (
            <span className="font-bold">{number}</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`${
                status === "active" ? "text-primary" : "text-foreground"
              }`}
            >
              {icon}
            </span>
            <h3
              className={`text-lg font-bold ${
                status === "active" ? "text-primary" : "text-foreground"
              }`}
            >
              {title}
            </h3>
            {actor && (
              <span className="text-xs px-2 py-1 bg-muted text-muted-foreground border border-border">
                {actor}
              </span>
            )}
          </div>
          <p className="text-muted-foreground">{description}</p>
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </div>
  );
}

// Horizontal timeline variant
export function WorkflowTimeline({
  steps,
}: {
  steps: Array<{
    number: number;
    title: string;
    description: string;
    status?: "completed" | "active" | "pending";
  }>;
}) {
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute top-5 left-5 right-5 h-0.5 bg-border" />

      <div className="relative flex justify-between">
        {steps.map((step) => (
          <div key={step.number} className="flex flex-col items-center w-32">
            {/* Circle */}
            <div
              className={`
                w-10 h-10 flex items-center justify-center border-2 bg-background z-10
                ${
                  step.status === "completed"
                    ? "border-primary bg-primary text-primary-foreground"
                    : step.status === "active"
                    ? "border-primary text-primary"
                    : "border-muted-foreground text-muted-foreground"
                }
              `}
            >
              {step.status === "completed" ? (
                <Check className="w-5 h-5" />
              ) : (
                <span className="font-bold text-sm">{step.number}</span>
              )}
            </div>

            {/* Label */}
            <div className="mt-3 text-center">
              <p
                className={`text-sm font-semibold ${
                  step.status === "active" ? "text-primary" : "text-foreground"
                }`}
              >
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
