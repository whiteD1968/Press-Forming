import Link from "next/link";
import { createClient } from "../../lib/supabase/server";
import { getResearchAccessState, isApprovedState } from "../../lib/access";
import { ExperimentIndexClient } from "../../components/ExperimentIndexClient";

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
      .select("id, code, title, research_question, research_objective, summary, observations, conclusion, status, visibility, material_name, material_condition, thickness_mm, forming_method, geometry_type, undercut_type, outcome, researcher_name, created_at, experiment_stages(count)")
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

      <ExperimentIndexClient approved={approved} experiments={experiments.map((experiment) => ({ ...experiment, stage_count: experiment.experiment_stages?.[0]?.count ?? 0 }))} />
    </section>
  );
}
