"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function ReviewPage() {
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState("Loading…");

  async function load() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("experiments")
      .select("id, code, title, researcher_name, created_at, status")
      .in("status", ["submitted", "reviewed"])
      .order("created_at", { ascending: true });
    if (error) {
      setMessage(error.message);
      return;
    }
    setItems(data ?? []);
    setMessage((data ?? []).length ? "" : "No submissions are waiting for review.");
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: "reviewed" | "published" | "draft") {
    const supabase = createClient();
    const { error } = await supabase.from("experiments").update({ status }).eq("id", id);
    if (error) setMessage(error.message); else load();
  }

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Faculty / RA Review</p>
        <h1>Submission queue</h1>
        <p>Only accounts promoted to the administrator role can change another researcher’s publication status.</p>
      </div>
      {message && <div className="notice">{message}</div>}
      <div className="review-list">
        {items.map((item) => (
          <article key={item.id} className="review-row">
            <div><strong>{item.code}</strong><Link href={`/experiments/${item.id}`}>{item.title}</Link><small>{item.researcher_name}</small></div>
            <div className="review-actions">
              <button onClick={() => setStatus(item.id, "draft")}>Return to draft</button>
              <button onClick={() => setStatus(item.id, "reviewed")}>Mark reviewed</button>
              <button className="primary-small" onClick={() => setStatus(item.id, "published")}>Publish</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
