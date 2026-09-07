import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import { StatusPill } from "../../components/StatusPill";
import { requireApprovedUser } from "../../lib/access";

export const dynamic = "force-dynamic";

export default async function ExperimentsPage() {
  await requireApprovedUser();
  let experiments: any[] = [];
  let errorMessage = "";

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("experiments")
      .select("id, code, title, summary, status, material_name, thickness_mm, outcome, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    experiments = data ?? [];
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load experiments.";
  }

  return (
    <section className="page-shell">
      <div className="page-heading split-heading">
        <div>
          <p className="eyebrow">Experimental Archive</p>
          <h1>Experiments</h1>
          <p>Successful, partial, failed, and unexpected outcomes all remain part of the research record.</p>
        </div>
        <Link className="button primary" href="/submit">+ New experiment</Link>
      </div>

      {errorMessage && <div className="notice">Connect Supabase and run the schema to activate the archive. {errorMessage}</div>}

      {!errorMessage && experiments.length === 0 && (
        <div className="empty-state">
          <strong>No experiments yet.</strong>
          <p>Create FM-001 to test the complete research workflow.</p>
        </div>
      )}

      <div className="experiment-list">
        {experiments.map((experiment) => (
          <Link href={`/experiments/${experiment.id}`} className="experiment-row" key={experiment.id}>
            <div className="experiment-code">{experiment.code}</div>
            <div className="experiment-main">
              <h2>{experiment.title}</h2>
              <p>{experiment.summary || "No summary recorded."}</p>
            </div>
            <div className="experiment-meta">
              <span>{experiment.material_name || "—"}</span>
              <span>{experiment.thickness_mm ? `${experiment.thickness_mm} mm` : "—"}</span>
              {experiment.outcome && <span>{experiment.outcome}</span>}
              <StatusPill status={experiment.status} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
