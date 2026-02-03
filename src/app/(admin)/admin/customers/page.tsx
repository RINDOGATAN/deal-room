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
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newType, setNewType] = useState<"SAAS" | "SELF_HOSTED">("SAAS");

  const utils = trpc.useUtils();
  const { data: customers, isLoading, error } = trpc.platformAdmin.listCustomers.useQuery({
    search: searchQuery,
  });

  const createMutation = trpc.platformAdmin.createCustomer.useMutation({
    onSuccess: () => {
      utils.platformAdmin.listCustomers.invalidate();
      setShowCreateForm(false);
      setNewName("");
      setNewEmail("");
      setNewType("SAAS");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name: newName, email: newEmail, type: newType });
  };

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
      <div className="card-brutal border-yellow-500">
        <div className="flex items-center gap-3 text-yellow-600">
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
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn-brutal flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="card-brutal border-primary">
          <h3 className="font-semibold mb-4">Create New Customer</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Acme Corporation"
                  className="input-brutal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="billing@acme.com"
                  className="input-brutal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Customer Type *</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as "SAAS" | "SELF_HOSTED")}>
                  <SelectTrigger className="input-brutal w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAAS">SaaS (Cloud)</SelectItem>
                    <SelectItem value="SELF_HOSTED">Self-Hosted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-border text-sm hover:bg-muted/50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !newName || !newEmail}
                className="btn-brutal flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Create Customer
              </button>
            </div>
            {createMutation.error && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500 text-yellow-600 text-sm">
                {createMutation.error.message}
              </div>
            )}
          </form>
        </div>
      )}

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
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="px-3 py-1 text-xs border border-border hover:bg-muted/50 inline-block"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
