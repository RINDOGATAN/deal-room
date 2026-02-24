"use client";

import { useTranslations } from "next-intl";
import {
  Users,
  Eye,
  Shield,
  Key,
  Clock,
  FileSearch,
  Lock,
  UserCog,
  Building,
  ArrowDown,
} from "lucide-react";

export default function SupervisionPage() {
  const t = useTranslations("supervision");

  const auditEntries = [
    {
      time: "2024-01-15 14:32:01",
      actor: t("auditActorAdmin"),
      action: t("auditAction1"),
    },
    {
      time: "2024-01-15 14:35:22",
      actor: t("auditActorSupervisor"),
      action: t("auditAction2"),
    },
    {
      time: "2024-01-15 15:01:45",
      actor: t("auditActorPartyA"),
      action: t("auditAction3"),
    },
    {
      time: "2024-01-15 16:22:11",
      actor: t("auditActorPartyB"),
      action: t("auditAction4"),
    },
    {
      time: "2024-01-15 16:22:12",
      actor: t("auditActorSystem"),
      action: t("auditAction5"),
    },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Role Hierarchy */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("hierarchyTitle")}</h2>
        <p className="text-muted-foreground">{t("hierarchyDesc")}</p>

        <div className="space-y-4">
          {/* Platform Admin */}
          <div className="max-w-md mx-auto">
            <div className="p-6 border border-primary bg-primary/5 rounded-2xl">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 border-2 border-primary bg-primary rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primary">
                    {t("rolePlatformAdmin")}
                  </h3>
                  <p className="text-xs text-muted-foreground">/admin portal</p>
                </div>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>{t("adminBullet1")}</li>
                <li>{t("adminBullet2")}</li>
                <li>{t("adminBullet3")}</li>
                <li>{t("adminBullet4")}</li>
              </ul>
            </div>
          </div>

          {/* Arrow connector */}
          <div className="flex justify-center">
            <ArrowDown className="w-6 h-6 text-muted-foreground" />
          </div>

          {/* Supervisor + Deal Parties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 border border-border rounded-2xl">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 border-2 border-muted-foreground rounded-xl flex items-center justify-center">
                  <Eye className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{t("roleSupervisor")}</h3>
                  <p className="text-xs text-muted-foreground">
                    /supervise portal
                  </p>
                </div>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>{t("supervisorBullet1")}</li>
                <li>{t("supervisorBullet2")}</li>
                <li>{t("supervisorBullet3")}</li>
                <li>{t("supervisorBullet4")}</li>
              </ul>
            </div>

            {/* Deal Users */}
            <div className="p-6 border border-border rounded-2xl">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 border-2 border-muted-foreground rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{t("roleDealParties")}</h3>
                  <p className="text-xs text-muted-foreground">/deals portal</p>
                </div>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>{t("dealPartiesBullet1")}</li>
                <li>{t("dealPartiesBullet2")}</li>
                <li>{t("dealPartiesBullet3")}</li>
                <li>{t("dealPartiesBullet4")}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Two Portal System */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("twoLevelTitle")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border border-primary rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Building className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-primary">
                {t("portalAdminTitle")}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("portalAdminDesc")}
            </p>
            <div className="space-y-2 text-sm">
              <div className="p-3 bg-muted/30 border border-border rounded-xl">
                <p className="font-medium">{t("portalAdminFeature1")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("portalAdminFeature1Desc")}
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border rounded-xl">
                <p className="font-medium">{t("portalAdminFeature2")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("portalAdminFeature2Desc")}
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border rounded-xl">
                <p className="font-medium">{t("portalAdminFeature3")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("portalAdminFeature3Desc")}
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border rounded-xl">
                <p className="font-medium">{t("portalAdminFeature4")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("portalAdminFeature4Desc")}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 border border-border rounded-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="w-5 h-5" />
              <h3 className="font-bold">{t("portalSupervisorTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("portalSupervisorDesc")}
            </p>
            <div className="space-y-2 text-sm">
              <div className="p-3 bg-muted/30 border border-border rounded-xl">
                <p className="font-medium">
                  {t("portalSupervisorFeature1")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("portalSupervisorFeature1Desc")}
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border rounded-xl">
                <p className="font-medium">
                  {t("portalSupervisorFeature2")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("portalSupervisorFeature2Desc")}
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border rounded-xl">
                <p className="font-medium">
                  {t("portalSupervisorFeature3")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("portalSupervisorFeature3Desc")}
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border rounded-xl opacity-50">
                <p className="font-medium">
                  {t("portalSupervisorFeature4")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("portalSupervisorFeature4Desc")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment-Based Access */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("assignmentTitle")}</h2>
        <p className="text-muted-foreground">{t("assignmentDesc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-primary" />
              <h3 className="font-bold">{t("assignConfidentiality")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("assignConfidentialityDesc")}
            </p>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-2 mb-3">
              <UserCog className="w-4 h-4 text-primary" />
              <h3 className="font-bold">{t("assignSpecialization")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("assignSpecializationDesc")}
            </p>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileSearch className="w-4 h-4 text-primary" />
              <h3 className="font-bold">{t("assignAccountability")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("assignAccountabilityDesc")}
            </p>
          </div>
        </div>

        {/* Visibility Matrix */}
        <div className="p-5 border border-border rounded-xl">
          <h3 className="font-bold mb-4">{t("matrixTitle")}</h3>
          <div className="rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">
                    {t("matrixResource")}
                  </th>
                  <th className="text-center py-2 text-muted-foreground font-medium">
                    {t("rolePlatformAdmin")}
                  </th>
                  <th className="text-center py-2 text-muted-foreground font-medium">
                    {t("roleSupervisor")}
                  </th>
                  <th className="text-center py-2 text-muted-foreground font-medium">
                    {t("roleDealParty")}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-2">{t("matrixAllDeals")}</td>
                  <td className="text-center py-2 text-primary">
                    {t("matrixViewManage")}
                  </td>
                  <td className="text-center py-2 text-muted-foreground">
                    —
                  </td>
                  <td className="text-center py-2 text-muted-foreground">
                    —
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2">{t("matrixAssignedDeals")}</td>
                  <td className="text-center py-2 text-primary">
                    {t("matrixViewManage")}
                  </td>
                  <td className="text-center py-2 text-foreground">
                    {t("matrixViewOnly")}
                  </td>
                  <td className="text-center py-2 text-muted-foreground">
                    —
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2">{t("matrixOwnDeals")}</td>
                  <td className="text-center py-2 text-primary">
                    {t("matrixViewManage")}
                  </td>
                  <td className="text-center py-2 text-muted-foreground">
                    {t("matrixIfAssigned")}
                  </td>
                  <td className="text-center py-2 text-foreground">
                    {t("matrixViewNegotiate")}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2">{t("matrixSupervisors")}</td>
                  <td className="text-center py-2 text-primary">
                    {t("matrixManage")}
                  </td>
                  <td className="text-center py-2 text-muted-foreground">
                    —
                  </td>
                  <td className="text-center py-2 text-muted-foreground">
                    —
                  </td>
                </tr>
                <tr>
                  <td className="py-2">{t("matrixSkillsLicensing")}</td>
                  <td className="text-center py-2 text-primary">
                    {t("matrixManage")}
                  </td>
                  <td className="text-center py-2 text-muted-foreground">
                    —
                  </td>
                  <td className="text-center py-2 text-muted-foreground">
                    —
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Audit Trail */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("auditTitle")}</h2>
        <p className="text-muted-foreground">{t("auditDesc")}</p>

        <div className="p-5 border border-border bg-card rounded-2xl">
          <div className="space-y-3">
            {auditEntries.map((entry, i) => (
              <div
                key={i}
                className="flex items-start gap-4 text-sm pb-3 border-b border-border last:border-0 last:pb-0"
              >
                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                  {entry.time}
                </span>
                <span className="text-xs px-2 py-0.5 bg-muted border border-border rounded-full whitespace-nowrap">
                  {entry.actor}
                </span>
                <span className="text-foreground">{entry.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">{t("securityTitle")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Key className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("security2FA")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("security2FADesc")}
            </p>
          </div>
          <div className="card-brutal p-5">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="font-bold">{t("securitySession")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("securitySessionDesc")}
            </p>
          </div>
        </div>

        <div className="p-4 bg-muted/30 border border-border rounded-xl">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{t("securityTechNote")}</strong>{" "}
            {t("securityTechNoteDesc")}{" "}
            <code className="text-xs bg-card px-1 py-0.5 border border-border rounded">
              src/lib/auth-admin.ts
            </code>{" "}
            {t("securityTechNoteAnd")}{" "}
            <code className="text-xs bg-card px-1 py-0.5 border border-border rounded">
              src/lib/auth-supervisor.ts
            </code>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
