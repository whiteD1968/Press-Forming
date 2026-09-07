"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

type Role = "student" | "research_assistant" | "admin";
type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
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
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (currentProfile?.role !== "admin") {
      setMessage("Administrator access required.");
      return;
    }

    setIsAdmin(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active, created_at")
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

  async function updateProfile(id: string, changes: Partial<Pick<Profile, "role" | "is_active">>) {
    if (id === currentUserId && changes.is_active === false) {
      setMessage("You cannot deactivate your own administrator account here.");
      return;
    }

    if (changes.is_active === false && !window.confirm("Deactivate this researcher? Existing research attribution will be preserved.")) {
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

  if (!isAdmin) {
    return (
      <section className="page-shell narrow-shell">
        <div className="notice">{message}</div>
      </section>
    );
  }

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Administration</p>
        <h1>Researchers</h1>
        <p>Deactivation prevents new submissions while preserving existing research attribution.</p>
      </div>
      {message && <div className="notice">{message}</div>}
      <div className="admin-table">
        <div className="admin-table-head researcher-row">
          <span>Name</span><span>Email</span><span>Role</span><span>Status</span><span>Joined</span><span>Action</span>
        </div>
        {profiles.map((profile) => (
          <div className="researcher-row" key={profile.id}>
            <span>{profile.full_name || "No name"}</span>
            <span>{profile.email || "-"}</span>
            <span>
              <select value={profile.role} onChange={(event) => updateProfile(profile.id, { role: event.target.value as Role })}>
                {Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </span>
            <span>{profile.is_active ? "Active" : "Inactive"}</span>
            <span>{new Date(profile.created_at).toLocaleDateString()}</span>
            <span>
              {profile.is_active ? (
                <button type="button" disabled={profile.id === currentUserId} onClick={() => updateProfile(profile.id, { is_active: false })}>Deactivate</button>
              ) : (
                <button type="button" onClick={() => updateProfile(profile.id, { is_active: true })}>Reactivate</button>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
