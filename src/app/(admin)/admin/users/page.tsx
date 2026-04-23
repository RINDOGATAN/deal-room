"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { format } from "date-fns";
import {
  UserCheck,
  Search,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: users, isLoading, error } = trpc.platformAdmin.listUsers.useQuery();

  const filteredUsers = users?.filter(
    (u) =>
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAuthMethod = (accounts: { provider: string }[]) => {
    if (accounts.some((a) => a.provider === "google")) {
      return "google";
    }
    return "magic-link";
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Users</h1>
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
          <span>Failed to load users: {error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground mt-1">
          Platform users who have signed in via SSO or magic link
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name, email, or company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-brutal pl-10"
        />
      </div>

      {/* Users List */}
      {filteredUsers?.length === 0 ? (
        <div className="card-brutal text-center py-12">
          <UserCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No users found</h2>
          <p className="text-muted-foreground">
            {searchQuery ? "Try a different search term" : "No users have signed in yet"}
          </p>
        </div>
      ) : (
        <div className="border border-border">
          <div className="grid grid-cols-6 gap-4 p-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase">
            <div>User</div>
            <div>Company</div>
            <div>Auth Method</div>
            <div>Deals</div>
            <div>Last sign-in</div>
            <div>Joined</div>
          </div>
          {filteredUsers?.map((user) => {
            const authMethod = getAuthMethod(user.accounts);
            return (
              <div
                key={user.id}
                className="grid grid-cols-6 gap-4 p-3 border-t border-border items-center text-sm"
              >
                <div>
                  <p className="font-medium">{user.name || "No name"}</p>
                  <p className="text-muted-foreground text-xs">{user.email}</p>
                </div>
                <div className="text-muted-foreground">
                  {user.company || "—"}
                </div>
                <div>
                  {authMethod === "google" ? (
                    <Badge className="bg-green-500/20 text-green-500">Google SSO</Badge>
                  ) : (
                    <Badge className="bg-blue-500/20 text-blue-500">Magic Link</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span>{user._count.dealRoomParties}</span>
                </div>
                <div className="text-muted-foreground">
                  {user.lastLoginAt
                    ? format(new Date(user.lastLoginAt), "MMM d, yyyy")
                    : "—"}
                </div>
                <div className="text-muted-foreground">
                  {format(new Date(user.createdAt), "MMM d, yyyy")}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
