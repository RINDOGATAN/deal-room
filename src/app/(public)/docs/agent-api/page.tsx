"use client";

import { useTranslations } from "next-intl";
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
  CreditCard,
  Bell,
  Timer,
  Shield,
  Globe,
  Scale,
  RefreshCw,
} from "lucide-react";

export default function AgentApiPage() {
  const t = useTranslations("agentApi");

  const scopes = [
    { scope: "templates:read", desc: t("scopeTemplatesRead") },
    { scope: "playbook:read", desc: t("scopePlaybookRead") },
    { scope: "playbook:write", desc: t("scopePlaybookWrite") },
    { scope: "negotiate", desc: t("scopeNegotiate") },
    { scope: "deals:read", desc: t("scopeDealsRead") },
    { scope: "billing:read", desc: t("scopeBillingRead") },
    { scope: "webhooks:manage", desc: t("scopeWebhooksManage") },
    { scope: "disputes:create", desc: t("scopeDisputesCreate") },
  ];

  const flowSteps = [
    {
      step: 1,
      icon: BookOpen,
      title: t("flowCreatePlaybooks"),
      desc: t("flowCreatePlaybooksDesc"),
      endpoint: "POST /playbooks",
    },
    {
      step: 2,
      icon: Send,
      title: t("flowInitiate"),
      desc: t("flowInitiateDesc"),
      endpoint: "POST /negotiate",
    },
    {
      step: 3,
      icon: ArrowRightLeft,
      title: t("flowSendToken"),
      desc: t("flowSendTokenDesc"),
      endpoint: null,
    },
    {
      step: 4,
      icon: Bot,
      title: t("flowRespondentJoins"),
      desc: t("flowRespondentJoinsDesc"),
      endpoint: "POST /negotiate/join",
    },
    {
      step: 5,
      icon: CheckCircle,
      title: t("flowGetResults"),
      desc: t("flowGetResultsDesc"),
      endpoint: "GET /deals/:id",
    },
  ];

  const playbookEndpoints: [string, string, string][] = [
    ["GET", "/playbooks", t("purposeListPlaybooks")],
    ["POST", "/playbooks", t("purposeCreatePlaybook")],
    ["GET", "/playbooks/:id", t("purposeGetPlaybook")],
    ["PUT", "/playbooks/:id", t("purposeUpdatePlaybook")],
    ["DELETE", "/playbooks/:id", t("purposeDeletePlaybook")],
  ];

  const dealEndpoints: [string, string, string][] = [
    ["GET", "/deals", t("purposeListDeals")],
    ["GET", "/deals/:id", t("purposeDealOutcome")],
    ["GET", "/deals/:id/document", t("purposeDownloadPdf")],
    ["GET", "/deals/:id/document/docx", t("purposeDownloadDocx")],
  ];

  const asyncEndpoints: [string, string, string][] = [
    ["POST", "/deals/:id/counter", t("purposeCounter")],
    ["POST", "/deals/:id/accept", t("purposeAccept")],
    ["POST", "/deals/:id/reject", t("purposeReject")],
    ["GET", "/deals/:id/status", t("purposeStatus")],
  ];

  const subscriptionEndpoints: [string, string, string][] = [
    ["GET", "/subscriptions", t("purposeGetSubscriptions")],
    ["POST", "/subscribe", t("purposeSubscribe")],
  ];

  const webhookEndpoints: [string, string, string][] = [
    ["POST", "/webhooks", t("purposeRegisterWebhook")],
    ["GET", "/webhooks", t("purposeListWebhooks")],
    ["DELETE", "/webhooks/:id", t("purposeDeleteWebhook")],
  ];

  const disputeEndpoints: [string, string, string][] = [
    ["POST", "/deals/:id/dispute", t("purposeDispute")],
  ];

  const webhookEvents = [
    { event: "negotiation.pending", desc: t("webhookEventPending") },
    { event: "negotiation.agreed", desc: t("webhookEventAgreed") },
    { event: "negotiation.failed", desc: t("webhookEventFailed") },
    { event: "negotiation.suggested", desc: t("webhookEventSuggested") },
    { event: "negotiation.counter", desc: t("webhookEventCounter") },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
        <div className="mt-4 p-3 border border-primary/30 bg-primary/5 rounded-xl text-sm">
          <strong className="text-primary">{t("baseUrl")}:</strong>{" "}
          <code className="text-foreground">
            https://dealroom.todo.law/api/v1/agent
          </code>
        </div>
      </div>

      {/* Authentication */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("authentication")}</h2>
        <p className="text-muted-foreground">{t("authDescription")}</p>

        <div className="p-4 border border-border bg-card font-mono text-sm rounded-2xl">
          <span className="text-muted-foreground">Authorization:</span>{" "}
          <span className="text-primary">Bearer drk_exampleexampleexample</span>
        </div>

        <h3 className="text-lg font-bold mt-6">{t("scopes")}</h3>
        <p className="text-muted-foreground text-sm">{t("scopesDescription")}</p>

        <div className="border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium">{t("tableScope")}</th>
                <th className="text-left p-3 font-medium">
                  {t("tableGrantsAccess")}
                </th>
              </tr>
            </thead>
            <tbody>
              {scopes.map(({ scope, desc }) => (
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

      {/* Entitlements */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("entitlements")}</h2>
        <p className="text-muted-foreground">{t("entitlementsDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <h3 className="font-bold">{t("entitlementInitiatorTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("entitlementInitiatorDesc")}
            </p>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold">{t("entitlementRespondentTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("entitlementRespondentDesc")}
            </p>
          </div>
        </div>

        <div className="p-3 border border-primary/30 bg-primary/5 rounded-xl text-sm">
          {t("entitlementPricing")}
        </div>
      </div>

      {/* Rate Limits */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Timer className="w-5 h-5 text-primary" />
          {t("rateLimits")}
        </h2>
        <p className="text-muted-foreground">{t("rateLimitsDesc")}</p>

        <div className="border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium">{t("rateLimitGroup")}</th>
                <th className="text-left p-3 font-medium">{t("rateLimitEndpointsCol")}</th>
                <th className="text-left p-3 font-medium">{t("rateLimitLimit")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3 font-medium">negotiate</td>
                <td className="p-3 font-mono text-xs">{t("rateLimitNegotiate")}</td>
                <td className="p-3">{t("rateLimitNegotiateLimit")}</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">default</td>
                <td className="p-3 text-muted-foreground">{t("rateLimitDefault")}</td>
                <td className="p-3">{t("rateLimitDefaultLimit")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-sm text-muted-foreground">{t("rateLimitRetryAfter")}</p>
      </div>

      {/* Negotiation Flow */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("negotiationFlow")}</h2>
        <p className="text-muted-foreground">{t("negotiationFlowDesc")}</p>

        <div className="space-y-3">
          {flowSteps.map(({ step, icon: Icon, title, desc, endpoint }) => (
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
        <h2 className="text-xl font-bold">{t("endpoints")}</h2>
        <p className="text-muted-foreground">
          {t("endpointsUnder")}{" "}
          <code className="text-primary">/api/v1/agent/</code>.
        </p>

        {/* Templates */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            {t("sectionTemplates")}
          </h3>
          <div className="border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium">{t("tableMethod")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePath")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePurpose")}</th>
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
                    {t("purposeListTemplates")}
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
                    {t("purposeTemplateDetail")}
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
            {t("sectionPlaybooks")}
          </h3>
          <div className="border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium">{t("tableMethod")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePath")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePurpose")}</th>
                </tr>
              </thead>
              <tbody>
                {playbookEndpoints.map(([method, path, purpose], i) => (
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
            {t("sectionNegotiation")}
          </h3>
          <div className="border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium">{t("tableMethod")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePath")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePurpose")}</th>
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
                    {t("purposeInitiate")}
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
                    {t("purposeJoin")}
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
            {t("sectionDeals")}
          </h3>
          <div className="border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium">{t("tableMethod")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePath")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePurpose")}</th>
                </tr>
              </thead>
              <tbody>
                {dealEndpoints.map(([method, path, purpose], i) => (
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

        {/* Subscriptions & Billing */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            {t("sectionSubscriptions")}
          </h3>
          <div className="border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium">{t("tableMethod")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePath")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePurpose")}</th>
                </tr>
              </thead>
              <tbody>
                {subscriptionEndpoints.map(([method, path, purpose], i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-0"
                  >
                    <td className="p-3">
                      <code
                        className={`text-xs px-1.5 py-0.5 rounded border ${
                          method === "GET"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                            : "bg-blue-500/10 text-blue-500 border-blue-500/30"
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

        {/* Webhooks */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            {t("sectionWebhooks")}
          </h3>
          <div className="border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium">{t("tableMethod")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePath")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePurpose")}</th>
                </tr>
              </thead>
              <tbody>
                {webhookEndpoints.map(([method, path, purpose], i) => (
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

        {/* Async Endpoints */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            {t("sectionAsyncEndpoints")}
          </h3>
          <div className="border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium">{t("tableMethod")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePath")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePurpose")}</th>
                </tr>
              </thead>
              <tbody>
                {asyncEndpoints.map(([method, path, purpose], i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-0"
                  >
                    <td className="p-3">
                      <code
                        className={`text-xs px-1.5 py-0.5 rounded border ${
                          method === "GET"
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                            : "bg-blue-500/10 text-blue-500 border-blue-500/30"
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

        {/* Disputes */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            {t("sectionDisputes")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("disputesDesc")}</p>
          <div className="border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium">{t("tableMethod")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePath")}</th>
                  <th className="text-left p-3 font-medium">{t("tablePurpose")}</th>
                </tr>
              </thead>
              <tbody>
                {disputeEndpoints.map(([method, path, purpose], i) => (
                  <tr
                    key={i}
                    className="border-b border-border last:border-0"
                  >
                    <td className="p-3">
                      <code className="text-xs px-1.5 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/30 rounded">
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
        <h2 className="text-xl font-bold">{t("playbookConfig")}</h2>
        <p className="text-muted-foreground">{t("playbookConfigDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Key className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("priorityTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {t("priorityDesc")}
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-4 text-primary font-bold">1</span>
                <span className="text-muted-foreground">
                  {t("priorityNotImportant")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 text-primary font-bold">3</span>
                <span className="text-muted-foreground">
                  {t("priorityModerate")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 text-primary font-bold">5</span>
                <span className="text-muted-foreground">
                  {t("priorityCritical")}
                </span>
              </div>
            </div>
          </div>

          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("flexibilityTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {t("flexibilityDesc")}
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-4 text-primary font-bold">1</span>
                <span className="text-muted-foreground">
                  {t("flexibilityInflexible")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 text-primary font-bold">3</span>
                <span className="text-muted-foreground">
                  {t("flexibilityNeutral")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 text-primary font-bold">5</span>
                <span className="text-muted-foreground">
                  {t("flexibilityVeryFlexible")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Red Lines */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("redLines")}</h2>
        <p className="text-muted-foreground">
          {t("redLinesDesc1")}{" "}
          <code className="text-primary">acceptableOptions</code>{" "}
          {t("redLinesDesc2")}
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
                {t("redLineOverlap")}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("redLineOverlapDesc")}
            </p>
          </div>
          <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <p className="font-medium text-amber-500 text-sm">
                {t("redLineOneSided")}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("redLineOneSidedDesc")}
            </p>
          </div>
          <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <p className="font-medium text-red-500 text-sm">
                {t("redLineConflict")}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("redLineConflictDesc")}
            </p>
          </div>
        </div>
      </div>

      {/* Webhooks Detail */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          {t("sectionWebhooks")}
        </h2>
        <p className="text-muted-foreground">{t("webhooksDesc")}</p>

        <h3 className="text-lg font-bold">{t("webhookEvents")}</h3>
        <div className="border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium">Event</th>
                <th className="text-left p-3 font-medium">{t("tablePurpose")}</th>
              </tr>
            </thead>
            <tbody>
              {webhookEvents.map(({ event, desc }) => (
                <tr key={event} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <code className="text-primary text-xs">{event}</code>
                  </td>
                  <td className="p-3 text-muted-foreground">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-muted-foreground">{t("webhookSigning")}</p>
        <p className="text-sm text-muted-foreground">{t("webhookRetries")}</p>
      </div>

      {/* Async Multi-Round Negotiation */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-primary" />
          {t("asyncNegotiation")}
        </h2>
        <p className="text-muted-foreground">{t("asyncNegotiationDesc")}</p>

        <div className="space-y-3">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 border border-muted-foreground rounded-full flex items-center justify-center text-xs font-bold">
                1
              </div>
              <h3 className="font-bold">{t("asyncStep1Title")}</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-9">{t("asyncStep1Desc")}</p>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 border border-muted-foreground rounded-full flex items-center justify-center text-xs font-bold">
                2
              </div>
              <h3 className="font-bold">{t("asyncStep2Title")}</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-9">{t("asyncStep2Desc")}</p>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 border border-muted-foreground rounded-full flex items-center justify-center text-xs font-bold">
                3
              </div>
              <h3 className="font-bold">{t("asyncStep3Title")}</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-9">{t("asyncStep3Desc")}</p>
          </div>
        </div>
      </div>

      {/* Attorney Attestation */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          {t("attestation")}
        </h2>
        <p className="text-muted-foreground">{t("attestationDesc")}</p>

        <div className="p-3 border border-primary/30 bg-primary/5 rounded-xl text-sm">
          {t("attestationUeta")}
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-bold">{t("attestationResponseTitle")}</h3>
          <div className="p-5 border border-border bg-card font-mono text-sm rounded-2xl overflow-x-auto">
            <pre className="text-xs leading-relaxed">
              {`{
  "attorneyAttestation": {
    "name": "John Doe, Esq.",
    "barNumber": "CA-123456",
    "statement": "Reviewed pursuant to UETA § 14 and E-SIGN Act"
  }
}`}
            </pre>
          </div>
        </div>
      </div>

      {/* Protocol Discovery */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          {t("protocolDiscovery")}
        </h2>
        <p className="text-muted-foreground">{t("protocolDiscoveryDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-2">
              <Bot className="w-4 h-4 text-primary" />
              <h3 className="font-bold">{t("a2aCard")}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{t("a2aCardDesc")}</p>
            <code className="text-xs text-primary">{t("a2aCardPath")}</code>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-2">
              <Key className="w-4 h-4 text-primary" />
              <h3 className="font-bold">{t("mcpTools")}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{t("mcpToolsDesc")}</p>
            <code className="text-xs text-primary">{t("mcpToolsPath")}</code>
          </div>
        </div>
      </div>

      {/* Response Examples */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("responseExamples")}</h2>

        {/* Success */}
        <div className="space-y-2">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            {t("agreedDeal")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("agreedDealDesc")}
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
            {t("failedDeal")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("failedDealDesc")}
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
        <h2 className="text-xl font-bold">{t("quickStart")}</h2>
        <p className="text-muted-foreground">{t("quickStartDesc")}</p>

        <div className="space-y-3">
          <div className="p-4 border border-border rounded-xl">
            <p className="text-sm font-medium mb-2">
              {t("quickStep1")}
            </p>
            <div className="p-3 bg-card border border-border rounded-lg font-mono overflow-x-auto">
              <code className="text-xs">
                curl /api/v1/agent/templates/DPA -H &quot;Authorization: Bearer
                drk_YOUR_KEY&quot;
              </code>
            </div>
          </div>

          <div className="p-4 border border-border rounded-xl">
            <p className="text-sm font-medium mb-2">{t("quickStep2")}</p>
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
              {t("quickStep3")}
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
              {t("quickStep3Note1")}{" "}
              <code className="text-primary">negotiationToken</code>.{" "}
              {t("quickStep3Note2")}
            </p>
          </div>

          <div className="p-4 border border-border rounded-xl">
            <p className="text-sm font-medium mb-2">{t("quickStep4")}</p>
            <div className="p-3 bg-card border border-border rounded-lg font-mono overflow-x-auto">
              <pre className="text-xs leading-relaxed">
                {`curl -X POST /api/v1/agent/negotiate/join \\
  -H "Authorization: Bearer drk_COMPANY_B_KEY" \\
  -d '{"negotiationToken":"nt_abc123...","playbookId":"PB_B_ID",
       "respondentEmail":"legal@widget.com"}'`}
              </pre>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t("quickStep4Note")}{" "}
              <code className="text-primary">AGREED</code>{" "}
              {t("quickStep4NoteOr")}{" "}
              <code className="text-primary">FAILED</code>.
            </p>
          </div>

          <div className="p-4 border border-border rounded-xl">
            <p className="text-sm font-medium mb-2">
              {t("quickStep5")}
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

      {/* Versioning */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("versioning")}</h2>
        <div className="p-5 border border-border bg-muted/30 rounded-2xl">
          <p className="text-sm text-muted-foreground">
            {t("versioningDesc1")}
            <code className="text-primary">/v1/</code>
            {t("versioningDesc2")}
          </p>
        </div>
      </div>
    </div>
  );
}
