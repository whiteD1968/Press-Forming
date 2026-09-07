"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import { StatusPill } from "../../../components/StatusPill";

type ExperimentStatus = "draft" | "submitted" | "reviewed" | "published" | "archived";
type Experiment = {
  id: string;
  code: string | null;
  title: string;
  researcher_name: string | null;
  material_name: string | null;
  status: ExperimentStatus;
  visibility: "internal" | "public";
  created_at: string;
};

const statuses: ExperimentStatus[] = ["draft", "submitted", "reviewed", "published", "archived"];

export default function AdminExperimentsPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<Experiment[]>([]);
  const [filter, setFilter] = useState<"all" | ExperimentStatus>("all");
  const [message, setMessage] = useState("Loading...");

  async function load() {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setMessage("Administrator access required.");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
    if (profile?.role !== "admin") {
      setMessage("Administrator access required.");
      return;
    }

    setIsAdmin(true);
    const { data, error } = await supabase
      .from("experiments")
      .select("id, code, title, researcher_name, material_name, status, visibility, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setItems((data ?? []) as Experiment[]);
    setMessage("");
  }

  useEffect(() => {
    load();
  }, []);

  const filteredItems = useMemo(
    () => filter === "all" ? items : items.filter((item) => item.status === filter),
    [filter, items]
  );

  async function updateStatus(id: string, status: ExperimentStatus) {
    const supabase = createClient();
    const { error } = await supabase.from("experiments").update({ status }).eq("id", id);
    if (error) {
      setMessage(error.message);
      return;
    }
    await load();
  }

  async function updateVisibility(id: string, visibility: "internal" | "public") {
    if (visibility === "public" && !window.confirm("Make this record visible on the public internet?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("experiments").update({ visibility }).eq("id", id);
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
      <div className="page-heading split-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Experiments</h1>
          <p>All experiments remain in the archive. Status changes are reversible and no permanent deletion controls are exposed here.</p>
        </div>
        <select className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value as "all" | ExperimentStatus)}>
          <option value="all">All statuses</option>
          {statuses.map((status) => <option value={status} key={status}>{status}</option>)}
        </select>
      </div>
      {message && <div className="notice">{message}</div>}
      <div className="admin-table">
        <div className="admin-table-head experiment-admin-row">
          <span>Code</span><span>Title</span><span>Researcher</span><span>Material</span><span>Status</span><span>Visibility</span><span>Date</span><span>Actions</span>
        </div>
        {filteredItems.map((item) => (
          <div className="experiment-admin-row" key={item.id}>
            <span>{item.code}</span>
            <span>{item.title}</span>
            <span>{item.researcher_name || "-"}</span>
            <span>{item.material_name || "-"}</span>
            <span><StatusPill status={item.status} /></span>
            <span className="status-pill">{item.visibility.toUpperCase()}</span>
            <span>{new Date(item.created_at).toLocaleDateString()}</span>
            <span className="inline-actions">
              <Link href={`/experiments/${item.id}`}>View</Link>
              <Link href={`/experiments/${item.id}/edit`}>Edit</Link>
              <select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value as ExperimentStatus)}>
                {statuses.map((status) => <option value={status} key={status}>{status}</option>)}
              </select>
              <select value={item.visibility} onChange={(event) => updateVisibility(item.id, event.target.value as "internal" | "public")}>
                <option value="internal">Internal</option>
                <option value="public">Public</option>
              </select>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
