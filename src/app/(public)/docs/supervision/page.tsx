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
} from "lucide-react";

export default function SupervisionPage() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-4">Supervision</h1>
        <p className="text-lg text-muted-foreground">
          Dealroom implements a two-level administration system with platform
          administrators and supervisors, providing oversight while maintaining
          party confidentiality.
        </p>
      </div>

      {/* Role Hierarchy */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Administration Hierarchy</h2>
        <p className="text-muted-foreground">
          Three distinct roles with escalating access levels:
        </p>

        <div className="relative">
          {/* Connection lines */}
          <div className="absolute left-1/2 top-[72px] w-0.5 h-[calc(100%-144px)] bg-border -translate-x-1/2" />
          <div className="absolute left-1/4 top-[200px] w-[25%] h-0.5 bg-border" />
          <div className="absolute right-1/4 top-[200px] w-[25%] h-0.5 bg-border" />

          <div className="relative space-y-8">
            {/* Platform Admin */}
            <div className="max-w-md mx-auto">
              <div className="p-6 border-2 border-primary bg-primary/5">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 border-2 border-primary bg-primary flex items-center justify-center">
                    <Shield className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-primary">Platform Admin</h3>
                    <p className="text-xs text-muted-foreground">/admin portal</p>
                  </div>
                </div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Full system access and configuration</li>
                  <li>• Manage supervisors and customers</li>
                  <li>• View all deals and analytics</li>
                  <li>• Manage skills and licensing</li>
                </ul>
              </div>
            </div>

            {/* Supervisor */}
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 border-2 border-border">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 border-2 border-muted-foreground flex items-center justify-center">
                    <Eye className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Supervisor</h3>
                    <p className="text-xs text-muted-foreground">/supervise portal</p>
                  </div>
                </div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• View assigned deals only</li>
                  <li>• Read-only access (no modifications)</li>
                  <li>• Monitor negotiation progress</li>
                  <li>• Review clause selections</li>
                </ul>
              </div>

              {/* Deal Users */}
              <div className="p-6 border-2 border-border">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 border-2 border-muted-foreground flex items-center justify-center">
                    <Users className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Deal Parties</h3>
                    <p className="text-xs text-muted-foreground">/deals portal</p>
                  </div>
                </div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Create and participate in deals</li>
                  <li>• Make selections and negotiate</li>
                  <li>• Sign completed contracts</li>
                  <li>• View own deals only</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Portal System */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Two-Level Administration</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="p-6 border-2 border-primary">
            <div className="flex items-center gap-3 mb-4">
              <Building className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-primary">Platform Admin Portal</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Full administrative control over the entire platform.
            </p>
            <div className="space-y-2 text-sm">
              <div className="p-3 bg-muted/30 border border-border">
                <p className="font-medium">Dashboard & Analytics</p>
                <p className="text-xs text-muted-foreground">
                  System-wide metrics and reports
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border">
                <p className="font-medium">Supervisor Management</p>
                <p className="text-xs text-muted-foreground">
                  Create, assign, and manage supervisors
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border">
                <p className="font-medium">Customer Management</p>
                <p className="text-xs text-muted-foreground">
                  View and manage all users
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border">
                <p className="font-medium">Skill Administration</p>
                <p className="text-xs text-muted-foreground">
                  Install, configure, and license skills
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 border-2 border-border">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="w-5 h-5" />
              <h3 className="font-bold">Supervisor Portal</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Scoped oversight of assigned deals only.
            </p>
            <div className="space-y-2 text-sm">
              <div className="p-3 bg-muted/30 border border-border">
                <p className="font-medium">Assigned Deals List</p>
                <p className="text-xs text-muted-foreground">
                  View only deals assigned by admin
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border">
                <p className="font-medium">Deal Details (Read-Only)</p>
                <p className="text-xs text-muted-foreground">
                  View parties, clauses, selections
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border">
                <p className="font-medium">Negotiation History</p>
                <p className="text-xs text-muted-foreground">
                  Review all actions and decisions
                </p>
              </div>
              <div className="p-3 bg-muted/30 border border-border opacity-50">
                <p className="font-medium">No Modification Rights</p>
                <p className="text-xs text-muted-foreground">
                  Cannot alter deal or selections
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment-Based Access */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Assignment-Based Access</h2>
        <p className="text-muted-foreground">
          Supervisors only see deals explicitly assigned to them by a platform
          administrator. This ensures:
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-primary" />
              <h3 className="font-bold">Confidentiality</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Supervisors cannot browse unassigned deals, protecting party privacy.
            </p>
          </div>
          <div className="p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <UserCog className="w-4 h-4 text-primary" />
              <h3 className="font-bold">Specialization</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Different supervisors can be assigned to different deal types or
              jurisdictions.
            </p>
          </div>
          <div className="p-5 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <FileSearch className="w-4 h-4 text-primary" />
              <h3 className="font-bold">Accountability</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Clear record of who had access to which deals and when.
            </p>
          </div>
        </div>

        {/* Visibility Matrix */}
        <div className="p-5 border border-border">
          <h3 className="font-bold mb-4">Access Matrix</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">
                    Resource
                  </th>
                  <th className="text-center py-2 text-muted-foreground font-medium">
                    Platform Admin
                  </th>
                  <th className="text-center py-2 text-muted-foreground font-medium">
                    Supervisor
                  </th>
                  <th className="text-center py-2 text-muted-foreground font-medium">
                    Deal Party
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="py-2">All Deals</td>
                  <td className="text-center py-2 text-primary">View + Manage</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2">Assigned Deals</td>
                  <td className="text-center py-2 text-primary">View + Manage</td>
                  <td className="text-center py-2 text-foreground">View Only</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2">Own Deals</td>
                  <td className="text-center py-2 text-primary">View + Manage</td>
                  <td className="text-center py-2 text-muted-foreground">
                    (if assigned)
                  </td>
                  <td className="text-center py-2 text-foreground">
                    View + Negotiate
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2">Supervisors</td>
                  <td className="text-center py-2 text-primary">Manage</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                </tr>
                <tr>
                  <td className="py-2">Skills & Licensing</td>
                  <td className="text-center py-2 text-primary">Manage</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                  <td className="text-center py-2 text-muted-foreground">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Audit Trail */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Audit Trail</h2>
        <p className="text-muted-foreground">
          All actions are logged for compliance and dispute resolution:
        </p>

        <div className="p-5 border border-border bg-card">
          <div className="space-y-3">
            {[
              {
                time: "2024-01-15 14:32:01",
                actor: "Platform Admin",
                action: "Assigned Supervisor Jane to Deal #123",
              },
              {
                time: "2024-01-15 14:35:22",
                actor: "Supervisor Jane",
                action: "Viewed Deal #123 details",
              },
              {
                time: "2024-01-15 15:01:45",
                actor: "Party A (john@example.com)",
                action: "Submitted selections for Deal #123",
              },
              {
                time: "2024-01-15 16:22:11",
                actor: "Party B (sarah@example.com)",
                action: "Submitted selections for Deal #123",
              },
              {
                time: "2024-01-15 16:22:12",
                actor: "System",
                action: "Generated compromise suggestions for Deal #123",
              },
            ].map((entry, i) => (
              <div
                key={i}
                className="flex items-start gap-4 text-sm pb-3 border-b border-border last:border-0 last:pb-0"
              >
                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                  {entry.time}
                </span>
                <span className="text-xs px-2 py-0.5 bg-muted border border-border whitespace-nowrap">
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
        <h2 className="text-xl font-bold">Security Features</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="p-5 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Key className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Two-Factor Authentication</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Both admin and supervisor portals require 2FA after magic link
              sign-in. Time-based codes provide an additional security layer.
            </p>
          </div>
          <div className="p-5 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Session Management</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Separate session cookies for each portal (admin_session,
              supervisor_session). Sessions expire and can be revoked.
            </p>
          </div>
        </div>

        <div className="p-4 bg-muted/30 border border-border">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Technical note:</strong> Admin and
            supervisor authentication use separate NextAuth instances with custom
            adapters mapping to PlatformAdmin and Supervisor database tables
            respectively. See{" "}
            <code className="text-xs bg-card px-1 py-0.5 border border-border">
              src/lib/auth-admin.ts
            </code>{" "}
            and{" "}
            <code className="text-xs bg-card px-1 py-0.5 border border-border">
              src/lib/auth-supervisor.ts
            </code>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
