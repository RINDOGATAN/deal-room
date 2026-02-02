"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { format } from "date-fns";
import {
  Users,
  Search,
  AlertCircle,
  Loader2,
  Package,
  Building,
  Server,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: customers, isLoading, error } = trpc.platformAdmin.listCustomers.useQuery({
    search: searchQuery,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Customers</h1>
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
          <span>Failed to load customers: {error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground mt-1">
            Manage customers and their skill entitlements
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search customers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-brutal pl-10"
        />
      </div>

      {/* Customers List */}
      {customers?.length === 0 ? (
        <div className="card-brutal text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No customers found</h2>
          <p className="text-muted-foreground">
            {searchQuery ? "Try a different search term" : "No customers in the system yet"}
          </p>
        </div>
      ) : (
        <div className="border border-border">
          <div className="grid grid-cols-5 gap-4 p-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase">
            <div>Customer</div>
            <div>Type</div>
            <div>Entitlements</div>
            <div>Created</div>
            <div>Actions</div>
          </div>
          {customers?.map((customer) => (
            <div
              key={customer.id}
              className="grid grid-cols-5 gap-4 p-3 border-t border-border items-center text-sm"
            >
              <div>
                <p className="font-medium">{customer.name}</p>
                <p className="text-muted-foreground text-xs">{customer.email}</p>
              </div>
              <div>
                <Badge
                  className={
                    customer.type === "SAAS"
                      ? "bg-blue-500/20 text-blue-500"
                      : "bg-purple-500/20 text-purple-500"
                  }
                >
                  {customer.type === "SAAS" ? (
                    <Building className="w-3 h-3 mr-1" />
                  ) : (
                    <Server className="w-3 h-3 mr-1" />
                  )}
                  {customer.type}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span>{customer._count.entitlements} skills</span>
              </div>
              <div className="text-muted-foreground">
                {format(new Date(customer.createdAt), "MMM d, yyyy")}
              </div>
              <div>
                <button className="px-3 py-1 text-xs border border-border hover:bg-muted/50">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
