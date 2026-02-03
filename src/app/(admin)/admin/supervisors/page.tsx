"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { format } from "date-fns";
import {
  UserCog,
  Plus,
  Search,
  AlertCircle,
  Loader2,
  Check,
  X,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SupervisorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  const utils = trpc.useUtils();
  const { data: supervisors, isLoading, error } = trpc.platformAdmin.listSupervisors.useQuery();

  const createMutation = trpc.platformAdmin.createSupervisor.useMutation({
    onSuccess: () => {
      utils.platformAdmin.listSupervisors.invalidate();
      setShowCreateForm(false);
      setNewEmail("");
      setNewName("");
    },
  });

  const toggleActiveMutation = trpc.platformAdmin.toggleSupervisorActive.useMutation({
    onSuccess: () => {
      utils.platformAdmin.listSupervisors.invalidate();
    },
  });

  const filteredSupervisors = supervisors?.filter(
    (s) =>
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ email: newEmail, name: newName || undefined });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Supervisors</h1>
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
          <span>Failed to load supervisors: {error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Supervisors</h1>
          <p className="text-muted-foreground mt-1">
            Manage supervising attorney accounts
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn-brutal flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Supervisor
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="card-brutal border-primary">
          <h3 className="font-semibold mb-4">Create New Supervisor</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="supervisor@lawfirm.com"
                  className="input-brutal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name (optional)</Label>
                <Input
                  id="name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jane Smith"
                  className="input-brutal"
                />
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
                disabled={createMutation.isPending || !newEmail}
                className="btn-brutal flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Create Supervisor
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
          placeholder="Search supervisors..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-brutal pl-10"
        />
      </div>

      {/* Supervisors List */}
      {filteredSupervisors?.length === 0 ? (
        <div className="card-brutal text-center py-12">
          <UserCog className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No supervisors found</h2>
          <p className="text-muted-foreground">
            {searchQuery ? "Try a different search term" : "Add your first supervisor to get started"}
          </p>
        </div>
      ) : (
        <div className="border border-border">
          <div className="grid grid-cols-5 gap-4 p-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase">
            <div>Supervisor</div>
            <div>Status</div>
            <div>Assigned Deals</div>
            <div>Created</div>
            <div>Actions</div>
          </div>
          {filteredSupervisors?.map((supervisor) => (
            <div
              key={supervisor.id}
              className="grid grid-cols-5 gap-4 p-3 border-t border-border items-center text-sm"
            >
              <div>
                <p className="font-medium">{supervisor.name || "No name"}</p>
                <p className="text-muted-foreground text-xs">{supervisor.email}</p>
              </div>
              <div>
                {supervisor.isActive ? (
                  <Badge className="bg-green-500/20 text-green-500">Active</Badge>
                ) : (
                  <Badge className="bg-muted text-muted-foreground">Inactive</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span>{supervisor._count.assignments} deals</span>
              </div>
              <div className="text-muted-foreground">
                {format(new Date(supervisor.createdAt), "MMM d, yyyy")}
              </div>
              <div>
                <button
                  onClick={() =>
                    toggleActiveMutation.mutate({
                      supervisorId: supervisor.id,
                      isActive: !supervisor.isActive,
                    })
                  }
                  disabled={toggleActiveMutation.isPending}
                  className={`px-3 py-1 text-xs border transition-colors ${
                    supervisor.isActive
                      ? "border-yellow-500 text-yellow-600 hover:bg-yellow-500/10"
                      : "border-green-500 text-green-500 hover:bg-green-500/10"
                  }`}
                >
                  {supervisor.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
