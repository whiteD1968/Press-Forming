import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { StatusPill } from "../../../components/StatusPill";
import { getResearchAccessState, isApprovedState } from "../../../lib/access";

export const dynamic = "force-dynamic";

function csvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return `"${String(value).replaceAll('"', '""')}"`;
}

function experimentCsv(experiment: Record<string, unknown>, stages: Record<string, unknown>[]) {
  const experimentFields = [
    "code",
    "title",
    "status",
    "visibility",
    "material_name",
    "material_condition",
    "thickness_mm",
    "forming_method",
    "geometry_type",
    "undercut_type",
    "outcome",
    "research_question",
    "research_objective",
    "summary",
    "observations",
    "conclusion",
  ];
  const stageFields = [
    "stage_number",
    "title",
    "forming_operation",
    "tool_material",
    "press_force_tons",
    "constraint_type",
    "observations",
  ];
  const headers = ["row_type", ...experimentFields, ...stageFields];
  const experimentRow = ["experiment", ...experimentFields.map((field) => experiment[field]), ...stageFields.map(() => "")];
  const stageRows = stages.map((stage) => ["stage", ...experimentFields.map(() => ""), ...stageFields.map((field) => stage[field])]);
  return [headers, experimentRow, ...stageRows].map((row) => row.map(csvValue).join(",")).join("\r\n");
}

