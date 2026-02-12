import {
  Scale,
  ClipboardCheck,
  FileCheck,
  Send,
  UserCheck,
  CheckCircle,
  MessageSquare,
  CreditCard,
  ArrowRight,
} from "lucide-react";

export default function VettingPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">How Vetting Works</h1>
        <p className="text-lg text-muted-foreground">
          Attorney vetting lets lawyers review contract templates and pre-select
          recommended options before sharing with their clients. This ensures
          clients receive expert guidance built into the negotiation from the start.
        </p>
      </div>

      {/* What is Vetting */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">What is Attorney Vetting?</h2>
        <p className="text-muted-foreground">
          Lawyers registered on the platform can review any contract template,
          select their recommended option for each clause, and add explanatory
          notes. Once approved, they can send the vetted template to clients via a
          secure invitation link. The client then negotiates with their lawyer's
          recommendations pre-populated.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-brutal p-4">
            <p className="font-semibold mb-1">Expert Guidance</p>
            <p className="text-sm text-muted-foreground">
              Clients start with their lawyer's recommended positions for every
              clause.
            </p>
          </div>
          <div className="card-brutal p-4">
            <p className="font-semibold mb-1">Transparent Notes</p>
            <p className="text-sm text-muted-foreground">
              Lawyers can explain their reasoning for each recommendation inline.
            </p>
          </div>
          <div className="card-brutal p-4">
            <p className="font-semibold mb-1">Client Control</p>
            <p className="text-sm text-muted-foreground">
              Clients can override any recommendation — the final choice is always
              theirs.
            </p>
          </div>
        </div>
      </div>

      {/* The Vetting Process */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold">The Vetting Process</h2>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="p-6 border border-border rounded-2xl bg-card">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center border-2 border-muted-foreground rounded-full flex-shrink-0">
                <span className="font-bold">1</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Scale className="w-5 h-5" />
                  <h3 className="text-lg font-bold">Register as a Lawyer</h3>
                  <span className="text-xs px-2 py-1 bg-muted text-muted-foreground border border-border rounded-full">
                    One-time
                  </span>
                </div>
                <p className="text-muted-foreground">
                  Any user can register as a lawyer from their dashboard. This
                  unlocks the vetting workflow and the "My Vettings" section. No
                  admin approval is required.
                </p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-6 border border-border rounded-2xl bg-card">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center border-2 border-primary text-primary rounded-full flex-shrink-0">
                <span className="font-bold">2</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <ClipboardCheck className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold text-primary">
                    Vet a Contract Template
                  </h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Select a contract template to review. For each clause, the lawyer:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-muted/30 border border-border rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-primary" />
                      <p className="font-medium">Selects recommended option</p>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Chooses the best option for their client's interests
                    </p>
                  </div>
                  <div className="p-3 bg-muted/30 border border-border rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      <p className="font-medium">Adds explanatory notes</p>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Explains the reasoning behind each recommendation
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-6 border border-border rounded-2xl bg-card">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center border-2 border-muted-foreground rounded-full flex-shrink-0">
                <span className="font-bold">3</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <FileCheck className="w-5 h-5" />
                  <h3 className="text-lg font-bold">Approve the Template</h3>
                </div>
                <p className="text-muted-foreground">
                  Once every clause has a recommendation, the lawyer approves the
                  template. This locks in the recommendations and marks the vetting
                  as complete. All clauses must have a recommendation before
                  approval.
                </p>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-6 border border-border rounded-2xl bg-card">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 flex items-center justify-center border-2 border-muted-foreground rounded-full flex-shrink-0">
                <span className="font-bold">4</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Send className="w-5 h-5" />
                  <h3 className="text-lg font-bold">Send to Client</h3>
                </div>
                <p className="text-muted-foreground">
                  The lawyer enters the client's email, name, and company. An email
                  invitation is sent with a secure link. The client clicks the link
                  to accept and start their contract with the lawyer's
                  recommendations pre-loaded.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Client Experience */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Client Experience</h2>
        <p className="text-muted-foreground">
          When a client receives a vetted contract invitation, they see:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <UserCheck className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Pre-populated Recommendations</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Every clause comes with the lawyer's recommended option already
              selected. The client can review and accept these or choose
              differently.
            </p>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Lawyer's Notes</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Where the lawyer added notes, the client sees an inline explanation of
              why that option was recommended, helping them make informed decisions.
            </p>
          </div>
        </div>

        <div className="border border-primary/30 p-5 bg-primary/5 rounded-2xl">
          <div className="flex items-center gap-3 mb-3">
            <ArrowRight className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-primary">Full Override</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            The client always retains full control. They can change any
            recommendation, adjust priority and flexibility scores, and negotiate
            freely. The lawyer's vetting serves as a starting point, not a
            constraint.
          </p>
        </div>
      </div>

      {/* Subscription */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Subscription</h2>
        <p className="text-muted-foreground">
          The vetting workflow has a simple pricing model:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-border p-6 rounded-2xl">
            <h3 className="text-lg font-bold mb-2">Vetting & Approval</h3>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full font-medium">
                Free
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Lawyers can review templates, select recommendations, add notes, and
              approve vettings at no cost. Prepare as many vetted contracts as you
              like.
            </p>
          </div>

          <div className="border border-primary p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-primary mb-2">
              Sending to Clients
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-primary" />
              <span className="text-xs px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full font-medium">
                €9/month
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              A Vetted Contracts subscription is required to send invitations to
              clients. Includes:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>Up to 100 client invitations per month</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>Clients receive branded recommendations</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>Cancel anytime, no commitment</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
