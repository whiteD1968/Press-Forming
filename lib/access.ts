import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type ResearchAccessState =
  | "public"
  | "pending"
  | "rejected"
  | "inactive"
  | "researcher"
  | "admin";

export type AccessProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  affiliation: string | null;
  role: string | null;
  is_active: boolean | null;
  approval_status: string | null;
  approval_requested_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  access_request_note: string | null;
};

export async function getResearchAccessState(): Promise<{ state: ResearchAccessState; profile: AccessProfile | null; userId: string | null }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return { state: "public", profile: null, userId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, affiliation, role, is_active, approval_status, approval_requested_at, approved_at, rejected_at, rejection_reason, access_request_note")
    .eq("id", auth.user.id)
    .single();

  if (!profile) return { state: "pending", profile: null, userId: auth.user.id };
  if (profile.approval_status === "rejected") return { state: "rejected", profile: profile as AccessProfile, userId: auth.user.id };
  if (profile.approval_status !== "approved") return { state: "pending", profile: profile as AccessProfile, userId: auth.user.id };
  if (profile.is_active === false) return { state: "inactive", profile: profile as AccessProfile, userId: auth.user.id };
  if (profile.role === "admin") return { state: "admin", profile: profile as AccessProfile, userId: auth.user.id };
  return { state: "researcher", profile: profile as AccessProfile, userId: auth.user.id };
}

export function isApprovedState(state: ResearchAccessState) {
  return state === "researcher" || state === "admin";
}

export async function requireApprovedUser() {
  const access = await getResearchAccessState();
  if (!isApprovedState(access.state)) redirect(access.state === "public" ? "/login" : "/access-status");
  return access;
}

export async function requireAdmin() {
  const access = await getResearchAccessState();
  if (access.state !== "admin") redirect(access.state === "public" ? "/login" : "/access-status");
  return access;
}
