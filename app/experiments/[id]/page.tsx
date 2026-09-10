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

  const { data: stageTools } = (stages ?? []).length
    ? await supabase
      .from("experiment_stage_tools")
      .select("stage_id, role, forming_tools(id, name, tool_code, tool_type, forming_tool_print_settings(print_material_text, layer_height_mm, wall_count, infill_percent, print_orientation))")
      .in("stage_id", (stages ?? []).map((stage: any) => stage.id))
    : { data: [] };

  const { data: observations } = await supabase
    .from("experiment_observations")
    .select("*, experiment_stages(id, stage_number, title), experiment_observation_media(caption, experiment_media(id, storage_path, caption, media_type, display_order))")
    .eq("experiment_id", id)
    .order("created_at", { ascending: true });

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
  const observationsWithMedia = await Promise.all((observations ?? []).map(async (observation: any) => {
    const links = await Promise.all((observation.experiment_observation_media ?? []).map(async (link: any) => {
      const mediaItem = Array.isArray(link.experiment_media) ? link.experiment_media[0] : link.experiment_media;
      if (!mediaItem?.storage_path) return link;
      const { data } = await supabase.storage.from("experiment-media").createSignedUrl(mediaItem.storage_path, 3600);
      return { ...link, experiment_media: { ...mediaItem, signedUrl: data?.signedUrl ?? null } };
    }));
    return { ...observation, experiment_observation_media: links };
  }));
  const toolsByStage = new Map<string, any[]>();
  (stageTools ?? []).forEach((link: any) => toolsByStage.set(link.stage_id, [...(toolsByStage.get(link.stage_id) ?? []), link]));
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
                {(toolsByStage.get(stage.id) ?? []).length > 0 && (
                  <div className="related-list">
                    {(toolsByStage.get(stage.id) ?? []).map((link: any) => {
                      const tool = Array.isArray(link.forming_tools) ? link.forming_tools[0] : link.forming_tools;
                      const settings = Array.isArray(tool?.forming_tool_print_settings) ? tool.forming_tool_print_settings[0] : null;
                      return tool ? <Link href={`/resources/tools/${tool.id}`} key={`${stage.id}-${tool.id}-${link.role}`}><strong>{[tool.tool_code, tool.name].filter(Boolean).join(" / ")}</strong><small>{[link.role, tool.tool_type, settings?.print_material_text, settings?.layer_height_mm ? `${settings.layer_height_mm} mm layer` : null, settings?.wall_count ? `${settings.wall_count} walls` : null, settings?.infill_percent ? `${settings.infill_percent}% infill` : null, settings?.print_orientation].filter(Boolean).join(" / ")}</small></Link> : null;
                    })}
                  </div>
                )}
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

      <section className="detail-section" id="visual-observations">
        <p className="section-index">Visual Observations</p>
        <div className="stage-stack">
          {observationsWithMedia.map((observation: any) => {
            const stage = Array.isArray(observation.experiment_stages) ? observation.experiment_stages[0] : observation.experiment_stages;
            return (
              <article className="stage-card" id={`observation-${observation.id}`} key={observation.id}>
                <div className="stage-number">{stage?.stage_number ? String(stage.stage_number).padStart(2, "0") : "EX"}</div>
                <div>
                  <h2>{observation.observation_type}{observation.severity ? ` / ${observation.severity}` : ""}</h2>
                  <div className="stage-facts">
                    <span><b>Stage</b> {stage ? stage.title || `Stage ${stage.stage_number}` : "Whole experiment"}</span>
                    <span><b>Location</b> {observation.location || "-"}</span>
                    <span><b>Measurement</b> {[observation.measurement_value, observation.measurement_unit].filter(Boolean).join(" ") || "-"}</span>
                  </div>
                  {observation.geometry_relationship && <p><strong>Geometry relationship</strong><br />{observation.geometry_relationship}</p>}
                  {observation.description && <p>{observation.description}</p>}
                  {observation.cause_notes && <p><strong>Possible cause / interpretation</strong><br />{observation.cause_notes}</p>}
                  <div className="media-grid">
                    {(observation.experiment_observation_media ?? []).map((link: any) => {
                      const mediaItem = Array.isArray(link.experiment_media) ? link.experiment_media[0] : link.experiment_media;
                      return mediaItem?.signedUrl ? <figure key={mediaItem.id}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={mediaItem.signedUrl} alt={link.caption || mediaItem.caption || observation.observation_type} /><figcaption><span>{observation.observation_type}</span>{link.caption || mediaItem.caption}</figcaption></figure> : null;
                    })}
                  </div>
                </div>
              </article>
            );
          })}
          {observationsWithMedia.length === 0 && <p>No structured visual observations recorded.</p>}
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
