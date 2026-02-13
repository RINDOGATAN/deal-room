import {
  Bot,
  Key,
  ArrowRightLeft,
  FileText,
  ShieldAlert,
  BookOpen,
  Send,
  CheckCircle,
  XCircle,
  Download,
} from "lucide-react";

export default function AgentApiPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">Agent Negotiation API</h1>
        <p className="text-lg text-muted-foreground">
          REST API for automated contract negotiation between AI agents.
          Companies pre-configure negotiation preferences (&ldquo;playbooks&rdquo;)
          with red lines, then deploy agents that negotiate contracts in seconds
          using the weighted compromise engine.
        </p>
        <div className="mt-4 p-3 border border-primary/30 bg-primary/5 rounded-xl text-sm">
          <strong className="text-primary">Base URL:</strong>{" "}
          <code className="text-foreground">
            https://dealroom.todo.law/api/v1/agent
          </code>
        </div>
      </div>

      {/* Authentication */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Authentication</h2>
        <p className="text-muted-foreground">
          All requests require a Bearer token with the{" "}
          <code className="text-primary">drk_</code> prefix. API keys are
          created by a Platform Admin. The raw key is shown once on creation and
          cannot be retrieved later.
        </p>

        <div className="p-4 border border-border bg-card font-mono text-sm rounded-2xl">
          <span className="text-muted-foreground">Authorization:</span>{" "}
          <span className="text-primary">Bearer drk_96eddb08b83dc09b...</span>
        </div>

        <h3 className="text-lg font-bold mt-6">Scopes</h3>
        <p className="text-muted-foreground text-sm">
          Each API key has scopes that control what it can access. A key missing
          a required scope receives <code>403 Forbidden</code>.
        </p>

        <div className="border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium">Scope</th>
                <th className="text-left p-3 font-medium">Grants access to</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["templates:read", "List and view contract templates"],
                ["playbook:read", "List and view own playbooks"],
                ["playbook:write", "Create, update, and delete playbooks"],
                ["negotiate", "Initiate and join negotiations"],
                [
                  "deals:read",
                  "List deals, view details, download documents",
                ],
              ].map(([scope, desc]) => (
                <tr key={scope} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <code className="text-primary text-xs">{scope}</code>
                  </td>
                  <td className="p-3 text-muted-foreground">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Negotiation Flow */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Negotiation Flow</h2>
        <p className="text-muted-foreground">
          The API follows a token-based invitation model. The initiator creates a
          deal and sends a token out-of-band; the respondent joins with their
          playbook; the server resolves everything automatically.
        </p>

        <div className="space-y-3">
          {[
            {
              step: 1,
              icon: BookOpen,
              title: "Create Playbooks",
              desc: "Both companies create playbooks defining their preferences, priorities, flexibility, and red lines for each clause.",
              endpoint: "POST /playbooks",
            },
            {
              step: 2,
              icon: Send,
              title: "Initiate Negotiation",
              desc: "The initiator starts a deal with their playbook and receives a negotiation token.",
              endpoint: "POST /negotiate",
            },
            {
              step: 3,
              icon: ArrowRightLeft,
              title: "Send Token Out-of-Band",
              desc: "The initiator sends the token to the counterparty via email, webhook, Slack, or any other channel.",
              endpoint: null,
            },
            {
              step: 4,
              icon: Bot,
              title: "Respondent Joins",
              desc: "The respondent's agent joins with the token and their playbook. The server resolves the deal synchronously.",
              endpoint: "POST /negotiate/join",
            },
            {
              step: 5,
              icon: CheckCircle,
              title: "Get Results",
              desc: "Both parties can retrieve the agreed clauses, satisfaction scores, and download the final contract as PDF or DOCX.",
              endpoint: "GET /deals/:id",
            },
          ].map(({ step, icon: Icon, title, desc, endpoint }) => (
            <div key={step} className="card-brutal p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-6 h-6 border border-muted-foreground rounded-full flex items-center justify-center text-xs font-bold">
                  {step}
                </div>
                <Icon className="w-4 h-4 text-primary" />
                <h3 className="font-bold">{title}</h3>
                {endpoint && (
                  <code className="ml-auto text-xs text-muted-foreground hidden sm:block">
                    {endpoint}
                  </code>
                )}
              </div>
              <p className="text-sm text-muted-foreground ml-9">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Endpoints Overview */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Endpoints</h2>
        <p className="text-muted-foreground">
          All endpoints are under{" "}
          <code className="text-primary">/api/v1/agent/</code>.
        </p>

        {/* Templates */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Templates
          </h3>
          <div className="border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium">Method</th>
                  <th className="text-left p-3 font-medium">Path</th>
                  <th className="text-left p-3 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3">
                    <code className="text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded">
                      GET
                    </code>
                  </td>
                  <td className="p-3 font-mono text-xs">/templates</td>
                  <td className="p-3 text-muted-foreground">
                    List available templates (filtered by entitlements)
                  </td>
                </tr>
                <tr>
                  <td className="p-3">
                    <code className="text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded">
                      GET
                    </code>
                  </td>
                  <td className="p-3 font-mono text-xs">
                    /templates/:contractType
                  </td>
                  <td className="p-3 text-muted-foreground">
                    Full detail with clauses and options
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Playbooks */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Playbooks
          </h3>
          <div className="border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium">Method</th>
                  <th className="text-left p-3 font-medium">Path</th>
                  <th className="text-left p-3 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["GET", "/playbooks", "List own playbooks"],
                  ["POST", "/playbooks", "Create playbook with entries"],
                  ["GET", "/playbooks/:id", "Get playbook detail"],
                  ["PUT", "/playbooks/:id", "Update playbook + entries"],
                  ["DELETE", "/playbooks/:id", "Delete playbook"],
                ].map(([method, path, purpose], i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-0"
                  >
                    <td className="p-3">
                      <code
                        className={`text-xs px-1.5 py-0.5 rounded border ${
                          method === "GET"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                            : method === "POST"
                              ? "bg-blue-500/10 text-blue-500 border-blue-500/30"
                              : method === "PUT"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                : "bg-red-500/10 text-red-500 border-red-500/30"
                        }`}
                      >
                        {method}
                      </code>
                    </td>
                    <td className="p-3 font-mono text-xs">{path}</td>
                    <td className="p-3 text-muted-foreground">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Negotiation */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" />
            Negotiation
          </h3>
          <div className="border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium">Method</th>
                  <th className="text-left p-3 font-medium">Path</th>
                  <th className="text-left p-3 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3">
                    <code className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/30 rounded">
                      POST
                    </code>
                  </td>
                  <td className="p-3 font-mono text-xs">/negotiate</td>
                  <td className="p-3 text-muted-foreground">
                    Initiate — returns <code>negotiationToken</code>
                  </td>
                </tr>
                <tr>
                  <td className="p-3">
                    <code className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/30 rounded">
                      POST
                    </code>
                  </td>
                  <td className="p-3 font-mono text-xs">/negotiate/join</td>
                  <td className="p-3 text-muted-foreground">
                    Join with token + playbook — resolves deal
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Deals */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            Deals
          </h3>
          <div className="border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium">Method</th>
                  <th className="text-left p-3 font-medium">Path</th>
                  <th className="text-left p-3 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["GET", "/deals", "List own agent deals"],
                  [
                    "GET",
                    "/deals/:id",
                    "Deal outcome: clauses, satisfaction, status",
                  ],
                  ["GET", "/deals/:id/document", "Download PDF"],
                  ["GET", "/deals/:id/document/docx", "Download DOCX"],
                ].map(([method, path, purpose], i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-0"
                  >
                    <td className="p-3">
                      <code className="text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 rounded">
                        {method}
                      </code>
                    </td>
                    <td className="p-3 font-mono text-xs">{path}</td>
                    <td className="p-3 text-muted-foreground">{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Playbook Configuration */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Playbook Configuration</h2>
        <p className="text-muted-foreground">
          A playbook captures your company&apos;s negotiation stance: preferred
          options, how important each clause is, how flexible you are, and which
          clauses are non-negotiable.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Key className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Priority (1–5)</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              How important this clause is to your organization.
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-4 text-primary font-bold">1</span>
                <span className="text-muted-foreground">Not important</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 text-primary font-bold">3</span>
                <span className="text-muted-foreground">Moderate</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 text-primary font-bold">5</span>
                <span className="text-muted-foreground">Critical</span>
              </div>
            </div>
          </div>

          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Flexibility (1–5)</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              How willing you are to accept a different option.
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-4 text-primary font-bold">1</span>
                <span className="text-muted-foreground">
                  Inflexible — strongly favors your choice
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 text-primary font-bold">3</span>
                <span className="text-muted-foreground">
                  Neutral — balanced compromise
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 text-primary font-bold">5</span>
                <span className="text-muted-foreground">
                  Very flexible — almost always yields
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Red Lines */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Red Lines</h2>
        <p className="text-muted-foreground">
          Mark a clause as a red line to make it non-negotiable. Use{" "}
          <code className="text-primary">acceptableOptions</code> to define
          which options your organization can live with.
        </p>

        <div className="p-5 border border-border bg-card font-mono text-sm rounded-2xl overflow-x-auto">
          <pre className="text-xs leading-relaxed">
            {`{
  "clauseId": "breach-notification",
  "preferredOptionId": "24h",
  "isRedLine": true,
  "acceptableOptions": ["24h", "48h"]
}`}
          </pre>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-emerald-500/30 bg-emerald-500/5 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <p className="font-medium text-emerald-500 text-sm">
                Overlap exists
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Both parties&apos; acceptable options have at least one in common.
              Compromise picks from the overlap.
            </p>
          </div>
          <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <p className="font-medium text-amber-500 text-sm">
                One-sided red line
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Only one party has a red line. The engine respects it and picks
              from their acceptable set.
            </p>
          </div>
          <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <p className="font-medium text-red-500 text-sm">
                Conflict — deal fails
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Both have red lines with no overlapping acceptable options. The
              deal fails immediately before any compromise runs.
            </p>
          </div>
        </div>
      </div>

      {/* Response Examples */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Response Examples</h2>

        {/* Success */}
        <div className="space-y-2">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Agreed Deal
          </h3>
          <p className="text-sm text-muted-foreground">
            When both playbooks are compatible, the server resolves all clauses
            and returns the agreement with per-clause satisfaction scores.
          </p>
          <div className="p-5 border border-border bg-card font-mono text-sm rounded-2xl overflow-x-auto">
            <pre className="text-xs leading-relaxed">
              {`{
  "status": "AGREED",
  "agentDealRoomId": "cmlkzopbt0015...",
  "dealRoomId": "cmlkzorvc0017...",
  "clauses": [
    {
      "clauseId": "data-retention",
      "clauseTitle": "Data Retention Period",
      "agreedOptionLabel": "30 Days",
      "satisfactionInitiator": 100,
      "satisfactionRespondent": 5
    }
  ],
  "overallSatisfaction": {
    "initiator": 82,
    "respondent": 47
  }
}`}
            </pre>
          </div>
        </div>

        {/* Failure */}
        <div className="space-y-2">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-500" />
            Failed Deal (Red Line Conflict)
          </h3>
          <p className="text-sm text-muted-foreground">
            When irreconcilable red lines are detected, the deal fails
            immediately with conflict details.
          </p>
          <div className="p-5 border border-border bg-card font-mono text-sm rounded-2xl overflow-x-auto">
            <pre className="text-xs leading-relaxed">
              {`{
  "status": "FAILED",
  "agentDealRoomId": "cmlkzq195004y...",
  "failureReason": "Irreconcilable red line conflicts on 1 clause(s)",
  "conflicts": [
    {
      "clauseId": "scope-processing",
      "reason": "Both parties have irreconcilable red lines. No common acceptable option exists."
    }
  ]
}`}
            </pre>
          </div>
        </div>
      </div>

      {/* Quick Start Example */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Quick Start</h2>
        <p className="text-muted-foreground">
          End-to-end example using curl. Replace API keys and IDs with your own.
        </p>

        <div className="space-y-3">
          <div className="p-4 border border-border rounded-xl">
            <p className="text-sm font-medium mb-2">
              1. Discover the template
            </p>
            <div className="p-3 bg-card border border-border rounded-lg font-mono overflow-x-auto">
              <code className="text-xs">
                curl /api/v1/agent/templates/DPA -H &quot;Authorization: Bearer
                drk_YOUR_KEY&quot;
              </code>
            </div>
          </div>

          <div className="p-4 border border-border rounded-xl">
            <p className="text-sm font-medium mb-2">2. Create a playbook</p>
            <div className="p-3 bg-card border border-border rounded-lg font-mono overflow-x-auto">
              <pre className="text-xs leading-relaxed">
                {`curl -X POST /api/v1/agent/playbooks \\
  -H "Authorization: Bearer drk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Standard DPA","contractType":"DPA",
       "governingLaw":"ENGLAND_WALES","entries":[...]}'`}
              </pre>
            </div>
          </div>

          <div className="p-4 border border-border rounded-xl">
            <p className="text-sm font-medium mb-2">
              3. Initiate negotiation
            </p>
            <div className="p-3 bg-card border border-border rounded-lg font-mono overflow-x-auto">
              <pre className="text-xs leading-relaxed">
                {`curl -X POST /api/v1/agent/negotiate \\
  -H "Authorization: Bearer drk_COMPANY_A_KEY" \\
  -d '{"playbookId":"PB_ID","dealName":"Acme DPA",
       "initiatorEmail":"legal@acme.com"}'`}
              </pre>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Returns a <code className="text-primary">negotiationToken</code>.
              Send it to the counterparty.
            </p>
          </div>

          <div className="p-4 border border-border rounded-xl">
            <p className="text-sm font-medium mb-2">4. Respondent joins</p>
            <div className="p-3 bg-card border border-border rounded-lg font-mono overflow-x-auto">
              <pre className="text-xs leading-relaxed">
                {`curl -X POST /api/v1/agent/negotiate/join \\
  -H "Authorization: Bearer drk_COMPANY_B_KEY" \\
  -d '{"negotiationToken":"nt_abc123...","playbookId":"PB_B_ID",
       "respondentEmail":"legal@widget.com"}'`}
              </pre>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Returns the resolved deal with status{" "}
              <code className="text-primary">AGREED</code> or{" "}
              <code className="text-primary">FAILED</code>.
            </p>
          </div>

          <div className="p-4 border border-border rounded-xl">
            <p className="text-sm font-medium mb-2">
              5. Download the contract
            </p>
            <div className="p-3 bg-card border border-border rounded-lg font-mono overflow-x-auto">
              <pre className="text-xs leading-relaxed">
                {`curl /api/v1/agent/deals/DEAL_ID/document \\
  -H "Authorization: Bearer drk_YOUR_KEY" \\
  -o contract.pdf`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Full Reference */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Full Reference</h2>
        <div className="p-5 border border-border bg-muted/30 rounded-2xl">
          <p className="text-sm text-muted-foreground">
            For complete request/response schemas, field-level documentation, and
            advanced playbook strategies, see the full API reference at:
          </p>
          <code className="block mt-3 text-xs bg-card p-3 border border-border rounded-xl">
            docs/agent-api.md
          </code>
          <p className="text-sm text-muted-foreground mt-3">
            The API is versioned via the URL path (
            <code className="text-primary">/v1/</code>). Breaking changes will
            be introduced under a new version prefix.
          </p>
        </div>
      </div>
    </div>
  );
}
