"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState } from "react";
import {
  Cloud,
  ShieldCheck,
  Brain,
  BarChart3,
  Puzzle,
  Store,
  AlertTriangle,
  CheckCircle,
  Code,
  Database,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const SERVICE_LAYERS = [
  {
    name: "Certification",
    icon: ShieldCheck,
    persona: "Legal Ops",
    depth: "High",
    depthColor: "text-red-500",
    description: "RFC 3161 timestamps, audit certificates, ceremony IDs",
  },
  {
    name: "Intelligence",
    icon: Brain,
    persona: "Negotiators",
    depth: "Medium",
    depthColor: "text-amber-500",
    description: "Dynamic biases, quality scoring, conflict detection",
  },
  {
    name: "Analytics",
    icon: BarChart3,
    persona: "Managers",
    depth: "Medium",
    depthColor: "text-amber-500",
    description: "Benchmarks, clause popularity, deal activity",
  },
  {
    name: "Clausemaster",
    icon: Puzzle,
    persona: "Authors",
    depth: "High",
    depthColor: "text-red-500",
    description: "Phase 2 — clause authoring platform",
  },
  {
    name: "Integrations",
    icon: Store,
    persona: "Enterprise",
    depth: "Low",
    depthColor: "text-green-500",
    description: "Phase 3 — CRM and DMS connectors",
  },
];

const DEGRADATION_ROWS = [
  {
    feature: "Signing Ceremony",
    withCloud: "RFC 3161 timestamps, ceremony ID, audit certificate URL",
    without: "Standard signing — no certification badge, no audit trail",
    insertionPoint: "signing.ts → initiate / recordSignature",
  },
  {
    feature: "Compromise Biases",
    withCloud: "Data-driven bias weights per contract type + jurisdiction",
    without: "Static JSON biases from skill clause definitions",
    insertionPoint: "compromise.ts → generate",
  },
  {
    feature: "Quality Badges",
    withCloud: "Scored quality labels (Excellent, Good, Fair) per option",
    without: "All options show \"Unverified\" badge",
    insertionPoint: "negotiate/page.tsx",
  },
  {
    feature: "Conflict Warnings",
    withCloud: "Cross-clause contradiction detection with severity levels",
    without: "No conflict warnings shown in review",
    insertionPoint: "review/page.tsx",
  },
  {
    feature: "Satisfaction Prediction",
    withCloud: "Pre-submit predicted satisfaction % for both parties",
    without: "No prediction shown (zero confidence)",
    insertionPoint: "compromise.ts → predictSatisfaction",
  },
  {
    feature: "Analytics Dashboard",
    withCloud: "Full benchmarks, clause popularity, deal activity charts",
    without: "Blurred teaser data with upgrade CTA",
    insertionPoint: "AnalyticsPanel component",
  },
  {
    feature: "Certification Badge",
    withCloud: "Green certified badge on deal detail + sign pages",
    without: "No badge shown",
    insertionPoint: "deals/[id]/page.tsx + sign/page.tsx",
  },
];

const INTEGRATION_POINTS = [
  {
    title: "1. Document Certification — Signing",
    file: "src/server/routers/signing.ts",
    mutations: ["initiate", "recordSignature"],
    cloudMethod: "cloudApi.certifyDocument() + cloudApi.recordSignature()",
    fallback:
      "Standard signing flow proceeds. ceremonyId and documentHash remain empty strings. No audit certificate generated.",
    details:
      "On initiate: hashes final document, calls certifyDocument() to register ceremony. Stores ceremonyId + documentHash on SigningRequest. On each signature: calls recordSignature() with ceremony context. Falls back to uncertified SignatureRecord.",
  },
  {
    title: "2. Dynamic Bias Weights — Compromise",
    file: "src/server/routers/compromise.ts",
    mutations: ["generate"],
    cloudMethod: "cloudApi.getDynamicBiases()",
    fallback:
      "Empty overrides returned — compromise engine uses static biases defined in skill clause JSON files.",
    details:
      "Called at the start of compromise generation. Cloud API returns per-clause bias overrides keyed by clauseTemplateId → optionId. Merged on top of static biases before stake calculation.",
  },
  {
    title: "3. Satisfaction Prediction — Compromise",
    file: "src/server/routers/compromise.ts",
    mutations: ["predictSatisfaction"],
    cloudMethod: "cloudApi.predictSatisfaction()",
    fallback:
      "Returns { predictedSatisfactionA: 0, predictedSatisfactionB: 0, confidence: 0, predicted: false }. UI hides prediction when predicted === false.",
    details:
      "Called before final compromise submission. Sends all clause selections with priorities to cloud API for ML-based satisfaction prediction. confidence range 0-1.",
  },
  {
    title: "4. Quality Badges — Negotiate UI",
    file: "src/app/(dashboard)/deals/[id]/negotiate/page.tsx",
    mutations: ["(client-side display)"],
    cloudMethod: "cloudApi.scoreClauseQuality()",
    fallback:
      "All options display \"Unverified\" label with null score. Badge renders in grey instead of green/blue.",
    details:
      "Quality scores fetched per clause during negotiation. Each option gets a 0-100 score and label. Displayed as colored badges next to option text.",
  },
  {
    title: "5. Conflict Warnings — Review UI",
    file: "src/app/(dashboard)/deals/[id]/review/page.tsx",
    mutations: ["(client-side display)"],
    cloudMethod: "cloudApi.validateCompliance()",
    fallback:
      "Empty conflicts array returned, validated: false. No warning banners shown in review page.",
    details:
      "After compromise resolution, the agreed clause combination is sent for cross-clause conflict analysis. Returns array of ClauseConflict objects with severity (warning/error) and localized messages.",
  },
  {
    title: "6. Analytics Panel — Blurred Teaser",
    file: "src/components/AnalyticsPanel.tsx",
    mutations: ["(client-side component)"],
    cloudMethod:
      "cloudApi.getBenchmarks() + cloudApi.getClausePopularity() + cloudApi.getDealActivity()",
    fallback:
      "All three methods return null. Component renders blurred placeholder data with \"Upgrade to Cloud\" CTA overlay.",
    details:
      "AnalyticsPanel checks features.analytics flag. When false, shows teaser with blurred mock charts. When true, fetches live data from cloud API.",
  },
  {
    title: "7. Certification Badge — Deal Detail & Sign",
    file: "src/app/(dashboard)/deals/[id]/page.tsx + sign/page.tsx",
    mutations: ["(client-side display)"],
    cloudMethod: "cloudApi.getCertification()",
    fallback:
      "getCertification() returns { certified: false }. Badge/banner not rendered when certified === false.",
    details:
      "After both parties sign, the deal detail and sign confirmation pages check certification status. If certified === true, shows green ShieldCheck badge with audit certificate link.",
  },
];

const CLOUD_API_METHODS = [
  {
    method: "getDynamicBiases(contractType, jurisdiction)",
    returns: "BiasOverrides",
    degraded: "{} (empty object — static biases used)",
  },
  {
    method: "validateCompliance(agreedClauses)",
    returns: "ValidationResult",
    degraded: "{ conflicts: [], validated: false }",
  },
  {
    method: "scoreClauseQuality(contractType, jurisdiction, clauseId, optionIds)",
    returns: "QualityScore[]",
    degraded: "optionIds.map(id => ({ optionId: id, score: null, label: \"Unverified\" }))",
  },
  {
    method: "predictSatisfaction(params)",
    returns: "SatisfactionPrediction",
    degraded: "{ predictedSatisfactionA: 0, predictedSatisfactionB: 0, confidence: 0, predicted: false }",
  },
  {
    method: "certifyDocument(params)",
    returns: "CertificationCeremony",
    degraded: "{ ceremonyId: \"\", documentHash: \"\", certified: false }",
  },
  {
    method: "recordSignature(params)",
    returns: "SignatureRecord",
    degraded: "{ ceremonyId: \"\", partyRole, timestamp: \"\", certified: false }",
  },
  {
    method: "getCertification(ceremonyId)",
    returns: "CertificationResult",
    degraded: "{ ceremonyId: \"\", documentHash: \"\", timestamps: [], certified: false }",
  },
  {
    method: "getBenchmarks(contractType)",
    returns: "NegotiationBenchmarks | null",
    degraded: "null",
  },
  {
    method: "getClausePopularity(contractType, jurisdiction)",
    returns: "ClausePopularity[] | null",
    degraded: "null",
  },
  {
    method: "getDealActivity(organizationId?)",
    returns: "DealActivity | null",
    degraded: "null",
  },
];

// ---------------------------------------------------------------------------
// Collapsible Section Component
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        {title}
      </button>
      {open && <div className="px-4 pb-4 border-t border-border">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CloudServicesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Cloud Services</h1>
            <Badge className="bg-blue-500/20 text-blue-600">
              <Cloud className="w-3 h-3 mr-1" />
              Reference
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Open-core architecture reference — proprietary service integration points
          </p>
        </div>
      </div>

      {/* Section 1 — Service Overview */}
      <div className="card-brutal">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Service Layers
        </h3>
        <div className="grid grid-cols-5 gap-4">
          {SERVICE_LAYERS.map((layer) => {
            const Icon = layer.icon;
            return (
              <div
                key={layer.name}
                className="text-center p-4 bg-muted/30 border border-border"
              >
                <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="font-semibold text-sm">{layer.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{layer.persona}</p>
                <div className="mt-2">
                  <Badge variant="outline" className={`text-xs ${layer.depthColor}`}>
                    {layer.depth} lock-in
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{layer.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2 — Environment Configuration */}
      <div className="card-brutal">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Environment Configuration
        </h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-muted/30 border border-border">
            <Code className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-mono text-sm font-semibold">DEALROOM_CLOUD_API_KEY</p>
              <p className="text-sm text-muted-foreground mt-1">
                Single env var that gates all cloud service features. When absent, every
                cloud API method returns a typed degraded response — the app never crashes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Feature Flag</p>
              <p className="font-mono text-sm">features.cloudIntelligence</p>
              <p className="text-xs text-muted-foreground mt-1">
                Dynamic biases, quality scoring, conflict detection
              </p>
            </div>
            <div className="p-3 bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Feature Flag</p>
              <p className="font-mono text-sm">features.certification</p>
              <p className="text-xs text-muted-foreground mt-1">
                Cryptographic hashing, RFC 3161 timestamps
              </p>
            </div>
            <div className="p-3 bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Feature Flag</p>
              <p className="font-mono text-sm">features.analytics</p>
              <p className="text-xs text-muted-foreground mt-1">
                Negotiation benchmarks, counterparty intelligence
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            All three flags are defined in{" "}
            <span className="font-mono">src/config/features.ts</span> as{" "}
            <span className="font-mono">!!process.env.DEALROOM_CLOUD_API_KEY</span>
          </p>
        </div>
      </div>

      {/* Section 3 — Degradation Matrix */}
      <div className="card-brutal">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Degradation Matrix
        </h3>
        <div className="space-y-0 border border-border">
          {/* Header row */}
          <div className="grid grid-cols-4 gap-0 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="p-3 border-r border-border">Feature</div>
            <div className="p-3 border-r border-border flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              With Cloud API
            </div>
            <div className="p-3 border-r border-border flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              Without (Degraded)
            </div>
            <div className="p-3">Insertion Point</div>
          </div>
          {/* Data rows */}
          {DEGRADATION_ROWS.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-4 gap-0 text-sm ${
                i % 2 === 0 ? "" : "bg-muted/20"
              }`}
            >
              <div className="p-3 border-r border-border font-medium">{row.feature}</div>
              <div className="p-3 border-r border-border text-green-700 dark:text-green-400">
                {row.withCloud}
              </div>
              <div className="p-3 border-r border-border text-muted-foreground">
                {row.without}
              </div>
              <div className="p-3 font-mono text-xs text-muted-foreground">
                {row.insertionPoint}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4 — Integration Points */}
      <div className="card-brutal">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Integration Points
        </h3>
        <div className="space-y-2">
          {INTEGRATION_POINTS.map((point) => (
            <CollapsibleSection key={point.title} title={point.title}>
              <div className="space-y-3 pt-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      File
                    </p>
                    <p className="font-mono text-xs">{point.file}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Mutations / Hooks
                    </p>
                    <div className="flex gap-1 flex-wrap">
                      {point.mutations.map((m) => (
                        <Badge key={m} variant="outline" className="text-xs font-mono">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Cloud API Call
                  </p>
                  <p className="font-mono text-xs bg-muted/30 p-2 border border-border">
                    {point.cloudMethod}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Degraded Behavior
                  </p>
                  <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{point.fallback}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Details
                  </p>
                  <p className="text-sm text-muted-foreground">{point.details}</p>
                </div>
              </div>
            </CollapsibleSection>
          ))}
        </div>
      </div>

      {/* Section 5 — Cloud API Gateway */}
      <div className="card-brutal">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Cloud API Gateway
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Singleton at <span className="font-mono">src/lib/cloud-api.ts</span> —{" "}
          <span className="font-mono">CloudApiGateway</span> class with{" "}
          <span className="font-mono">cloudApi</span> export. Every method returns a typed
          degraded response when <span className="font-mono">DEALROOM_CLOUD_API_KEY</span>{" "}
          is not set.
        </p>
        <div className="space-y-0 border border-border">
          {/* Header */}
          <div className="grid grid-cols-3 gap-0 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="p-3 border-r border-border">Method</div>
            <div className="p-3 border-r border-border">Returns</div>
            <div className="p-3">Degraded Value</div>
          </div>
          {/* Rows */}
          {CLOUD_API_METHODS.map((m, i) => (
            <div
              key={m.method}
              className={`grid grid-cols-3 gap-0 text-xs font-mono ${
                i % 2 === 0 ? "" : "bg-muted/20"
              }`}
            >
              <div className="p-3 border-r border-border break-all">{m.method}</div>
              <div className="p-3 border-r border-border">{m.returns}</div>
              <div className="p-3 text-muted-foreground break-all">{m.degraded}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 6 — Database Schema */}
      <div className="card-brutal">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          <Database className="w-4 h-4 inline mr-2" />
          Database Schema Additions
        </h3>
        <div className="space-y-3">
          <div className="p-3 bg-muted/30 border border-border">
            <p className="font-mono text-sm font-semibold mb-2">SigningRequest</p>
            <div className="space-y-1 text-sm font-mono text-muted-foreground">
              <p>
                + ceremonyId <span className="text-primary">String?</span> — Cloud certification ceremony ID
              </p>
              <p>
                + documentHash <span className="text-primary">String?</span> — SHA-256 hash of final document
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              Requires <span className="font-mono">prisma db push</span> or migration after schema update.
              Fields are nullable — no breaking change to existing data.
            </p>
          </div>
        </div>
      </div>

      {/* Section 7 — Future Layers */}
      <div className="card-brutal">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          <Sparkles className="w-4 h-4 inline mr-2" />
          Future Layers
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted/30 border border-border border-dashed">
            <div className="flex items-center gap-2 mb-2">
              <Puzzle className="w-5 h-5 text-muted-foreground" />
              <p className="font-semibold">Clausemaster Authoring Platform</p>
              <Badge variant="outline" className="text-xs">Phase 2</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Visual clause editor for skill authors. Drag-and-drop option builder, bias
              tuning UI, jurisdiction matrix, live preview with token interpolation.
              Replaces manual JSON editing of clauses.json files.
            </p>
          </div>
          <div className="p-4 bg-muted/30 border border-border border-dashed">
            <div className="flex items-center gap-2 mb-2">
              <Store className="w-5 h-5 text-muted-foreground" />
              <p className="font-semibold">Integration Hub</p>
              <Badge variant="outline" className="text-xs">Phase 3</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              CRM deal sync (Salesforce, HubSpot), DMS integration (SharePoint,
              Google Drive). Webhook-based event streaming for signed contract
              delivery.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
