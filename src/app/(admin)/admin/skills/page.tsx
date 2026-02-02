"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { format } from "date-fns";
import {
  Package,
  Search,
  AlertCircle,
  Loader2,
  Globe,
  Languages,
  Check,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function SkillsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: skills, isLoading, error } = trpc.platformAdmin.listSkillPackages.useQuery();

  const filteredSkills = skills?.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.skillId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Skills Marketplace</h1>
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
          <span>Failed to load skills: {error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Skills Marketplace</h1>
          <p className="text-muted-foreground mt-1">
            Manage installed skill packages
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search skills..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-brutal pl-10"
        />
      </div>

      {/* Skills Grid */}
      {filteredSkills?.length === 0 ? (
        <div className="card-brutal text-center py-12">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No skills found</h2>
          <p className="text-muted-foreground">
            {searchQuery ? "Try a different search term" : "No skills installed yet"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filteredSkills?.map((skill) => (
            <div key={skill.id} className="card-brutal">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{skill.displayName}</h3>
                  <p className="text-muted-foreground text-sm">{skill.skillId}</p>
                </div>
                <Badge
                  className={
                    skill.isActive
                      ? "bg-green-500/20 text-green-500"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {skill.isActive ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Active
                    </>
                  ) : (
                    <>
                      <X className="w-3 h-3 mr-1" />
                      Inactive
                    </>
                  )}
                </Badge>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="font-mono">{skill.version}</span>
                </div>

                <div className="flex items-start gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {skill.jurisdictions.map((j) => (
                      <Badge key={j} variant="outline" className="text-xs">
                        {j}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Languages className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {skill.languages.map((l) => (
                      <Badge key={l} variant="outline" className="text-xs">
                        {l.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                  <span>Installed {format(new Date(skill.installedAt), "MMM d, yyyy")}</span>
                  <span>{skill._count.entitlements} entitlements</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
