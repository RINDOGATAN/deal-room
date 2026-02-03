"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  Package,
  Building,
  Server,
  Plus,
  Globe,
  Calendar,
  Hash,
  PauseCircle,
  PlayCircle,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AssignSkillModal } from "@/components/admin/AssignSkillModal";
import Link from "next/link";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingJurisdictionsId, setEditingJurisdictionsId] = useState<string | null>(null);
  const [editedJurisdictions, setEditedJurisdictions] = useState<string[]>([]);

  const utils = trpc.useUtils();
  const { data: customer, isLoading, error } = trpc.platformAdmin.getCustomer.useQuery({
    customerId,
  });

  const suspendMutation = trpc.platformAdmin.suspendEntitlement.useMutation({
    onSuccess: () => {
      utils.platformAdmin.getCustomer.invalidate({ customerId });
    },
  });

  const reactivateMutation = trpc.platformAdmin.reactivateEntitlement.useMutation({
    onSuccess: () => {
      utils.platformAdmin.getCustomer.invalidate({ customerId });
    },
  });

  const updateJurisdictionsMutation = trpc.platformAdmin.updateEntitlementJurisdictions.useMutation({
    onSuccess: () => {
      utils.platformAdmin.getCustomer.invalidate({ customerId });
      setEditingJurisdictionsId(null);
    },
  });

  const startEditJurisdictions = (entitlementId: string, currentJurisdictions: string[]) => {
    setEditingJurisdictionsId(entitlementId);
    setEditedJurisdictions([...currentJurisdictions]);
  };

  const cancelEditJurisdictions = () => {
    setEditingJurisdictionsId(null);
    setEditedJurisdictions([]);
  };

  const saveJurisdictions = (entitlementId: string) => {
    if (editedJurisdictions.length === 0) return;
    updateJurisdictionsMutation.mutate({
      entitlementId,
      jurisdictions: editedJurisdictions,
    });
  };

  const toggleEditedJurisdiction = (jurisdiction: string) => {
    setEditedJurisdictions((prev) =>
      prev.includes(jurisdiction)
        ? prev.filter((j) => j !== jurisdiction)
        : [...prev, jurisdiction]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-500/20 text-green-500">Active</Badge>;
      case "SUSPENDED":
        return <Badge className="bg-orange-500/20 text-orange-500">Suspended</Badge>;
      case "EXPIRED":
        return <Badge className="bg-red-500/20 text-red-500">Expired</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">{status}</Badge>;
    }
  };

  const getLicenseTypeBadge = (type: string) => {
    switch (type) {
      case "TRIAL":
        return <Badge className="bg-yellow-500/20 text-yellow-500">Trial</Badge>;
      case "SUBSCRIPTION":
        return <Badge className="bg-blue-500/20 text-blue-500">Subscription</Badge>;
      case "PERPETUAL":
        return <Badge className="bg-purple-500/20 text-purple-500">Perpetual</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/customers" className="p-2 hover:bg-muted/50 border border-border">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold">Loading...</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/customers" className="p-2 hover:bg-muted/50 border border-border">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold">Customer Not Found</h1>
        </div>
        <div className="card-brutal border-destructive">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span>{error?.message || "Customer not found"}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/customers" className="p-2 hover:bg-muted/50 border border-border">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{customer.name}</h1>
            <p className="text-muted-foreground">{customer.email}</p>
          </div>
        </div>
        <button
          onClick={() => setShowAssignModal(true)}
          className="btn-brutal flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Skill
        </button>
      </div>

      {/* Customer Info */}
      <div className="card-brutal">
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Type</p>
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
          <div>
            <p className="text-sm text-muted-foreground mb-1">Customer Since</p>
            <p className="font-medium">{format(new Date(customer.createdAt), "MMM d, yyyy")}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Entitlements</p>
            <p className="font-medium">{customer.entitlements.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Active Entitlements</p>
            <p className="font-medium">
              {customer.entitlements.filter((e) => e.status === "ACTIVE").length}
            </p>
          </div>
        </div>
      </div>

      {/* Entitlements */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Skill Entitlements</h2>
        {customer.entitlements.length === 0 ? (
          <div className="card-brutal text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No entitlements yet</h3>
            <p className="text-muted-foreground mb-4">
              Assign a skill to this customer to get started
            </p>
            <button
              onClick={() => setShowAssignModal(true)}
              className="btn-brutal inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Skill
            </button>
          </div>
        ) : (
          <div className="border border-border">
            <div className="grid grid-cols-7 gap-4 p-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase">
              <div>Skill</div>
              <div>License Type</div>
              <div>Status</div>
              <div>Jurisdictions</div>
              <div>Activations</div>
              <div>Expires</div>
              <div>Actions</div>
            </div>
            {customer.entitlements.map((entitlement) => (
              <div
                key={entitlement.id}
                className="grid grid-cols-7 gap-4 p-3 border-t border-border items-center text-sm"
              >
                <div>
                  <p className="font-medium">{entitlement.skillPackage.displayName}</p>
                  <p className="text-muted-foreground text-xs">{entitlement.skillPackage.skillId}</p>
                </div>
                <div>{getLicenseTypeBadge(entitlement.licenseType)}</div>
                <div>{getStatusBadge(entitlement.status)}</div>
                <div>
                  {editingJurisdictionsId === entitlement.id ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {entitlement.skillPackage.jurisdictions.map((j) => (
                          <button
                            key={j}
                            type="button"
                            onClick={() => toggleEditedJurisdiction(j)}
                            className={`px-2 py-0.5 text-xs border rounded transition-colors ${
                              editedJurisdictions.includes(j)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border hover:bg-muted"
                            }`}
                          >
                            {j}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveJurisdictions(entitlement.id)}
                          disabled={updateJurisdictionsMutation.isPending || editedJurisdictions.length === 0}
                          className="p-1 text-green-500 hover:bg-green-500/10 rounded disabled:opacity-50"
                          title="Save"
                        >
                          {updateJurisdictionsMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={cancelEditJurisdictions}
                          className="p-1 text-muted-foreground hover:bg-muted rounded"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {entitlement.jurisdictions.map((j) => (
                        <Badge key={j} variant="outline" className="text-xs">
                          {j}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Hash className="w-3 h-3 text-muted-foreground" />
                  <span>
                    {entitlement._count.activations} / {entitlement.maxActivations}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  {entitlement.expiresAt ? (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(entitlement.expiresAt), "MMM d, yyyy")}
                    </span>
                  ) : (
                    <span className="text-xs">Never</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {editingJurisdictionsId !== entitlement.id && (
                    <button
                      onClick={() => startEditJurisdictions(entitlement.id, entitlement.jurisdictions)}
                      className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      title="Edit jurisdictions"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                  {entitlement.status === "ACTIVE" ? (
                    <button
                      onClick={() => suspendMutation.mutate({ entitlementId: entitlement.id })}
                      disabled={suspendMutation.isPending}
                      className="p-1 text-orange-500 hover:bg-orange-500/10 rounded"
                      title="Suspend"
                    >
                      {suspendMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <PauseCircle className="w-4 h-4" />
                      )}
                    </button>
                  ) : entitlement.status === "SUSPENDED" ? (
                    <button
                      onClick={() => reactivateMutation.mutate({ entitlementId: entitlement.id })}
                      disabled={reactivateMutation.isPending}
                      className="p-1 text-green-500 hover:bg-green-500/10 rounded"
                      title="Reactivate"
                    >
                      {reactivateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <PlayCircle className="w-4 h-4" />
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Skill Modal */}
      <AssignSkillModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        preSelectedCustomerId={customerId}
        onSuccess={() => utils.platformAdmin.getCustomer.invalidate({ customerId })}
      />
    </div>
  );
}
