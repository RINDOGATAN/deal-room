import {
  Package,
  FileCode,
  Layers,
  Scale,
  Globe,
  Lock,
  Unlock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

export default function SkillsPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">Skills & Licensing</h1>
        <p className="text-lg text-muted-foreground">
          Skills are attorney-created contract templates that power Dealroom
          negotiations. Each skill contains structured clauses with multiple options
          tailored to different party interests.
        </p>
      </div>

      {/* What is a Skill */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">What is a Skill?</h2>
        <p className="text-muted-foreground">
          A skill is a packaged contract template created by legal professionals. It
          defines:
        </p>
        <div className="grid grid-cols-2 gap-6">
          <div className="p-5 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <FileCode className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Contract Structure</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              The overall template with static sections and negotiable clauses
            </p>
          </div>
          <div className="p-5 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Layers className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Clause Templates</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Individual negotiation points with 2-5 options each
            </p>
          </div>
          <div className="p-5 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Scale className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Bias Scores</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              How each option favors Party A vs Party B (-1 to +1)
            </p>
          </div>
          <div className="p-5 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Globe className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Jurisdiction Rules</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Which options are available under different governing laws
            </p>
          </div>
        </div>
      </div>

      {/* Skill Package Structure */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Skill Package Structure</h2>
        <p className="text-muted-foreground">
          Each skill is distributed as a ZIP archive containing:
        </p>
        <div className="p-5 border border-border bg-card font-mono text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">skill-package.zip/</p>
            <p className="pl-4">
              <span className="text-primary">manifest.json</span>
              <span className="text-muted-foreground ml-4">
                # Metadata, version, licensing
              </span>
            </p>
            <p className="pl-4">
              <span className="text-foreground">contract-template.json</span>
              <span className="text-muted-foreground ml-4">
                # Main contract structure
              </span>
            </p>
            <p className="pl-4">
              <span className="text-foreground">clauses/</span>
              <span className="text-muted-foreground ml-4">
                # Clause template files
              </span>
            </p>
            <p className="pl-8 text-muted-foreground">payment-terms.json</p>
            <p className="pl-8 text-muted-foreground">liability.json</p>
            <p className="pl-8 text-muted-foreground">termination.json</p>
            <p className="pl-4">
              <span className="text-foreground">i18n/</span>
              <span className="text-muted-foreground ml-4">
                # Translations
              </span>
            </p>
            <p className="pl-8 text-muted-foreground">en.json</p>
            <p className="pl-8 text-muted-foreground">es.json</p>
          </div>
        </div>
      </div>

      {/* Clause Structure */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Clause Structure</h2>
        <p className="text-muted-foreground">
          Each clause contains multiple options that parties can choose from:
        </p>

        {/* Example Clause */}
        <div className="border-2 border-border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs px-2 py-1 bg-muted text-muted-foreground border border-border">
                Payment Terms
              </span>
              <h3 className="font-bold text-lg mt-2">Payment Schedule</h3>
            </div>
            <span className="text-xs text-muted-foreground">3 options</span>
          </div>

          <p className="text-sm text-muted-foreground">
            When and how payment should be made between the parties.
          </p>

          {/* Options */}
          <div className="space-y-3">
            <div className="p-4 border border-blue-400/30 bg-blue-400/5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Option A: Net 15</span>
                <span className="text-xs px-2 py-0.5 bg-blue-400/20 text-blue-400 border border-blue-400/30">
                  Favors Party A
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Payment due within 15 days of invoice
              </p>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-primary font-medium mb-1">+ Pros for A</p>
                  <ul className="text-muted-foreground space-y-0.5">
                    <li>Faster cash flow</li>
                    <li>Reduced payment risk</li>
                  </ul>
                </div>
                <div>
                  <p className="text-amber-400 font-medium mb-1">- Cons for A</p>
                  <ul className="text-muted-foreground space-y-0.5">
                    <li>May limit buyer pool</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Option B: Net 30</span>
                <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground border border-border">
                  Balanced
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Payment due within 30 days of invoice (industry standard)
              </p>
            </div>

            <div className="p-4 border border-orange-400/30 bg-orange-400/5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Option C: Net 60</span>
                <span className="text-xs px-2 py-0.5 bg-orange-400/20 text-orange-400 border border-orange-400/30">
                  Favors Party B
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Payment due within 60 days of invoice
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Taster vs Premium */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Taster vs Premium Skills</h2>
        <p className="text-muted-foreground">
          Skills come in two licensing tiers:
        </p>

        <div className="grid grid-cols-2 gap-6">
          <div className="border-2 border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <Unlock className="w-6 h-6 text-muted-foreground" />
              <h3 className="text-lg font-bold">Taster Mode</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Free preview with limited functionality
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>View all clauses and options</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>Practice negotiations</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                <span>No final document generation</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                <span>Watermarked exports</span>
              </li>
            </ul>
          </div>

          <div className="border-2 border-primary p-6">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-primary" />
              <h3 className="text-lg font-bold text-primary">Premium Mode</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Full functionality with license activation
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>All taster features</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>Generate final contracts</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>E-signature integration</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>Full legal text export</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Multilingual Support */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Multilingual Support</h2>
        <p className="text-muted-foreground">
          Skills support cross-language negotiation. Each party can view and
          negotiate in their preferred language while the underlying options remain
          synchronized.
        </p>

        <div className="p-5 border border-border">
          <div className="flex items-center gap-6">
            <div className="flex-1 p-4 border border-blue-400/30 bg-blue-400/5">
              <p className="text-xs text-blue-400 mb-1">Party A (English)</p>
              <p className="font-medium">Net 30 Payment</p>
              <p className="text-sm text-muted-foreground">
                Payment due within 30 days
              </p>
            </div>
            <div className="text-muted-foreground">=</div>
            <div className="flex-1 p-4 border border-orange-400/30 bg-orange-400/5">
              <p className="text-xs text-orange-400 mb-1">Party B (Spanish)</p>
              <p className="font-medium">Pago a 30 Dias</p>
              <p className="text-sm text-muted-foreground">
                Pago dentro de 30 dias
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Same option, different languages — synchronized throughout negotiation
          </p>
        </div>
      </div>

      {/* Licensing */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">License Activation</h2>
        <p className="text-muted-foreground">
          Premium skills require license activation. The process:
        </p>

        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 border border-border text-center">
            <div className="w-8 h-8 mx-auto mb-2 border border-muted-foreground flex items-center justify-center text-sm font-bold">
              1
            </div>
            <p className="text-sm font-medium">Generate Fingerprint</p>
            <p className="text-xs text-muted-foreground mt-1">
              Machine-specific ID
            </p>
          </div>
          <div className="p-4 border border-border text-center">
            <div className="w-8 h-8 mx-auto mb-2 border border-muted-foreground flex items-center justify-center text-sm font-bold">
              2
            </div>
            <p className="text-sm font-medium">Request License</p>
            <p className="text-xs text-muted-foreground mt-1">
              From skill author
            </p>
          </div>
          <div className="p-4 border border-border text-center">
            <div className="w-8 h-8 mx-auto mb-2 border border-muted-foreground flex items-center justify-center text-sm font-bold">
              3
            </div>
            <p className="text-sm font-medium">Install Key</p>
            <p className="text-xs text-muted-foreground mt-1">
              Activate premium
            </p>
          </div>
          <div className="p-4 border border-primary text-center">
            <div className="w-8 h-8 mx-auto mb-2 border border-primary bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
              4
            </div>
            <p className="text-sm font-medium text-primary">Full Access</p>
            <p className="text-xs text-muted-foreground mt-1">
              All features unlocked
            </p>
          </div>
        </div>

        <div className="p-4 bg-muted/30 border border-border text-sm">
          <p className="text-muted-foreground">
            <strong className="text-foreground">CLI commands:</strong>
          </p>
          <code className="block mt-2 text-xs">
            npm run license:fingerprint # Get machine ID
            <br />
            npm run skill:list # View installed skills
          </code>
        </div>
      </div>
    </div>
  );
}
