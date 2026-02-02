"use client";

import { trpc } from "@/lib/trpc";
import {
  BarChart,
  AlertCircle,
  Loader2,
  TrendingUp,
  FileText,
  Package,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AnalyticsPage() {
  const { data: analytics, isLoading, error } = trpc.platformAdmin.getAnalytics.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Analytics</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-brutal border-destructive">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load analytics: {error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Platform usage and performance metrics
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card-brutal text-center">
          <FileText className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-3xl font-bold">{analytics?.totalDeals || 0}</p>
          <p className="text-sm text-muted-foreground">Total Deals</p>
        </div>
        <div className="card-brutal text-center">
          <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-3xl font-bold">{analytics?.completedDeals || 0}</p>
          <p className="text-sm text-muted-foreground">Completed</p>
        </div>
        <div className="card-brutal text-center">
          <BarChart className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-3xl font-bold">
            {analytics?.avgRounds ? analytics.avgRounds.toFixed(1) : "0"}
          </p>
          <p className="text-sm text-muted-foreground">Avg Rounds</p>
        </div>
        <div className="card-brutal text-center">
          <Package className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-3xl font-bold">{analytics?.activeEntitlements || 0}</p>
          <p className="text-sm text-muted-foreground">Active Licenses</p>
        </div>
      </div>

      {/* Deals by Status */}
      <div className="card-brutal">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Deals by Status
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {analytics?.dealsByStatus &&
            Object.entries(analytics.dealsByStatus).map(([status, count]) => (
              <div key={status} className="text-center p-3 bg-muted/30 border border-border">
                <p className="text-lg font-bold">{count}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {status.toLowerCase().replace("_", " ")}
                </p>
              </div>
            ))}
        </div>
      </div>

      {/* Deals by Skill */}
      <div className="card-brutal">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Deals by Skill
        </h3>
        {analytics?.dealsBySkill && analytics.dealsBySkill.length > 0 ? (
          <div className="space-y-3">
            {analytics.dealsBySkill.map((item) => (
              <div key={item.skillName} className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium">{item.skillName}</div>
                <div className="flex-1 h-4 bg-muted/30 border border-border">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${(item.count / Math.max(...analytics.dealsBySkill.map((s) => s.count))) * 100}%`,
                    }}
                  />
                </div>
                <div className="w-12 text-right text-sm font-medium">{item.count}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No data available</p>
        )}
      </div>

      {/* Deals by Jurisdiction */}
      <div className="card-brutal">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Deals by Jurisdiction
        </h3>
        {analytics?.dealsByJurisdiction && analytics.dealsByJurisdiction.length > 0 ? (
          <div className="grid grid-cols-3 gap-4">
            {analytics.dealsByJurisdiction.map((item) => (
              <div key={item.jurisdiction} className="flex items-center gap-3 p-3 bg-muted/30 border border-border">
                <Globe className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">{item.jurisdiction.replace("_", " ")}</p>
                </div>
                <Badge variant="outline">{item.count}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No data available</p>
        )}
      </div>
    </div>
  );
}
