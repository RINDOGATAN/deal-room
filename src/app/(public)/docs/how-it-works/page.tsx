import {
  FileText,
  Mail,
  Users,
  Cpu,
  MessageSquare,
  PenTool,
  ArrowRight,
} from "lucide-react";
import { FlowDiagram } from "../components/FlowDiagram";
import { WorkflowStep } from "../components/WorkflowStep";

const dealStatuses = [
  { id: "DRAFT", label: "Draft" },
  { id: "AWAITING_RESPONSE", label: "Awaiting Response" },
  { id: "NEGOTIATING", label: "Negotiating" },
  { id: "AGREED", label: "Agreed" },
  { id: "SIGNING", label: "Signing" },
  { id: "COMPLETED", label: "Completed" },
];

export default function HowItWorksPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">How It Works</h1>
        <p className="text-lg text-muted-foreground">
          Dealroom guides both parties through a structured negotiation process,
          from creating the deal to signing the final contract.
        </p>
      </div>

      {/* Deal Status Flow */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Deal Lifecycle</h2>
        <p className="text-muted-foreground">
          Every deal progresses through these six stages:
        </p>
        <div className="overflow-x-auto py-4">
          <FlowDiagram steps={dealStatuses} currentStep="NEGOTIATING" />
        </div>
      </div>

      {/* Detailed Steps */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold">The Negotiation Process</h2>

        <div className="space-y-4">
          <WorkflowStep
            number={1}
            title="Create a Deal"
            description="The initiator selects a contract type (skill) and jurisdiction, then names the deal. The system loads all relevant clauses with their available options."
            icon={<FileText className="w-5 h-5" />}
            actor="Initiator"
          >
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-3 bg-muted/30 border border-border">
                <p className="font-medium text-foreground">Contract Type</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Select from available skill packages
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border">
                <p className="font-medium text-foreground">Jurisdiction</p>
                <p className="text-muted-foreground text-xs mt-1">
                  California, England & Wales, or Spain
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border">
                <p className="font-medium text-foreground">Deal Name</p>
                <p className="text-muted-foreground text-xs mt-1">
                  A friendly name for reference
                </p>
              </div>
            </div>
          </WorkflowStep>

          <WorkflowStep
            number={2}
            title="Invite the Other Party"
            description="The initiator sends an email invitation to the respondent. The respondent receives a secure link to join the Dealroom."
            icon={<Mail className="w-5 h-5" />}
            actor="Initiator"
          >
            <div className="p-3 bg-muted/30 border border-border text-sm">
              <p className="text-muted-foreground">
                The invitation email includes a secure, time-limited token. When the
                respondent clicks the link, they can create an account or sign in,
                then they're automatically connected to the deal.
              </p>
            </div>
          </WorkflowStep>

          <WorkflowStep
            number={3}
            title="Both Parties Submit Preferences"
            description="Each party independently selects their preferred option for every clause, along with priority (how important) and flexibility (how willing to compromise) scores."
            icon={<Users className="w-5 h-5" />}
            actor="Both Parties"
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                For each clause, parties select:
              </p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="p-3 border border-border">
                  <p className="font-medium text-foreground">Option</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Choose from 2-5 pre-defined options per clause
                  </p>
                </div>
                <div className="p-3 border border-border">
                  <p className="font-medium text-foreground">Priority (1-5)</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    How important is this clause to you?
                  </p>
                </div>
                <div className="p-3 border border-border">
                  <p className="font-medium text-foreground">Flexibility (1-5)</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    How willing are you to compromise?
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Parties cannot see each other's selections until both have submitted.
              </p>
            </div>
          </WorkflowStep>

          <WorkflowStep
            number={4}
            title="Algorithm Suggests Compromises"
            description="Once both parties submit, the weighted compromise algorithm calculates a fair suggestion for each clause based on stake scores."
            icon={<Cpu className="w-5 h-5" />}
            actor="System"
          >
            <div className="p-4 border border-primary/30 bg-primary/5">
              <p className="text-sm font-medium text-primary mb-2">
                The Stake Formula
              </p>
              <code className="text-xs block p-2 bg-card border border-border text-muted-foreground">
                stake = (priority/5 × 0.4) + ((5-flexibility)/5 × 0.3) + (|bias| × 0.3)
              </code>
              <p className="text-xs text-muted-foreground mt-2">
                The party with higher stake gets preference. When stakes are similar,
                a middle-ground option is suggested.{" "}
                <a href="/docs/compromise" className="text-primary hover:underline">
                  Learn more about the algorithm →
                </a>
              </p>
            </div>
          </WorkflowStep>

          <WorkflowStep
            number={5}
            title="Accept or Counter"
            description="Both parties review the suggestions. They can accept individual clauses or propose counters. The process continues until all clauses are agreed."
            icon={<MessageSquare className="w-5 h-5" />}
            actor="Both Parties"
          >
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border border-primary/30">
                  <p className="font-medium text-primary">Accept</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Agree to the suggested option for this clause
                  </p>
                </div>
                <div className="p-3 border border-border">
                  <p className="font-medium text-foreground">Counter</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Propose a different option with reasoning
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                When one party counters, the other party sees the counter-proposal
                and can accept it or make their own counter.
              </p>
            </div>
          </WorkflowStep>

          <WorkflowStep
            number={6}
            title="Sign the Contract"
            description="Once all clauses are agreed, the system generates the final contract document. Both parties sign electronically to complete the deal."
            icon={<PenTool className="w-5 h-5" />}
            actor="Both Parties"
          >
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 p-3 border border-border">
                <div className="w-4 h-4 border border-muted-foreground" />
                <span className="text-muted-foreground">Party A Signature</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center gap-2 p-3 border border-border">
                <div className="w-4 h-4 border border-muted-foreground" />
                <span className="text-muted-foreground">Party B Signature</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="flex items-center gap-2 p-3 border border-primary text-primary">
                <div className="w-4 h-4 bg-primary" />
                <span className="font-medium">Complete</span>
              </div>
            </div>
          </WorkflowStep>
        </div>
      </div>

      {/* Key Concepts */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Key Concepts</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="p-5 border border-border">
            <h3 className="font-bold mb-2">Asynchronous Negotiation</h3>
            <p className="text-sm text-muted-foreground">
              Unlike traditional negotiation, parties don't need to be online
              simultaneously. Each party works at their own pace, and the system
              notifies them when action is needed.
            </p>
          </div>
          <div className="p-5 border border-border">
            <h3 className="font-bold mb-2">Blind Submission</h3>
            <p className="text-sm text-muted-foreground">
              Initial selections are hidden until both parties submit. This
              prevents anchoring bias and encourages honest preference disclosure.
            </p>
          </div>
          <div className="p-5 border border-border">
            <h3 className="font-bold mb-2">Weighted Compromise</h3>
            <p className="text-sm text-muted-foreground">
              The algorithm considers not just what each party wants, but how much
              they care (priority) and how flexible they are. This produces fairer
              outcomes.
            </p>
          </div>
          <div className="p-5 border border-border">
            <h3 className="font-bold mb-2">Jurisdiction-Aware</h3>
            <p className="text-sm text-muted-foreground">
              Options are filtered and flagged based on the selected governing law.
              Some options may be unavailable or come with warnings in certain
              jurisdictions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
