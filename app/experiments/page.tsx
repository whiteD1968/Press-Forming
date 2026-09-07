import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import { StatusPill } from "../../components/StatusPill";
import { getResearchAccessState, isApprovedState } from "../../lib/access";

export const dynamic = "force-dynamic";

export default async function ExperimentsPage() {
  const access = await getResearchAccessState();
  const approved = isApprovedState(access.state);
  let experiments: any[] = [];
  let errorMessage = "";

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("experiments")
      .select("id, code, title, summary, status, visibility, material_name, thickness_mm, outcome, created_at")
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
          <p>{approved ? "Successful, partial, failed, and unexpected outcomes all remain part of the research record." : "Selected public research from Forming Material."}</p>
        </div>
        {approved ? <Link className="button primary" href="/submit">+ New experiment</Link> : <Link className="button primary" href="/login">Sign In</Link>}
      </div>

      {errorMessage && <div className="notice">{approved ? errorMessage : "Selected research from Forming Material will appear here when released publicly."}</div>}

      {!errorMessage && experiments.length === 0 && (
        <div className="empty-state">
          <strong>{approved ? "No experiments yet." : "Selected research from Forming Material will appear here when released publicly."}</strong>
          <p>{approved ? "Create FM-001 to test the complete research workflow." : "Sign in or request access to view the working research archive."}</p>
          {!approved && <div className="hero-actions"><Link className="button primary" href="/login">Sign In</Link><Link className="button" href="/login">Request Research Access</Link></div>}
        </div>
      )}

      {approved && experiments.length > 0 && (
        <form className="form-panel" action="/experiments/compare">
          <div className="section-heading-row"><p className="section-index">Compare Experiments</p><button className="button" type="submit">Compare Selected</button></div>
          <div className="filter-bar">
            {experiments.map((experiment) => <label key={experiment.id}><input name="id" type="checkbox" value={experiment.id} /> {experiment.code || experiment.title}</label>)}
          </div>
        </form>
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
              <span>{experiment.material_name || "-"}</span>
              <span>{experiment.thickness_mm ? `${experiment.thickness_mm} mm` : "-"}</span>
              {experiment.outcome && <span>{experiment.outcome}</span>}
              <StatusPill status={experiment.status} />
              {approved && experiment.visibility && <span className="status-pill">{String(experiment.visibility).toUpperCase()}</span>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
