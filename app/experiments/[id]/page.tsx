import { notFound } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { StatusPill } from "../../../components/StatusPill";

export const dynamic = "force-dynamic";

export default async function ExperimentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: experiment } = await supabase
    .from("experiments")
    .select("*")
    .eq("id", id)
    .single();

  if (!experiment) notFound();

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

  const mediaWithUrls = await Promise.all((media ?? []).map(async (item: any) => {
    const { data } = await supabase.storage.from("experiment-media").createSignedUrl(item.storage_path, 3600);
    return { ...item, signedUrl: data?.signedUrl ?? null };
  }));

  return (
    <section className="page-shell experiment-detail">
      <div className="detail-head">
        <div>
          <p className="eyebrow">{experiment.code}</p>
          <h1>{experiment.title}</h1>
          <p className="lede">{experiment.summary}</p>
        </div>
        <StatusPill status={experiment.status} />
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
