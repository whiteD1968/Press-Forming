"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

type Role = "student" | "research_assistant" | "admin";
type ApprovalStatus = "pending" | "approved" | "rejected";
type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  affiliation: string | null;
  role: Role;
  is_active: boolean;
  approval_status: ApprovalStatus;
  approval_requested_at: string | null;
  approved_at: string | null;
  created_at: string;
  rejection_reason: string | null;
};

const roleLabels: Record<Role, string> = {
  student: "Student",
  research_assistant: "Research Assistant",
  admin: "Administrator",
};

export default function ResearchersAdminPage() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState("Loading...");
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "deactivated">("pending");

  async function load() {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setMessage("Administrator access required.");
      return;
    }

    setCurrentUserId(auth.user.id);
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("role, approval_status, is_active")
      .eq("id", auth.user.id)
      .single();

    if (currentProfile?.role !== "admin" || currentProfile.approval_status !== "approved" || currentProfile.is_active === false) {
      setMessage("Administrator access required.");
      return;
    }

    setIsAdmin(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, affiliation, role, is_active, approval_status, approval_requested_at, approved_at, created_at, rejection_reason")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setProfiles((data ?? []) as Profile[]);
    setMessage("");
  }

  useEffect(() => {
    load();
  }, []);

  const sections = useMemo(() => ({
    pending: profiles.filter((profile) => profile.approval_status === "pending"),
    approved: profiles.filter((profile) => profile.approval_status === "approved" && profile.is_active),
    rejected: profiles.filter((profile) => profile.approval_status === "rejected"),
    deactivated: profiles.filter((profile) => profile.approval_status === "approved" && !profile.is_active),
  }), [profiles]);

  async function updateProfile(id: string, changes: Partial<Profile>) {
    if (id === currentUserId && ("is_active" in changes || "approval_status" in changes || "role" in changes)) {
      setMessage("You cannot change your own administrator access here.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("profiles").update(changes).eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await load();
  }

  async function approve(id: string, role: Role) {
    await updateProfile(id, {
      approval_status: "approved",
      role,
      approved_at: new Date().toISOString(),
      approved_by: currentUserId,
      rejected_at: null,
      rejection_reason: null,
      is_active: true,
    } as Partial<Profile>);
  }

  async function reject(id: string) {
    if (id === currentUserId) {
      setMessage("You cannot reject your own administrator account here.");
      return;
    }
    if (!window.confirm("Reject this research access request? The account and attribution will be preserved.")) return;
    const reason = window.prompt("Optional rejection reason") || null;
    await updateProfile(id, {
      approval_status: "rejected",
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    } as Partial<Profile>);
  }

  if (!isAdmin) {
    return (
      <section className="page-shell narrow-shell">
        <div className="notice">{message}</div>
      </section>
    );
  }

  const rows = sections[tab];

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Administration</p>
        <h1>Researchers</h1>
        <p>Approve access, preserve attribution, and temporarily deactivate researchers without deleting accounts.</p>
      </div>

      <div className="filter-bar">
        {(["pending", "approved", "rejected", "deactivated"] as const).map((key) => (
          <button className={tab === key ? "button primary" : "button secondary"} type="button" onClick={() => setTab(key)} key={key}>
            {key.toUpperCase()} ({sections[key].length})
          </button>
        ))}
      </div>

      {message && <div className="notice">{message}</div>}

      <div className="admin-table">
        <div className="admin-table-head researcher-row researcher-row-wide">
          <span>Name</span><span>Email</span><span>Affiliation</span><span>Role</span><span>Approval</span><span>Account</span><span>Requested</span><span>Approved</span><span>Joined</span><span>Action</span>
        </div>
        {rows.map((profile) => (
          <div className="researcher-row researcher-row-wide" key={profile.id}>
            <span>{profile.full_name || "No name"}</span>
            <span>{profile.email || "-"}</span>
            <span>{profile.affiliation || "-"}</span>
            <span>{roleLabels[profile.role]}</span>
            <span>{profile.approval_status}</span>
            <span>{profile.is_active ? "Active" : "Inactive"}</span>
            <span>{profile.approval_requested_at ? new Date(profile.approval_requested_at).toLocaleDateString() : "-"}</span>
            <span>{profile.approved_at ? new Date(profile.approved_at).toLocaleDateString() : "-"}</span>
            <span>{new Date(profile.created_at).toLocaleDateString()}</span>
            <span className="inline-actions">
              {profile.approval_status !== "approved" && (
                <>
                  <button type="button" onClick={() => approve(profile.id, "student")}>Approve Student</button>
                  <button type="button" onClick={() => approve(profile.id, "research_assistant")}>Approve RA</button>
                </>
              )}
              {profile.approval_status === "pending" && <button type="button" onClick={() => reject(profile.id)}>Reject</button>}
              {profile.approval_status === "approved" && profile.is_active && (
                <button type="button" disabled={profile.id === currentUserId} onClick={() => updateProfile(profile.id, { is_active: false } as Partial<Profile>)}>Deactivate</button>
              )}
              {profile.approval_status === "approved" && !profile.is_active && (
                <button type="button" onClick={() => updateProfile(profile.id, { is_active: true } as Partial<Profile>)}>Reactivate</button>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
