"use client";
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Briefcase,
  Search,
  AlertCircle,
  Loader2,
  Plus,
  ChevronLeft,
  Save,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  SPECIALIZATIONS,
  SPECIALIZATION_LABELS,
  CERTIFICATIONS,
  CERTIFICATION_LABELS,
  EXPERT_TYPES,
  type Specialization,
  type Certification,
  type ExpertType,
} from "@/server/services/experts/taxonomy";

const expertTypeLabels: Record<ExpertType, string> = {
  TECHNICAL: "Technical",
  DEPLOYMENT: "Deployment",
};

type GoverningLaw = "CALIFORNIA" | "ENGLAND_WALES" | "SPAIN";
const governingLawValues: GoverningLaw[] = ["CALIFORNIA", "ENGLAND_WALES", "SPAIN"];
const governingLawLabels: Record<GoverningLaw, string> = {
  CALIFORNIA: "California, USA",
  ENGLAND_WALES: "England & Wales",
  SPAIN: "Spain",
};

const jurisdictionsCoveredOptions = ["EU", "UK", "US", "CA", "LATAM", "APAC"];

// ─── List View ──────────────────────────────────────────────────────────────

function ExpertsList({
  onSelect,
  onCreateNew,
}: {
  onSelect: (userId: string) => void;
  onCreateNew: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const { data: profiles, isLoading, error } = trpc.platformAdmin.listExpertProfiles.useQuery();

  const deleteMutation = trpc.platformAdmin.deleteExpertProfile.useMutation({
    onSuccess: () => {
      toast.success("Expert profile deleted");
      utils.platformAdmin.listExpertProfiles.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = profiles?.filter(
    (p) =>
      p.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.user.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-brutal border-yellow-500">
        <div className="flex items-center gap-3 text-yellow-600">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load experts: {error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expert Directory</h1>
          <p className="text-muted-foreground mt-1">
            Manage lawyer and expert profiles for the cross-product directory
          </p>
        </div>
        <button onClick={onCreateNew} className="btn-brutal flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Expert
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name, email, or firm..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-brutal pl-10"
        />
      </div>

      {filtered?.length === 0 ? (
        <div className="card-brutal text-center py-12">
          <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No expert profiles yet</h2>
          <p className="text-muted-foreground">
            {searchQuery
              ? "Try a different search term"
              : "Click \"New Expert\" to onboard a lawyer or expert"}
          </p>
        </div>
      ) : (
        <div className="border border-border">
          <div className="grid grid-cols-7 gap-4 p-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase">
            <div>Name</div>
            <div>Type</div>
            <div>Specializations</div>
            <div>Location</div>
            <div>Status</div>
            <div>Created</div>
            <div>Actions</div>
          </div>
          {filtered?.map((profile) => (
            <div
              key={profile.id}
              className="grid grid-cols-7 gap-4 p-3 border-t border-border items-center text-sm"
            >
              <button
                onClick={() => onSelect(profile.userId)}
                className="text-left hover:underline"
              >
                <p className="font-medium">{profile.user.name || "No name"}</p>
                <p className="text-muted-foreground text-xs">{profile.user.email}</p>
              </button>
              <div className="flex flex-wrap gap-1">
                {(profile.expertTypes ?? []).map((et: string) => (
                  <Badge
                    key={et}
                    className={
                      et === "TECHNICAL"
                        ? "bg-orange-500/20 text-orange-500"
                        : "bg-green-500/20 text-green-500"
                    }
                  >
                    {expertTypeLabels[et as ExpertType] || et}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {profile.specializations.slice(0, 2).map((s) => (
                  <span key={s} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {SPECIALIZATION_LABELS[s as Specialization] ?? s}
                  </span>
                ))}
                {profile.specializations.length > 2 && (
                  <span className="text-xs text-muted-foreground">
                    +{profile.specializations.length - 2}
                  </span>
                )}
              </div>
              <div className="text-muted-foreground text-xs">
                {[profile.city, profile.countryCode].filter(Boolean).join(", ") || "—"}
              </div>
              <div>
                {profile.isPublished ? (
                  <Badge className="bg-green-500/20 text-green-500">Published</Badge>
                ) : (
                  <Badge className="bg-muted text-muted-foreground">Draft</Badge>
                )}
              </div>
              <div className="text-muted-foreground text-xs">
                {format(new Date(profile.createdAt), "MMM d, yyyy")}
              </div>
              <div className="flex items-center gap-1">
                {confirmDeleteId === profile.userId ? (
                  <>
                    <span className="text-xs text-red-500 mr-1">Delete?</span>
                    <button
                      onClick={() => {
                        deleteMutation.mutate({ userId: profile.userId });
                        setConfirmDeleteId(null);
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                      title="Confirm delete"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => onSelect(profile.userId)}
                      className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      title="Edit"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(profile.userId)}
                      disabled={deleteMutation.isPending}
                      className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Edit / Create View ─────────────────────────────────────────────────────

function ExpertEditor({
  userId,
  onBack,
}: {
  userId: string | null; // null = creating new, pick a user first
  onBack: () => void;
}) {
  const utils = trpc.useUtils();

  // For "new expert" mode: pick a user
  const [selectedUserId, setSelectedUserId] = useState<string | null>(userId);
  const [userSearch, setUserSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: allUsers } = trpc.platformAdmin.listUsers.useQuery(undefined, {
    enabled: !userId,
  });

  // Load existing profile if editing
  const { data: existingProfile, isLoading: profileLoading } =
    trpc.platformAdmin.getExpertProfile.useQuery(
      { userId: selectedUserId! },
      { enabled: !!selectedUserId, retry: false }
    );

  // Form state
  const [bio, setBio] = useState("");
  const [jurisdictions, setJurisdictions] = useState<GoverningLaw[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [title, setTitle] = useState("");
  const [expertTypes, setExpertTypes] = useState<ExpertType[]>(["TECHNICAL"]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [countryCode, setCountryCode] = useState("");
  const [city, setCity] = useState("");
  const [jurisdictionsCovered, setJurisdictionsCovered] = useState<string[]>([]);
  const [contactUrl, setContactUrl] = useState("");
  const [acceptingClients, setAcceptingClients] = useState(true);

  useEffect(() => {
    if (existingProfile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrates the expert-profile edit form once from the fetched profile; the fields are user-editable afterwards so they cannot be derived during render
      setBio(existingProfile.bio || "");
      setJurisdictions(existingProfile.jurisdictions as GoverningLaw[]);
      setLanguages(existingProfile.languages);
      setIsPublished(existingProfile.isPublished);
      setTitle(existingProfile.title || "");
      // Filter out retired types (e.g. legacy "LEGAL") so a save can't
      // fail validation against the current EXPERT_TYPES vocabulary.
      setExpertTypes(
        ((existingProfile.expertTypes || []) as string[]).filter((t): t is ExpertType =>
          (EXPERT_TYPES as readonly string[]).includes(t)
        )
      );
      setSpecializations((existingProfile.specializations as Specialization[]) || []);
      setCertifications((existingProfile.certifications as Certification[]) || []);
      setCountryCode(existingProfile.countryCode || "");
      setCity(existingProfile.city || "");
      setJurisdictionsCovered(existingProfile.jurisdictionsCovered || []);
      setContactUrl(existingProfile.contactUrl || "");
      setAcceptingClients(existingProfile.acceptingClients ?? true);
    }
  }, [existingProfile]);

  const upsert = trpc.platformAdmin.upsertExpertProfile.useMutation({
    onSuccess: () => {
      toast.success("Expert profile saved");
      utils.platformAdmin.listExpertProfiles.invalidate();
      onBack();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.platformAdmin.deleteExpertProfile.useMutation({
    onSuccess: () => {
      toast.success("Expert profile deleted");
      utils.platformAdmin.listExpertProfiles.invalidate();
      onBack();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSave = () => {
    if (!selectedUserId) return;
    upsert.mutate({
      userId: selectedUserId,
      bio: bio || undefined,
      jurisdictions,
      languages: languages.length > 0 ? languages : ["en"],
      isPublished,
      title: title || undefined,
      expertTypes,
      specializations,
      certifications,
      countryCode: countryCode || undefined,
      city: city || undefined,
      jurisdictionsCovered,
      contactUrl: contactUrl || undefined,
      acceptingClients,
    });
  };

  const toggleArray = <T,>(arr: T[], val: T, setter: (v: T[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  // If creating new, show user picker first
  if (!selectedUserId) {
    const filteredUsers = allUsers?.filter(
      (u) =>
        u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.name?.toLowerCase().includes(userSearch.toLowerCase())
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">New Expert Profile</h1>
            <p className="text-muted-foreground mt-1">Select a user to create an expert profile for</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search users by name or email..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="input-brutal pl-10"
          />
        </div>

        <div className="border border-border max-h-96 overflow-y-auto">
          {filteredUsers?.map((user) => (
            <button
              key={user.id}
              onClick={() => setSelectedUserId(user.id)}
              className="w-full flex items-center justify-between p-3 border-b border-border text-sm text-left hover:bg-muted/20 transition-colors"
            >
              <div>
                <p className="font-medium">{user.name || "No name"}</p>
                <p className="text-muted-foreground text-xs">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {user.isLawyer && (
                  <Badge className="bg-blue-500/20 text-blue-500">Lawyer</Badge>
                )}
                {user.role && (
                  <Badge variant="outline" className="text-xs">
                    {user.role}
                  </Badge>
                )}
              </div>
            </button>
          ))}
          {filteredUsers?.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">No users found</p>
          )}
        </div>
      </div>
    );
  }

  if (profileLoading && userId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const canPublish = bio.trim().length > 0 && jurisdictions.length > 0;
  const selectedUser = existingProfile?.user || allUsers?.find((u) => u.id === selectedUserId);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">
              {userId ? "Edit Expert" : "New Expert"}
            </h1>
            {selectedUser && (
              <p className="text-muted-foreground mt-1">
                {selectedUser.name || selectedUser.email}
                {selectedUser.company && ` — ${selectedUser.company}`}
              </p>
            )}
          </div>
        </div>
        {userId && !confirmDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-red-500 hover:text-red-600 flex items-center gap-2 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Delete Profile
          </button>
        )}
        {userId && confirmDelete && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-500">Delete this profile?</span>
            <button
              onClick={() => deleteMutation.mutate({ userId: selectedUserId! })}
              disabled={deleteMutation.isPending}
              className="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              {deleteMutation.isPending ? "Deleting..." : "Confirm"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="card-brutal space-y-6">
        {/* Bio */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Expertise, experience, practice areas..."
            rows={4}
            maxLength={2000}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Partner, Data Protection"
            maxLength={200}
            className="input-brutal"
          />
        </div>

        {/* Expert Types (multi-select) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Expert Type</label>
          <div className="flex flex-wrap gap-2">
            {EXPERT_TYPES.map((et) => (
              <button
                key={et}
                onClick={() => toggleArray(expertTypes, et, setExpertTypes)}
                className={`px-3 py-1.5 text-sm border rounded-full transition-colors ${
                  expertTypes.includes(et)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {expertTypeLabels[et]}
              </button>
            ))}
          </div>
        </div>

        {/* Deal-room Jurisdictions */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Jurisdictions (Dealroom)</label>
          <div className="flex flex-wrap gap-2">
            {governingLawValues.map((j) => (
              <button
                key={j}
                onClick={() => toggleArray(jurisdictions, j, setJurisdictions)}
                className={`px-3 py-1.5 text-sm border rounded-full transition-colors ${
                  jurisdictions.includes(j)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {governingLawLabels[j]}
              </button>
            ))}
          </div>
        </div>

        {/* Languages */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Languages</label>
          <div className="flex flex-wrap gap-2">
            {(["en", "es", "de", "fr", "pt", "it"] as const).map((l) => (
              <button
                key={l}
                onClick={() => toggleArray(languages, l, setLanguages)}
                className={`px-3 py-1.5 text-sm border rounded-full transition-colors ${
                  languages.includes(l)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <hr className="border-border" />

        {/* Specializations */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Specializations</label>
          <div className="flex flex-wrap gap-2">
            {SPECIALIZATIONS.map((s) => (
              <button
                key={s}
                onClick={() => toggleArray(specializations, s, setSpecializations)}
                className={`px-3 py-1.5 text-xs border rounded-full transition-colors ${
                  specializations.includes(s)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {SPECIALIZATION_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Certifications */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Certifications</label>
          <div className="flex flex-wrap gap-2">
            {CERTIFICATIONS.map((c) => (
              <button
                key={c}
                onClick={() => toggleArray(certifications, c, setCertifications)}
                className={`px-3 py-1.5 text-xs border rounded-full transition-colors ${
                  certifications.includes(c)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {CERTIFICATION_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <hr className="border-border" />

        {/* Location */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Country (ISO code)</label>
            <Input
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="e.g. DE, ES, US"
              maxLength={2}
              className="input-brutal"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">City</label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Berlin, Madrid"
              maxLength={200}
              className="input-brutal"
            />
          </div>
        </div>

        {/* Jurisdictions Covered */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Jurisdictions Covered</label>
          <p className="text-xs text-muted-foreground">Regulatory regimes this expert advises on</p>
          <div className="flex flex-wrap gap-2">
            {jurisdictionsCoveredOptions.map((j) => (
              <button
                key={j}
                onClick={() => toggleArray(jurisdictionsCovered, j, setJurisdictionsCovered)}
                className={`px-3 py-1.5 text-sm border rounded-full transition-colors ${
                  jurisdictionsCovered.includes(j)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-foreground"
                }`}
              >
                {j}
              </button>
            ))}
          </div>
        </div>

        {/* Contact URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Contact / Booking URL</label>
          <Input
            value={contactUrl}
            onChange={(e) => setContactUrl(e.target.value)}
            placeholder="https://..."
            type="url"
            maxLength={500}
            className="input-brutal"
          />
        </div>

        <hr className="border-border" />

        {/* Accepting Clients */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAcceptingClients(!acceptingClients)}
            className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
              acceptingClients ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                acceptingClients ? "translate-x-5" : ""
              }`}
            />
          </button>
          <span className="text-sm font-medium">Accepting New Clients</span>
        </div>

        {/* Published */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => canPublish && setIsPublished(!isPublished)}
              disabled={!canPublish}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isPublished && canPublish ? "bg-green-500" : "bg-muted"
              } ${!canPublish ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  isPublished && canPublish ? "translate-x-5" : ""
                }`}
              />
            </button>
            <span className="text-sm font-medium">Published in Directory</span>
          </div>
          {!canPublish && (
            <p className="text-xs text-muted-foreground">
              Add a bio and at least one jurisdiction to publish
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-border hover:bg-muted transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={upsert.isPending}
          className="btn-brutal flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {upsert.isPending ? "Saving..." : "Save Expert"}
        </button>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ExpertsAdminPage() {
  const [view, setView] = useState<"list" | "edit" | "create">("list");
  const [editUserId, setEditUserId] = useState<string | null>(null);

  if (view === "edit" || view === "create") {
    return (
      <ExpertEditor
        userId={view === "edit" ? editUserId : null}
        onBack={() => {
          setView("list");
          setEditUserId(null);
        }}
      />
    );
  }

  return (
    <ExpertsList
      onSelect={(userId) => {
        setEditUserId(userId);
        setView("edit");
      }}
      onCreateNew={() => setView("create")}
    />
  );
}
