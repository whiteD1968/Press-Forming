"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

type ReviewItem = {
  id: string;
  code: string | null;
  title: string;
  researcher_name: string | null;
  created_at: string;
  status: "draft" | "submitted" | "reviewed" | "published";
};

export default function ReviewPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [message, setMessage] = useState("Loading...");

  async function load() {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setMessage("Administrator access required.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (profile?.role !== "admin") {
      setMessage("Administrator access required.");
      return;
    }

    setIsAdmin(true);
    const { data, error } = await supabase
      .from("experiments")
      .select("id, code, title, researcher_name, created_at, status")
      .in("status", ["submitted", "reviewed"])
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      return;
    }

    setItems((data ?? []) as ReviewItem[]);
    setMessage((data ?? []).length ? "" : "No submissions are waiting for review.");
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: "reviewed" | "published" | "draft") {
    const supabase = createClient();
    const { error } = await supabase.from("experiments").update({ status }).eq("id", id);
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
        <h1>Submission queue</h1>
        <p>Submitted and reviewed experiments remain here until an administrator returns, reviews, or publishes them.</p>
      </div>
      {message && <div className="notice">{message}</div>}
      <div className="review-list">
        {items.map((item) => (
          <article key={item.id} className="review-row">
            <div>
              <strong>{item.code}</strong>
              <Link href={`/experiments/${item.id}`}>{item.title}</Link>
              <small>{item.researcher_name || "No researcher"} / {new Date(item.created_at).toLocaleDateString()} / {item.status}</small>
            </div>
            <div className="review-actions">
              <Link href={`/experiments/${item.id}`}>Open</Link>
              <button type="button" onClick={() => setStatus(item.id, "draft")}>Return to Draft</button>
              <button type="button" onClick={() => setStatus(item.id, "reviewed")}>Mark Reviewed</button>
              <button className="primary-small" type="button" onClick={() => setStatus(item.id, "published")}>Publish</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
