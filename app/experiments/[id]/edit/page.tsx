"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../../lib/supabase/client";
import { isEditableStatus } from "../../../../lib/library";

type Stage = Record<string, string>;
type Option = { id: string; label: string };
type Experiment = Record<string, string | number | null>;

const stageFields = ["title", "forming_operation", "tool_material", "tool_geometry", "tool_process", "tool_hardness", "print_material", "print_layer_height_mm", "print_infill_percent", "print_infill_pattern", "print_wall_count", "print_orientation", "tool_temperature_c", "press_force_tons", "target_press_force_tons", "measured_press_force_tons", "dwell_time_seconds", "constraint_type", "tool_constraint", "sheet_restraint", "press_direction", "material_flow_direction", "observations", "stage_result", "springback_after_stage_deg", "tool_deformation_mm", "stage_image_notes"];
const numericStageFields = new Set(["print_layer_height_mm", "print_infill_percent", "print_wall_count", "tool_temperature_c", "press_force_tons", "target_press_force_tons", "measured_press_force_tons", "dwell_time_seconds", "springback_after_stage_deg", "tool_deformation_mm"]);
const experimentFields = ["title", "researcher_name", "research_question", "research_objective", "hypothesis", "summary", "material_name", "material_condition", "thickness_mm", "sheet_width_mm", "sheet_length_mm", "initial_geometry", "forming_method", "geometry_type", "undercut_type", "final_geometry", "undercut_depth_mm", "undercut_width_mm", "undercut_height_mm", "lateral_displacement_mm", "springback_deg", "measured_thickness_min_mm", "max_thinning_percent", "wrinkling_severity", "surface_condition", "tool_damage", "measurement_method", "ambient_temperature_c", "outcome", "observations", "failure_notes", "conclusion", "next_test", "parent_experiment_id"];
const numericExperimentFields = new Set(["thickness_mm", "sheet_width_mm", "sheet_length_mm", "undercut_depth_mm", "undercut_width_mm", "undercut_height_mm", "lateral_displacement_mm", "springback_deg", "measured_thickness_min_mm", "max_thinning_percent", "ambient_temperature_c"]);
const emptyStage = () => Object.fromEntries(stageFields.map((field) => [field, ""])) as Stage;