export default async function ExperimentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const access = await getResearchAccessState();
  const approved = isApprovedState(access.state);

  const { data: experiment } = await supabase
    .from("experiments")
    .select("*")
    .eq("id", id)
    .single();

  if (!experiment) {
    if (!approved) return <AccessRequired />;
    notFound();
  }

  const { data: profile } = auth.user
    ? await supabase.from("profiles").select("role").eq("id", auth.user.id).single()
    : { data: null };
  const isAdmin = profile?.role === "admin";
  const isOwner = auth.user?.id === experiment.researcher_id;
  const canEdit = isAdmin || (isOwner && (experiment.status === "draft" || experiment.status === "submitted"));

  const { data: stages } = await supabase
    .from("experiment_stages")
    .select("*")
    .eq("experiment_id", id)
    .order("stage_number", { ascending: true });

  const { data: media } = await supabase
    .from("experiment_media")
    .select("*")
    .eq("experiment_id", id)
    .order("display_order", { ascending: true });

  const [{ data: parentExperiment }, { data: childExperiments }, { data: relatedCandidates }] = await Promise.all([
    experiment.parent_experiment_id
      ? supabase.from("experiments").select("id, code, title").eq("id", experiment.parent_experiment_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("experiments").select("id, code, title").eq("parent_experiment_id", id).order("code", { ascending: true }),
    supabase.from("experiments").select("id, code, title, material_name, forming_method, geometry_type, undercut_type").neq("id", id).limit(80),
  ]);

  const relatedExperiments = (relatedCandidates ?? [])
    .map((candidate: any) => ({
      ...candidate,
      matchScore: [
        experiment.material_name && candidate.material_name === experiment.material_name,
        experiment.forming_method && candidate.forming_method === experiment.forming_method,
        experiment.geometry_type && candidate.geometry_type === experiment.geometry_type,
        experiment.undercut_type && candidate.undercut_type === experiment.undercut_type,
      ].filter(Boolean).length,
    }))
    .filter((candidate: any) => candidate.matchScore > 0)
    .sort((a: any, b: any) => b.matchScore - a.matchScore || String(a.code || "").localeCompare(String(b.code || "")))
    .slice(0, 6);

  const mediaWithUrls = await Promise.all((media ?? []).map(async (item: any) => {
    const { data } = await supabase.storage.from("experiment-media").createSignedUrl(item.storage_path, 3600);
    return { ...item, signedUrl: data?.signedUrl ?? null };
  }));
  const csv = experimentCsv(experiment as Record<string, unknown>, (stages ?? []) as Record<string, unknown>[]);
  const csvName = `${String(experiment.code || "experiment").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}-data.csv`;

  return (
    <section className="page-shell experiment-detail">
      <div className="detail-head">
        <div>
          <p className="eyebrow">{experiment.code}</p>
          <h1>{experiment.title}</h1>
          <p className="lede">{experiment.summary}</p>
        </div>
        <div className="detail-actions">
          <StatusPill status={experiment.status} />
          {approved && experiment.visibility && <span className="status-pill">{String(experiment.visibility).toUpperCase()}</span>}
          {approved && <Link className="button" href={`/submit?parent=${experiment.id}`}>CREATE NEXT TEST</Link>}
          {approved && <a className="button" href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download={csvName}>EXPORT DATA</a>}
          {canEdit && <Link className="button" href={`/experiments/${experiment.id}/edit`}>{isAdmin ? "Admin Edit" : "Edit Experiment"}</Link>}
        </div>
      </div>

      <div className="facts-grid">
        <div><span>Material</span><strong>{experiment.material_name || "—"}</strong></div>
        <div><span>Thickness</span><strong>{experiment.thickness_mm ? `${experiment.thickness_mm} mm` : "—"}</strong></div>
        <div><span>Outcome</span><strong>{experiment.outcome || "—"}</strong></div>
        <div><span>Undercut depth</span><strong>{experiment.undercut_depth_mm ? `${experiment.undercut_depth_mm} mm` : "—"}</strong></div>
        <div><span>Springback</span><strong>{experiment.springback_deg ? `${experiment.springback_deg}°` : "—"}</strong></div>
        <div><span>Researcher</span><strong>{experiment.researcher_name || "—"}</strong></div>
      </div>

      {mediaWithUrls.length > 0 && (
        <div className="media-grid">
          {mediaWithUrls.map((item: any) => item.signedUrl ? (
            <figure key={item.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.signedUrl} alt={item.caption || item.media_type || "Experiment image"} />
              <figcaption><span>{item.media_type}</span>{item.caption}</figcaption>
            </figure>
          ) : null)}
        </div>
      )}

      <section className="detail-section">
        <p className="section-index">Experiment Lineage</p>
        <div className="lineage-list">
          {parentExperiment && <Link href={`/experiments/${parentExperiment.id}`}>Parent / {parentExperiment.code || "Experiment"} / {parentExperiment.title}</Link>}
          <div className="lineage-current">Current Experiment / {experiment.code || "Current"} / {experiment.title}</div>
          {(childExperiments ?? []).map((child: any) => (
            <Link href={`/experiments/${child.id}`} key={child.id}>Child / Next Test / {child.code || "Next"} / {child.title}</Link>
          ))}
          {!parentExperiment && (childExperiments ?? []).length === 0 && <p>No parent or child experiments recorded.</p>}
        </div>
      </section>

      <section className="detail-section">
        <p className="section-index">Related Experiments</p>
        <div className="related-list">
          {relatedExperiments.map((related: any) => <Link href={`/experiments/${related.id}`} key={related.id}><strong>{related.code || "Experiment"} / {related.title}</strong><small>{[related.material_name, related.forming_method, related.geometry_type, related.undercut_type].filter(Boolean).join(" / ")}</small></Link>)}
          {relatedExperiments.length === 0 && <p>No similar experiments found.</p>}
        </div>
      </section>

      <section className="detail-section">
        <p className="section-index">Forming sequence</p>
        <div className="stage-stack">
          {(stages ?? []).map((stage: any) => (
            <article className="stage-card" key={stage.id}>
              <div className="stage-number">{String(stage.stage_number).padStart(2, "0")}</div>
              <div>
                <h2>{stage.title}</h2>
                <div className="stage-facts">
                  <span><b>Tool</b> {stage.tool_material || "—"}</span>
                  <span><b>Operation</b> {stage.forming_operation || "—"}</span>
                  <span><b>Force</b> {stage.press_force_tons ? `${stage.press_force_tons} ton` : "—"}</span>
                  <span><b>Constraint</b> {stage.constraint_type || "—"}</span>
                </div>
                {stage.observations && <p>{stage.observations}</p>}
              </div>
            </article>
          ))}
          {(stages ?? []).length === 0 && <p>No stages recorded.</p>}
        </div>
      </section>

      <section className="detail-section grid-2">
        <div>
          <p className="section-index">Observations</p>
          <p>{experiment.observations || "No observations recorded."}</p>
        </div>
        <div>
          <p className="section-index">Failure / behavior notes</p>
          <p>{experiment.failure_notes || "No failure notes recorded."}</p>
        </div>
      </section>
    </section>
  );
}

function AccessRequired() {
  return (
    <section className="page-shell narrow-shell">
      <div className="page-heading">
        <p className="eyebrow">Research Access Required</p>
        <h1>RESEARCH ACCESS REQUIRED</h1>
        <p>This record is available only when a published record has deliberately public visibility or when your account has approved research access.</p>
      </div>
      <Link className="button primary" href="/login">Sign In</Link>
    </section>
  );
}
