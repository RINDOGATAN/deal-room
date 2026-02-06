"use client";

import { FileText, Users, Scale, Gavel, Settings } from "lucide-react";

const sidebarItems = [
  { icon: FileText, label: "Active Deals", active: true },
  { icon: Users, label: "Counterparties", active: false },
  { icon: Scale, label: "Clause Library", active: false },
  { icon: Gavel, label: "Templates", active: false },
  { icon: Settings, label: "Settings", active: false },
];

const mockDeals = [
  { name: "SaaS Agreement – Acme Corp", type: "SaaS", jurisdiction: "California", status: "Negotiating", progress: 72 },
  { name: "DPA – DataFlow Inc.", type: "DPA", jurisdiction: "England & Wales", status: "Pending", progress: 45 },
  { name: "MSA – GlobalTech Ltd", type: "MSA", jurisdiction: "Spain", status: "Agreed", progress: 100 },
  { name: "NDA – Stealth Startup", type: "NDA", jurisdiction: "California", status: "Negotiating", progress: 60 },
];

export default function InterfacePreview() {
  return (
    <div className="relative mx-auto max-w-5xl">
      {/* Browser chrome */}
      <div className="rounded-t-2xl bg-secondary border border-border border-b-0 px-4 py-3 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-destructive/60" />
          <div className="w-3 h-3 rounded-full bg-warning/60" />
          <div className="w-3 h-3 rounded-full bg-accent/40" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-muted rounded-lg px-4 py-1.5 text-xs text-muted-foreground font-body max-w-md mx-auto text-center">
            dealroom.todo.law
          </div>
        </div>
      </div>

      {/* App frame */}
      <div className="rounded-b-2xl border border-border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex min-h-[380px]">
          {/* Sidebar */}
          <div className="w-48 bg-secondary/50 border-r border-border p-3 flex-shrink-0 hidden sm:block">
            <div className="mb-4 px-2">
              <span className="text-sm font-heading text-accent">Dealroom</span>
            </div>
            <nav className="space-y-1">
              {sidebarItems.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-body transition-colors ${
                    item.active
                      ? "bg-accent/15 text-accent"
                      : "text-muted-foreground"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </div>
              ))}
            </nav>
          </div>

          {/* Main content */}
          <div className="flex-1 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h4 className="text-sm font-heading">Active Negotiations</h4>
                <p className="text-xs text-muted-foreground font-body mt-0.5">
                  4 deals in progress
                </p>
              </div>
              <div className="btn-primary text-xs py-1.5 px-3 cursor-default">+ New Deal</div>
            </div>

            {/* Table */}
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs font-body">
                <thead>
                  <tr className="bg-secondary/60 text-muted-foreground">
                    <th className="text-left px-3 py-2.5 font-medium">Deal</th>
                    <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Type</th>
                    <th className="text-left px-3 py-2.5 font-medium hidden lg:table-cell">Jurisdiction</th>
                    <th className="text-left px-3 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mockDeals.map((deal, i) => (
                    <tr
                      key={deal.name}
                      className={`border-t border-border ${i % 2 === 0 ? "" : "bg-secondary/20"}`}
                    >
                      <td className="px-3 py-2.5 text-foreground">{deal.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">{deal.type}</td>
                      <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">{deal.jurisdiction}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            deal.status === "Agreed"
                              ? "bg-accent/15 text-accent"
                              : deal.status === "Pending"
                              ? "bg-warning/15 text-warning"
                              : "bg-primary/15 text-primary"
                          }`}
                        >
                          {deal.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative glow */}
      <div className="absolute -inset-4 bg-accent/5 rounded-3xl -z-10 blur-2xl" />
    </div>
  );
}