export default function EditExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState("");
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [stages, setStages] = useState<Stage[]>([emptyStage()]);
  const [message, setMessage] = useState("Loading...");
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<Record<string, Option[]>>({ materials: [], products: [], equipment: [], sources: [], experiments: [] });

  useEffect(() => { params.then(({ id: routeId }) => setId(routeId)); }, [params]);
  useEffect(() => { if (id) load(id); }, [id]);

  async function load(experimentId: string) {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { window.location.href = "/login"; return; }
    const { data: profile } = await supabase.from("profiles").select("role, approval_status, is_active").eq("id", auth.user.id).single();
    if (!profile || profile.approval_status !== "approved" || profile.is_active === false) { window.location.href = "/access-status"; return; }
    const { data, error } = await supabase.from("experiments").select("*").eq("id", experimentId).single();
    if (error || !data) { setMessage(error?.message ?? "Experiment not found."); return; }
    const record = data as Experiment;
    const canEdit = profile?.role === "admin" || (record.researcher_id === auth.user.id && isEditableStatus(String(record.status)));
    if (!canEdit) { setExperiment(record); setMessage("This record is part of the reviewed research archive. Contact an administrator to revise it."); return; }
    setExperiment(record);
    setMessage("");
    const { data: stageData } = await supabase.from("experiment_stages").select("*").eq("experiment_id", experimentId).order("stage_number", { ascending: true });
    setStages((stageData ?? []).length ? ((stageData ?? []) as Record<string, string | number | null>[]).map((stage) => Object.fromEntries(stageFields.map((field) => [field, stage[field] == null ? "" : String(stage[field])])) as Stage) : [emptyStage()]);
    const [materials, products, equipmentRows, sources, experiments] = await Promise.all([
      supabase.from("materials").select("id, name").order("name"),
      supabase.from("products").select("id, product_name").order("product_name"),
      supabase.from("equipment").select("id, name").order("name"),
      supabase.from("research_sources").select("id, title").order("title"),
      supabase.from("experiments").select("id, code, title").order("created_at", { ascending: false }).limit(80),
    ]);
    setOptions({
      materials: ((materials.data ?? []) as { id: string; name: string }[]).map((item) => ({ id: item.id, label: item.name })),
      products: ((products.data ?? []) as { id: string; product_name: string }[]).map((item) => ({ id: item.id, label: item.product_name })),
      equipment: ((equipmentRows.data ?? []) as { id: string; name: string }[]).map((item) => ({ id: item.id, label: item.name })),
      sources: ((sources.data ?? []) as { id: string; title: string }[]).map((item) => ({ id: item.id, label: item.title })),
      experiments: ((experiments.data ?? []) as { id: string; code: string | null; title: string }[]).map((item) => ({ id: item.id, label: `${item.code || "Experiment"} / ${item.title}` })),
    });
  }

  function updateStage(index: number, key: string, value: string) {
    setStages((current) => current.map((stage, i) => i === index ? { ...stage, [key]: value } : stage));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!experiment) return;
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) || "").trim() || null;
    const supabase = createClient();
    setBusy(true);
    setMessage("Saving experiment...");

    const payload: Record<string, string | number | null> = {};
    experimentFields.forEach((field) => {
      payload[field] = numericExperimentFields.has(field) ? (form.get(field) ? Number(form.get(field)) : null) : text(field);
    });
    const { error } = await supabase.from("experiments").update(payload).eq("id", String(experiment.id));
    if (error) { setMessage(error.message); setBusy(false); return; }
    const { error: deleteError } = await supabase.from("experiment_stages").delete().eq("experiment_id", String(experiment.id));
    if (deleteError) { setMessage(deleteError.message); setBusy(false); return; }
    const rows = stages.filter((stage) => Object.values(stage).some((value) => value.trim())).map((stage, index) => {
      const row: Record<string, string | number | null> = { experiment_id: String(experiment.id), stage_number: index + 1 };
      stageFields.forEach((field) => { row[field] = numericStageFields.has(field) ? (stage[field] ? Number(stage[field]) : null) : stage[field]; });
      row.title = stage.title || `Stage ${index + 1}`;
      return row;
    });
    if (rows.length) {
      const { error: stageError } = await supabase.from("experiment_stages").insert(rows);
      if (stageError) { setMessage(stageError.message); setBusy(false); return; }
    }
    await Promise.all([
      supabase.from("experiment_materials").delete().eq("experiment_id", String(experiment.id)),
      supabase.from("experiment_products").delete().eq("experiment_id", String(experiment.id)),
      supabase.from("experiment_equipment").delete().eq("experiment_id", String(experiment.id)),
      supabase.from("experiment_sources").delete().eq("experiment_id", String(experiment.id)),
    ]);
    const jobs = [
      text("related_material_id") && supabase.from("experiment_materials").insert({ experiment_id: experiment.id, material_id: text("related_material_id"), role: text("material_role") || "sheet" }),
      text("related_product_id") && supabase.from("experiment_products").insert({ experiment_id: experiment.id, product_id: text("related_product_id"), role: text("product_role") || "sheet" }),
      text("related_equipment_id") && supabase.from("experiment_equipment").insert({ experiment_id: experiment.id, equipment_id: text("related_equipment_id"), role: text("equipment_role") || "press" }),
      text("related_source_id") && supabase.from("experiment_sources").insert({ experiment_id: experiment.id, source_id: text("related_source_id"), relationship: text("source_relationship") || "precedent" }),
    ].filter(Boolean);
    for (const job of jobs) await job;
    window.location.href = `/experiments/${experiment.id}`;
  }

  if (!experiment) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;

  return <section className="page-shell"><div className="page-heading split-heading"><div><p className="eyebrow">{experiment.code}</p><h1>Edit experiment</h1><p>{message || "Revise protocol, measurements, stages, and research links."}</p></div><Link className="button" href={`/experiments/${experiment.id}`}>Open Experiment</Link></div><form className="experiment-form" onSubmit={save}><fieldset><legend><span>01</span> Research question</legend><div className="form-grid">{["title", "researcher_name", "research_question", "research_objective", "hypothesis", "summary"].map((field) => field.includes("question") || field === "hypothesis" || field === "summary" || field === "research_objective" ? <Area key={field} name={field} label={labelize(field)} value={experiment[field]} /> : <Input key={field} name={field} label={labelize(field)} value={experiment[field]} required={field === "title" || field === "researcher_name"} />)}</div></fieldset><fieldset><legend><span>02</span> Sheet / specimen</legend><div className="form-grid form-grid-3">{["material_name", "material_condition", "thickness_mm", "sheet_width_mm", "sheet_length_mm", "initial_geometry"].map((field) => field === "initial_geometry" ? <Area key={field} name={field} label={labelize(field)} value={experiment[field]} /> : <Input key={field} name={field} label={labelize(field)} value={experiment[field]} type={numericExperimentFields.has(field) ? "number" : "text"} />)}</div></fieldset><fieldset><legend><span>03</span> Forming strategy</legend><div className="form-grid form-grid-3">{["forming_method", "geometry_type", "undercut_type"].map((field) => <Input key={field} name={field} label={labelize(field)} value={experiment[field]} />)}</div></fieldset><fieldset><legend><span>04</span> Press sequence</legend><div className="stage-editor">{stages.map((stage, index) => <details className="stage-editor-card" open={index === 0} key={index}><summary className="stage-editor-head"><strong>Stage {String(index + 1).padStart(2, "0")}</strong>{stages.length > 1 && <button type="button" onClick={() => setStages((current) => current.filter((_, i) => i !== index))}>Remove</button>}</summary><div className="form-grid form-grid-3">{stageFields.map((field) => field === "observations" || field === "stage_result" || field === "stage_image_notes" ? <label className="full" key={field}>{labelize(field)}<textarea rows={2} value={stage[field]} onChange={(event) => updateStage(index, field, event.target.value)} /></label> : <label key={field}>{labelize(field)}<input type={numericStageFields.has(field) ? "number" : "text"} step="0.01" value={stage[field]} onChange={(event) => updateStage(index, field, event.target.value)} /></label>)}</div></details>)}<button className="button" type="button" onClick={() => setStages((current) => [...current, emptyStage()])}>+ Add Stage</button></div></fieldset><fieldset><legend><span>05</span> Measured result</legend><div className="form-grid form-grid-3">{["final_geometry", "undercut_depth_mm", "undercut_width_mm", "undercut_height_mm", "lateral_displacement_mm", "springback_deg", "measured_thickness_min_mm", "max_thinning_percent", "wrinkling_severity", "surface_condition", "tool_damage", "measurement_method", "ambient_temperature_c"].map((field) => field === "final_geometry" ? <Area key={field} name={field} label={labelize(field)} value={experiment[field]} /> : <Input key={field} name={field} label={labelize(field)} value={experiment[field]} type={numericExperimentFields.has(field) ? "number" : "text"} />)}</div></fieldset><fieldset><legend><span>06</span> Interpretation</legend><div className="form-grid form-grid-3"><label>Outcome<select name="outcome" defaultValue={String(experiment.outcome ?? "")}><option value="">Select</option><option>successful</option><option>partial</option><option>failed</option><option>unexpected</option></select></label>{["observations", "failure_notes", "conclusion", "next_test"].map((field) => <Area key={field} name={field} label={labelize(field)} value={experiment[field]} />)}</div></fieldset><fieldset><legend><span>07</span> Research links</legend><div className="form-grid form-grid-3"><Select name="related_material_id" label="Related material" options={options.materials} /><Input name="material_role" label="Material role" value="sheet" /><Select name="related_product_id" label="Exact product" options={options.products} /><Input name="product_role" label="Product role" value="sheet" /><Select name="related_equipment_id" label="Equipment" options={options.equipment} /><Input name="equipment_role" label="Equipment role" value="press" /><Select name="related_source_id" label="Research source" options={options.sources} /><Input name="source_relationship" label="Source relationship" value="precedent" /><Select name="parent_experiment_id" label="Parent experiment" options={options.experiments} value={String(experiment.parent_experiment_id ?? "")} /></div></fieldset><div className="submit-bar"><button className="button primary" type="submit" disabled={busy}>Save Changes</button>{message && <span className="form-message">{message}</span>}</div></form></section>;
}

function labelize(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()); }
function Input({ name, label, value, type = "text", required = false }: { name: string; label: string; value?: string | number | null; type?: string; required?: boolean }) { return <label>{label}<input name={name} type={type} step={type === "number" ? "0.01" : undefined} required={required} defaultValue={value == null ? "" : String(value)} /></label>; }
function Area({ name, label, value }: { name: string; label: string; value?: string | number | null }) { return <label className="full">{label}<textarea name={name} rows={3} defaultValue={value == null ? "" : String(value)} /></label>; }
function Select({ name, label, options, value = "" }: { name: string; label: string; options: Option[]; value?: string }) { return <label>{label}<select name={name} defaultValue={value}><option value="">Select</option>{options.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>; }
