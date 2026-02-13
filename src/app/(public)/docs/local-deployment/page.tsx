import {
  Store,
  Download,
  Terminal,
  KeyRound,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  Globe,
  CreditCard,
  HardDrive,
  Package,
  Fingerprint,
  ChevronRight,
} from "lucide-react";

export default function LocalDeploymentPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">Local Deployment</h1>
        <p className="text-lg text-muted-foreground">
          Run Dealroom on your own infrastructure with full control over your
          data. Browse the Skills Marketplace, download signed skill packages,
          and install them locally via CLI.
        </p>
      </div>

      {/* Overview Flow — visual pipeline */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">How It Works</h2>
        <p className="text-muted-foreground">
          Self-hosted deployments follow a simple flow to acquire and activate
          premium skills:
        </p>

        {/* Horizontal flow (desktop) / vertical (mobile) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { icon: Store, label: "Browse", sub: "Marketplace" },
            { icon: CreditCard, label: "Purchase", sub: "Stripe checkout" },
            { icon: Download, label: "Download", sub: ".skill package" },
            { icon: Terminal, label: "Install", sub: "CLI command" },
            { icon: ShieldCheck, label: "Activate", sub: "License key" },
          ].map((step, i) => (
            <div key={i} className="relative">
              <div className="p-4 border border-border rounded-xl text-center h-full">
                <div
                  className={`w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center ${
                    i === 4
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border border-muted-foreground"
                  }`}
                >
                  <step.icon className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium">{step.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step.sub}
                </p>
              </div>
              {/* Arrow connector (hidden on last item and mobile) */}
              {i < 4 && (
                <ChevronRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Browse the Marketplace */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-muted-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            1
          </div>
          <h2 className="text-xl font-bold">Browse the Skills Marketplace</h2>
        </div>
        <p className="text-muted-foreground">
          The Skills Marketplace lists all available contract templates. Each
          skill shows its supported jurisdictions, languages, and clause count.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Globe className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Jurisdiction Filters</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Filter by governing law — California, England & Wales, or Spain —
              to see skills tailored to your jurisdiction.
            </p>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Package className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Skill Cards</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Each card displays the skill name, description, clause count, and
              your current entitlement status (Active, Free, or price).
            </p>
          </div>
        </div>

        <div className="p-4 bg-muted/30 border border-border rounded-xl text-sm">
          <p className="text-muted-foreground">
            <strong className="text-foreground">Navigate to:</strong>
          </p>
          <code className="block mt-2 text-xs">
            https://your-instance.example.com/marketplace
          </code>
        </div>
      </div>

      {/* Step 2: Purchase a Skill */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-muted-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            2
          </div>
          <h2 className="text-xl font-bold">Purchase a Skill</h2>
        </div>
        <p className="text-muted-foreground">
          Click &ldquo;Enable&rdquo; on any premium skill to start a Stripe
          checkout. Once payment completes, an entitlement is created
          automatically.
        </p>

        {/* Purchase flow */}
        <div className="border border-border p-6 rounded-2xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-border rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Secure Checkout</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Stripe-powered payment. Your card is never stored on our
                servers.
              </p>
            </div>
            <div className="p-4 border border-border rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  Instant Entitlement
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Webhook confirms payment and grants access to the skill within
                seconds.
              </p>
            </div>
            <div className="p-4 border border-border rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Download className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Download Ready</span>
              </div>
              <p className="text-xs text-muted-foreground">
                After purchase you&apos;ll receive a download link by email and
                on your billing page.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: Download the Package */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-muted-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            3
          </div>
          <h2 className="text-xl font-bold">Download the Skill Package</h2>
        </div>
        <p className="text-muted-foreground">
          Download the <code className="text-xs px-1.5 py-0.5 bg-muted rounded">.skill</code> file
          from your billing page or the link in your confirmation email. Each
          package is a signed ZIP archive.
        </p>

        {/* Package structure */}
        <div className="p-5 border border-border bg-card font-mono text-sm rounded-2xl">
          <p className="text-muted-foreground mb-2">
            founders-agreement-1.0.0.skill (ZIP archive)
          </p>
          <div className="space-y-1 pl-2 border-l-2 border-border ml-2">
            <p>
              <span className="text-primary">manifest.json</span>
              <span className="text-muted-foreground ml-4">
                # Skill ID, version, hashes
              </span>
            </p>
            <p>
              <span className="text-foreground">content/clauses.json</span>
              <span className="text-muted-foreground ml-4">
                # Negotiation clauses & options
              </span>
            </p>
            <p>
              <span className="text-foreground">content/boilerplate.json</span>
              <span className="text-muted-foreground ml-4">
                # Static contract text
              </span>
            </p>
            <p>
              <span className="text-amber-400">signature.sig</span>
              <span className="text-muted-foreground ml-4">
                # Ed25519 digital signature
              </span>
            </p>
          </div>
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Tamper-proof Packages</p>
            <p className="text-muted-foreground mt-1">
              Every <code className="text-xs px-1 py-0.5 bg-muted rounded">.skill</code> file
              is signed with an Ed25519 key. The installer verifies the
              signature and file hashes before installing — any modification to
              the package will be detected and rejected.
            </p>
          </div>
        </div>
      </div>

      {/* Step 4: Install via CLI */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-muted-foreground rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
            4
          </div>
          <h2 className="text-xl font-bold">Install via CLI</h2>
        </div>
        <p className="text-muted-foreground">
          Use the Dealroom CLI to verify and install the downloaded package into
          your local database.
        </p>

        {/* CLI commands */}
        <div className="space-y-4">
          <div className="p-5 border border-border bg-card rounded-2xl">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">
              Verify package integrity
            </p>
            <code className="block font-mono text-sm">
              <span className="text-primary">npx</span> deal-room skill:verify
              ./founders-agreement-1.0.0.skill
            </code>
            <div className="mt-3 p-3 bg-muted/30 rounded-xl font-mono text-xs text-muted-foreground">
              <p>
                <span className="text-primary">&#10003;</span> Manifest valid
              </p>
              <p>
                <span className="text-primary">&#10003;</span> File integrity
                verified (3 files)
              </p>
              <p>
                <span className="text-primary">&#10003;</span> Ed25519 signature
                valid
              </p>
              <p>
                <span className="text-primary">&#10003;</span> Content schema
                valid (12 clauses, 36 options)
              </p>
            </div>
          </div>

          <div className="p-5 border border-border bg-card rounded-2xl">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">
              Install to database
            </p>
            <code className="block font-mono text-sm">
              <span className="text-primary">npx</span> deal-room skill:install
              ./founders-agreement-1.0.0.skill
            </code>
            <div className="mt-3 p-3 bg-muted/30 rounded-xl font-mono text-xs text-muted-foreground">
              <p>Installing: com.nel.skills.founders v1.0.0</p>
              <p>
                <span className="text-primary">&#10003;</span> Package verified
              </p>
              <p>
                <span className="text-primary">&#10003;</span> Contract template
                created
              </p>
              <p>
                <span className="text-primary">&#10003;</span> 12 clause
                templates installed
              </p>
              <p>
                <span className="text-primary">&#10003;</span> Skill ready for
                use
              </p>
            </div>
          </div>

          <div className="p-5 border border-border bg-card rounded-2xl">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">
              List installed skills
            </p>
            <code className="block font-mono text-sm">
              <span className="text-primary">npx</span> deal-room skill:list
            </code>
          </div>
        </div>
      </div>

      {/* Step 5: License Activation */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-primary bg-primary rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground flex-shrink-0">
            5
          </div>
          <h2 className="text-xl font-bold">Activate Your License</h2>
        </div>
        <p className="text-muted-foreground">
          Premium skills require license activation tied to your machine. This
          prevents unauthorized redistribution while giving you full offline
          access.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Fingerprint className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Machine Fingerprint</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              A unique identifier derived from your hardware. This fingerprint
              is sent to the licensing server when you activate.
            </p>
            <div className="p-3 bg-muted/30 rounded-xl">
              <code className="text-xs font-mono">
                <span className="text-primary">npx</span> deal-room
                license:fingerprint
              </code>
            </div>
          </div>

          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <KeyRound className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Activate License</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Use the license key from your purchase confirmation to activate
              premium features on this machine.
            </p>
            <div className="p-3 bg-muted/30 rounded-xl">
              <code className="text-xs font-mono">
                <span className="text-primary">npx</span> deal-room
                skill:activate --key YOUR_LICENSE_KEY
              </code>
            </div>
          </div>
        </div>

        {/* Activation status indicators */}
        <div className="border border-border p-5 rounded-2xl">
          <p className="text-sm font-medium mb-3">License States</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="font-medium w-20">Active</span>
              <span className="text-muted-foreground">
                Full access to all skill features including document generation
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="font-medium w-20">Taster</span>
              <span className="text-muted-foreground">
                Preview mode — negotiate but no final document export
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-destructive" />
              <span className="font-medium w-20">Expired</span>
              <span className="text-muted-foreground">
                Subscription lapsed — renew to restore access
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CLI Reference */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">CLI Quick Reference</h2>
        <p className="text-muted-foreground">
          All skill management commands available in the Dealroom CLI:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-2xl overflow-hidden">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-3 font-medium">Command</th>
                <th className="text-left p-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="p-3 font-mono text-xs text-primary whitespace-nowrap">
                  skill:list
                </td>
                <td className="p-3 text-muted-foreground">
                  List all installed skills and their status
                </td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs text-primary whitespace-nowrap">
                  skill:verify &lt;file&gt;
                </td>
                <td className="p-3 text-muted-foreground">
                  Verify a .skill package signature and integrity
                </td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs text-primary whitespace-nowrap">
                  skill:install &lt;file&gt;
                </td>
                <td className="p-3 text-muted-foreground">
                  Install a .skill package to the local database
                </td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs text-primary whitespace-nowrap">
                  skill:activate --key &lt;key&gt;
                </td>
                <td className="p-3 text-muted-foreground">
                  Activate a premium license on this machine
                </td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs text-primary whitespace-nowrap">
                  license:fingerprint
                </td>
                <td className="p-3 text-muted-foreground">
                  Display this machine&apos;s unique fingerprint
                </td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs text-primary whitespace-nowrap">
                  license:status
                </td>
                <td className="p-3 text-muted-foreground">
                  Check license status for all installed skills
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Troubleshooting</h2>

        <div className="space-y-3">
          <div className="border border-border p-4 rounded-xl">
            <p className="font-medium text-sm mb-1">
              &ldquo;Invalid signature&rdquo; during install
            </p>
            <p className="text-sm text-muted-foreground">
              The .skill file may have been corrupted during download. Re-download
              from the billing page and try again. If the error persists, check
              that your Dealroom version matches the package&apos;s requirements.
            </p>
          </div>

          <div className="border border-border p-4 rounded-xl">
            <p className="font-medium text-sm mb-1">
              &ldquo;Entitlement not found&rdquo; on download
            </p>
            <p className="text-sm text-muted-foreground">
              Ensure you are logged in with the same account used for purchase.
              Download links from email expire after 7 days — use the billing
              page for a fresh link.
            </p>
          </div>

          <div className="border border-border p-4 rounded-xl">
            <p className="font-medium text-sm mb-1">
              &ldquo;Activation limit reached&rdquo;
            </p>
            <p className="text-sm text-muted-foreground">
              Each license allows a limited number of machine activations.
              Deactivate unused machines from your billing page, or contact
              support to increase your activation limit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
