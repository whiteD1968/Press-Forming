import Link from "next/link";
import { createClient } from "../../../lib/supabase/server";
import { requireApprovedUser } from "../../../lib/access";

export const dynamic = "force-dynamic";

const fields = [
  ["Code", "code"],
  ["Title", "title"],
  ["Researcher", "researcher_name"],
  ["Material", "material_name"],
  ["Material condition", "material_condition"],
  ["Thickness", "thickness_mm"],
  ["Sheet width", "sheet_width_mm"],
  ["Sheet length", "sheet_length_mm"],
  ["Forming method", "forming_method"],
  ["Geometry type", "geometry_type"],
  ["Undercut type", "undercut_type"],
  ["Undercut depth", "undercut_depth_mm"],
  ["Undercut width", "undercut_width_mm"],
  ["Undercut height", "undercut_height_mm"],
  ["Lateral displacement", "lateral_displacement_mm"],
  ["Springback", "springback_deg"],
  ["Minimum measured thickness", "measured_thickness_min_mm"],
  ["Maximum thinning %", "max_thinning_percent"],
  ["Wrinkling", "wrinkling_severity"],
  ["Surface condition", "surface_condition"],
  ["Tool damage", "tool_damage"],
  ["Outcome", "outcome"],
  ["Conclusion", "conclusion"],
  ["Next Test", "next_test"],
] as const;

const stageFields = [
  ["Stage", "stage_number"],
  ["Operation", "forming_operation"],
  ["Tool material", "tool_material"],
  ["Tool geometry", "tool_geometry"],
  ["Tool hardness", "tool_hardness"],
  ["Target press force", "target_press_force_tons"],
  ["Measured press force", "measured_press_force_tons"],
  ["Constraint", "constraint_type"],
  ["Sheet restraint", "sheet_restraint"],
  ["Stage result", "stage_result"],
] as const;

export default async function ExperimentComparePage({ searchParams }: { searchParams: Promise<{ id?: string | string[] }> }) {
  await requireApprovedUser();
  const params = await searchParams;
  const selectedIds = Array.from(new Set(Array.isArray(params.id) ? params.id : params.id ? [params.id] : [])).slice(0, 4);
  const supabase = await createClient();

  if (selectedIds.length < 2) {
    const { data: options } = await supabase
      .from("experiments")
      .select("id, code, title")
      .order("created_at", { ascending: false })
      .limit(80);

    return (
      <section className="page-shell">
        <div className="page-heading">
          <p className="eyebrow">Experiment Comparison</p>
          <h1>Compare experiments</h1>
          <p>Select 2 to 4 experiments visible to your account.</p>
        </div>
        <form className="form-panel" action="/experiments/compare">
          <div className="filter-bar">
            {(options ?? []).map((experiment: any) => <label key={experiment.id}><input name="id" type="checkbox" value={experiment.id} /> {experiment.code || "Experiment"} / {experiment.title}</label>)}
          </div>
          <button className="button primary" type="submit">Compare Selected</button>
        </form>
      </section>
    );
  }

  const { data: experiments } = await supabase
    .from("experiments")
    .select("*")
    .in("id", selectedIds);

  const visible = selectedIds
    .map((id) => (experiments ?? []).find((experiment: any) => experiment.id === id))
    .filter(Boolean);

  if (visible.length < 2) {
    return (
      <section className="page-shell narrow-shell">
        <div className="notice">Choose at least two experiments visible to your account.</div>
        <Link className="button primary" href="/experiments/compare">Select experiments</Link>
      </section>
    );
  }

  const { data: stages } = await supabase
    .from("experiment_stages")
    .select("*")
    .in("experiment_id", visible.map((experiment: any) => experiment.id))
    .order("stage_number", { ascending: true });

  return (
    <section className="page-shell">
      <div className="page-heading split-heading">
        <div>
          <p className="eyebrow">Experiment Comparison</p>
          <h1>Compare experiments</h1>
          <p>Technical comparison across selected experiments and press sequences.</p>
        </div>
        <Link className="button" href="/experiments/compare">Change Selection</Link>
      </div>

      <div className="comparison-table">
        <div className="comparison-row comparison-head">
          <span>Field</span>
          {visible.map((experiment: any) => <strong key={experiment.id}>{experiment.code || "Experiment"}</strong>)}
        </div>
        {fields.map(([label, key]) => (
          <div className="comparison-row" key={key}>
            <span>{label}</span>
            {visible.map((experiment: any) => <span key={experiment.id}>{formatValue(experiment[key])}</span>)}
          </div>
        ))}
        <div className="comparison-row">
          <span>Number of stages</span>
          {visible.map((experiment: any) => <span key={experiment.id}>{(stages ?? []).filter((stage: any) => stage.experiment_id === experiment.id).length}</span>)}
        </div>
      </div>

      <section className="detail-section">
        <p className="section-index">Press Sequence</p>
        <div className="comparison-grid">
          {visible.map((experiment: any) => (
            <article className="stage-card" key={experiment.id}>
              <h2>{experiment.code || "Experiment"} / {experiment.title}</h2>
              {(stages ?? []).filter((stage: any) => stage.experiment_id === experiment.id).map((stage: any) => (
                <div className="facts-grid" key={stage.id}>
                  {stageFields.map(([label, key]) => <div key={key}><span>{label}</span><strong>{formatValue(stage[key])}</strong></div>)}
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}
