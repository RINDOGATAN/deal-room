"use client";

import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  Users,
  FileText,
  Package,
  UserCog,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const router = useRouter();
  const { data: stats, isLoading, error } = trpc.platformAdmin.getDashboardStats.useQuery();

  useEffect(() => {
    if (error?.message?.includes("2FA verification required")) {
      router.push("/admin/verify");
    }
  }, [error, router]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Platform Admin Dashboard</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    if (error.message?.includes("2FA verification required")) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Platform Admin Dashboard</h1>
          </div>
          <div className="card-brutal text-center py-12">
            <p className="text-muted-foreground">Redirecting to verification...</p>
          </div>
        </div>
      );
    }
    return (
      <div className="card-brutal border-destructive">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load dashboard: {error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage customers, skills, and supervisors
          </p>
        </div>
        <Badge variant="outline" className="text-primary border-primary">
          <Shield className="w-3 h-3 mr-1" />
          Admin
        </Badge>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card-brutal text-center">
          <Users className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-3xl font-bold">{stats?.customerCount || 0}</p>
          <p className="text-sm text-muted-foreground">Customers</p>
        </div>
        <div className="card-brutal text-center">
          <FileText className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-3xl font-bold">{stats?.dealCount || 0}</p>
          <p className="text-sm text-muted-foreground">Total Deals</p>
        </div>
        <div className="card-brutal text-center">
          <Package className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-3xl font-bold">{stats?.skillCount || 0}</p>
          <p className="text-sm text-muted-foreground">Skills</p>
        </div>
        <div className="card-brutal text-center">
          <UserCog className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-3xl font-bold">{stats?.supervisorCount || 0}</p>
          <p className="text-sm text-muted-foreground">Supervisors</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-6">
        <Link href="/admin/supervisors" className="card-brutal group hover:border-primary transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/20 flex items-center justify-center">
                <UserCog className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold">Manage Supervisors</h3>
                <p className="text-sm text-muted-foreground">Create, assign, and manage supervisor accounts</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>

        <Link href="/admin/deals" className="card-brutal group hover:border-primary transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">All Deals</h3>
                <p className="text-sm text-muted-foreground">View and assign supervisors to deals</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>

        <Link href="/admin/customers" className="card-brutal group hover:border-primary transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Customer Management</h3>
                <p className="text-sm text-muted-foreground">Manage customers and skill entitlements</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>

        <Link href="/admin/skills" className="card-brutal group hover:border-primary transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 flex items-center justify-center">
                <Package className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold">Skills Marketplace</h3>
                <p className="text-sm text-muted-foreground">Manage installed skill packages</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>
      </div>

      {/* Deal Stats by Status */}
      {stats?.dealsByStatus && (
        <div className="card-brutal">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Deals by Status
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {Object.entries(stats.dealsByStatus).map(([status, count]) => (
              <div key={status} className="text-center p-3 bg-muted/30 border border-border">
                <p className="text-lg font-bold">{count}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {status.toLowerCase().replace("_", " ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <div className="card-brutal">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Recent Activity
          </h3>
          <div className="space-y-3">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <p>
                    <span className="font-medium">{activity.dealRoom?.name || "System"}</span>
                    {" - "}
                    <span className="text-muted-foreground">{activity.action.replace(/_/g, " ").toLowerCase()}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(activity.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
