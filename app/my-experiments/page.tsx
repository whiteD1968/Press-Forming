import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import { StatusPill } from "../../components/StatusPill";

export const dynamic = "force-dynamic";

export default async function MyExperimentsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return (
      <section className="page-shell narrow-shell">
        <div className="notice">Sign in to view your experiments. <Link href="/login">Open researcher login</Link></div>
      </section>
    );
  }

  const { data: experiments, error } = await supabase
    .from("experiments")
    .select("id, code, title, created_at, status, outcome")
    .eq("researcher_id", auth.user.id)
    .order("created_at", { ascending: false });

  return (
    <section className="page-shell">
      <div className="page-heading split-heading">
        <div>
          <p className="eyebrow">Research Portal</p>
          <h1>My experiments</h1>
          <p>Your drafts, submitted studies, reviewed records, and published work.</p>
        </div>
        <Link className="button primary" href="/submit">+ New Experiment</Link>
      </div>
      {error && <div className="notice">{error.message}</div>}
      {!error && (experiments ?? []).length === 0 && <div className="empty-state"><strong>No experiments yet.</strong><p>Start a new test when the next material question is ready.</p></div>}
      <div className="admin-table">
        <div className="admin-table-head my-experiment-row">
          <span>Code</span><span>Title</span><span>Date</span><span>Status</span><span>Outcome</span><span>Actions</span>
        </div>
        {(experiments ?? []).map((experiment) => {
          const editable = experiment.status === "draft" || experiment.status === "submitted";
          return (
            <div className="my-experiment-row" key={experiment.id}>
              <span>{experiment.code}</span>
              <span>{experiment.title}</span>
              <span>{new Date(experiment.created_at).toLocaleDateString()}</span>
              <span><StatusPill status={experiment.status} /></span>
              <span>{experiment.outcome || "-"}</span>
              <span className="inline-actions">
                <Link href={`/experiments/${experiment.id}`}>Open</Link>
                {editable && <Link href={`/experiments/${experiment.id}/edit`}>Edit</Link>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
