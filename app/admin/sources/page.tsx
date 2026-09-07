"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

type SourceItem = {
  id: string;
  title: string;
  source_type: string;
  url: string | null;
  principle: string | null;
  is_published: boolean;
  created_at: string;
};

export default function AdminSourcesPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [sources, setSources] = useState<SourceItem[]>([]);
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
      .from("research_sources")
      .select("id, title, source_type, url, principle, is_published, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setSources((data ?? []) as SourceItem[]);
    setMessage("");
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePublished(source: SourceItem) {
    const supabase = createClient();
    const { error } = await supabase
      .from("research_sources")
      .update({ is_published: !source.is_published })
      .eq("id", source.id);

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
          <h1>Research sources</h1>
          <p>Maintain which lineage references appear publicly in the research atlas.</p>
        </div>
        <Link className="button" href="/atlas">Open Atlas</Link>
      </div>
      {message && <div className="notice">{message}</div>}
      <div className="admin-table">
        <div className="admin-table-head source-row">
          <span>Title</span><span>Type</span><span>Principle</span><span>Status</span><span>Action</span>
        </div>
        {sources.map((source) => (
          <div className="source-row" key={source.id}>
            <span>{source.url ? <a href={source.url}>{source.title}</a> : source.title}</span>
            <span>{source.source_type}</span>
            <span>{source.principle || "-"}</span>
            <span>{source.is_published ? "Published" : "Hidden"}</span>
            <span><button type="button" onClick={() => togglePublished(source)}>{source.is_published ? "Hide" : "Publish"}</button></span>
          </div>
        ))}
      </div>
    </section>
  );
}
