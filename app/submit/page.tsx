"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type Stage = Record<string, string>;
type Option = { id: string; label: string };

const stageFields = [
  "title", "forming_operation", "tool_material", "tool_geometry", "tool_process", "tool_hardness",
  "print_material", "print_layer_height_mm", "print_infill_percent", "print_infill_pattern", "print_wall_count", "print_orientation",
  "tool_temperature_c", "press_force_tons", "target_press_force_tons", "measured_press_force_tons", "dwell_time_seconds",
  "constraint_type", "tool_constraint", "sheet_restraint", "press_direction", "material_flow_direction",
  "observations", "stage_result", "springback_after_stage_deg", "tool_deformation_mm", "stage_image_notes",
];
const numericStageFields = new Set(["print_layer_height_mm", "print_infill_percent", "print_wall_count", "tool_temperature_c", "press_force_tons", "target_press_force_tons", "measured_press_force_tons", "dwell_time_seconds", "springback_after_stage_deg", "tool_deformation_mm"]);
const emptyStage = () => Object.fromEntries(stageFields.map((field) => [field, ""])) as Stage;

export default function SubmitPage() {
  const [stages, setStages] = useState<Stage[]>([emptyStage()]);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [materials, setMaterials] = useState<Option[]>([]);
  const [products, setProducts] = useState<Option[]>([]);
  const [equipment, setEquipment] = useState<Option[]>([]);
  const [sources, setSources] = useState<Option[]>([]);
  const [experiments, setExperiments] = useState<Option[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    Promise.all([
      supabase.from("materials").select("id, name").order("name"),
      supabase.from("products").select("id, product_name").order("product_name"),
      supabase.from("equipment").select("id, name").order("name"),
      supabase.from("research_sources").select("id, title").order("title"),
      supabase.from("experiments").select("id, code, title").order("created_at", { ascending: false }).limit(80),
    ]).then(([materialRows, productRows, equipmentRows, sourceRows, experimentRows]) => {
      setMaterials(((materialRows.data ?? []) as { id: string; name: string }[]).map((item) => ({ id: item.id, label: item.name })));
      setProducts(((productRows.data ?? []) as { id: string; product_name: string }[]).map((item) => ({ id: item.id, label: item.product_name })));
      setEquipment(((equipmentRows.data ?? []) as { id: string; name: string }[]).map((item) => ({ id: item.id, label: item.name })));
      setSources(((sourceRows.data ?? []) as { id: string; title: string }[]).map((item) => ({ id: item.id, label: item.title })));
      setExperiments(((experimentRows.data ?? []) as { id: string; code: string | null; title: string }[]).map((item) => ({ id: item.id, label: `${item.code || "Experiment"} / ${item.title}` })));
    });
  }, []);

  function updateStage(index: number, key: string, value: string) {
    setStages((current) => current.map((stage, i) => i === index ? { ...stage, [key]: value } : stage));
  }

  async function submitExperiment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status = submitter?.value === "submitted" ? "submitted" : "draft";
    const text = (key: string) => String(form.get(key) || "").trim() || null;
    const num = (key: string) => form.get(key) ? Number(form.get(key)) : null;

    setMessage("Saving experiment...");
    setBusy(true);

    try {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in before submitting an experiment.");

      const { data: experiment, error: experimentError } = await supabase.from("experiments").insert({
        researcher_id: auth.user.id,
        researcher_name: text("researcher_name"),
        title: text("title"),
        summary: text("summary"),
        research_question: text("research_question"),
        research_objective: text("research_objective"),
        hypothesis: text("hypothesis"),
        material_name: text("material_name"),
        material_condition: text("material_condition"),
        thickness_mm: num("thickness_mm"),
        sheet_width_mm: num("sheet_width_mm"),
        sheet_length_mm: num("sheet_length_mm"),
        initial_geometry: text("initial_geometry"),
        final_geometry: text("final_geometry"),
        forming_method: text("forming_method"),
        geometry_type: text("geometry_type"),
        undercut_type: text("undercut_type"),
        undercut_depth_mm: num("undercut_depth_mm"),
        undercut_width_mm: num("undercut_width_mm"),
        undercut_height_mm: num("undercut_height_mm"),
        lateral_displacement_mm: num("lateral_displacement_mm"),
        springback_deg: num("springback_deg"),
        measured_thickness_min_mm: num("measured_thickness_min_mm"),
        max_thinning_percent: num("max_thinning_percent"),
        wrinkling_severity: text("wrinkling_severity"),
        surface_condition: text("surface_condition"),
        tool_damage: text("tool_damage"),
        measurement_method: text("measurement_method"),
        ambient_temperature_c: num("ambient_temperature_c"),
        outcome: text("outcome"),
        observations: text("observations"),
        failure_notes: text("failure_notes"),
        conclusion: text("conclusion"),
        next_test: text("next_test"),
        parent_experiment_id: text("parent_experiment_id"),
        status,
      }).select("id, code").single();
      if (experimentError || !experiment) throw experimentError;

      const stageRows = stages.filter((stage) => Object.values(stage).some((value) => value.trim())).map((stage, index) => {
        const row: Record<string, string | number | null> = { experiment_id: experiment.id, stage_number: index + 1 };
        stageFields.forEach((field) => {
          row[field] = numericStageFields.has(field) ? (stage[field] ? Number(stage[field]) : null) : stage[field];
        });
        row.title = stage.title || `Stage ${index + 1}`;
        return row;
      });
      if (stageRows.length) {
        const { error } = await supabase.from("experiment_stages").insert(stageRows);
        if (error) throw new Error(`Experiment saved, but stages could not be saved: ${error.message}`);
      }

      const materialId = text("related_material_id");
      if (materialId) {
        const { error } = await supabase.from("experiment_materials").insert({ experiment_id: experiment.id, material_id: materialId, role: text("material_role") || "sheet" });
        if (error) throw new Error(`Experiment saved, but the material link could not be saved: ${error.message}`);
      }
      const productId = text("related_product_id");
      if (productId) {
        const { error } = await supabase.from("experiment_products").insert({ experiment_id: experiment.id, product_id: productId, role: text("product_role") || "sheet" });
        if (error) throw new Error(`Experiment saved, but the product link could not be saved: ${error.message}`);
      }
      const equipmentId = text("related_equipment_id");
      if (equipmentId) {
        const { error } = await supabase.from("experiment_equipment").insert({ experiment_id: experiment.id, equipment_id: equipmentId, role: text("equipment_role") || "press" });
        if (error) throw new Error(`Experiment saved, but the equipment link could not be saved: ${error.message}`);
      }
      const sourceId = text("related_source_id");
      if (sourceId) {
        const { error } = await supabase.from("experiment_sources").insert({ experiment_id: experiment.id, source_id: sourceId, relationship: text("source_relationship") || "precedent" });
        if (error) throw new Error(`Experiment saved, but the source link could not be saved: ${error.message}`);
      }

      const files = form.getAll("media").filter((entry): entry is File => entry instanceof File && entry.size > 0);
      for (let index = 0; index < files.length; index++) {
        setMessage(`Uploading image ${index + 1} of ${files.length}...`);
        const file = files[index];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const storagePath = `${experiment.id}/${Date.now()}-${index}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("experiment-media").upload(storagePath, file, { upsert: false });
        if (uploadError) throw new Error(`Image ${index + 1} could not be uploaded: ${uploadError.message}`);
        const { error: mediaError } = await supabase.from("experiment_media").insert({ experiment_id: experiment.id, storage_path: storagePath, media_type: "result", caption: file.name, display_order: index, created_by: auth.user.id });
        if (mediaError) throw new Error(`Image ${index + 1} uploaded, but media metadata could not be saved: ${mediaError.message}`);
      }

      window.location.href = `/experiments/${experiment.id}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save experiment.");
      setBusy(false);
    }
  }

  if (userId === null) return <section className="page-shell narrow-shell"><div className="notice">Sign in to create an experiment. <a href="/login">Open researcher login</a></div></section>;

  return (
    <section className="page-shell">
      <div className="page-heading"><p className="eyebrow">Research Portal</p><h1>New experiment</h1><p>Record the forming objective, material setup, staged tool behavior, measurements, and research links.</p></div>
      <form className="experiment-form" onSubmit={submitExperiment}>
        <Fieldset index="01" title="Research question"><div className="form-grid"><Input name="title" label="Title" required /><Input name="researcher_name" label="Researcher" required /><Area name="research_question" label="Research question" /><Area name="research_objective" label="Research objective" /><Area name="hypothesis" label="Hypothesis" /><Area name="summary" label="Short summary" /></div></Fieldset>
        <Fieldset index="02" title="Sheet / specimen"><div className="form-grid form-grid-3"><Input name="material_name" label="Material" /><Input name="material_condition" label="Material condition" /><Input name="thickness_mm" label="Thickness" type="number" /><Input name="sheet_width_mm" label="Width" type="number" /><Input name="sheet_length_mm" label="Length" type="number" /><Area name="initial_geometry" label="Initial geometry" /></div></Fieldset>
        <Fieldset index="03" title="Forming strategy"><div className="form-grid form-grid-3"><Input name="forming_method" label="Forming method" /><Input name="geometry_type" label="Geometry type" /><Input name="undercut_type" label="Undercut type" /></div></Fieldset>
        <Fieldset index="04" title="Press sequence"><div className="stage-editor">{stages.map((stage, index) => <details className="stage-editor-card" open={index === 0} key={index}><summary className="stage-editor-head"><strong>Stage {String(index + 1).padStart(2, "0")}</strong>{stages.length > 1 && <button type="button" onClick={() => setStages((current) => current.filter((_, i) => i !== index))}>Remove</button>}</summary><div className="form-grid form-grid-3">{stageFields.map((field) => field === "observations" || field === "stage_result" || field === "stage_image_notes" ? <label className="full" key={field}>{labelize(field)}<textarea rows={2} value={stage[field]} onChange={(event) => updateStage(index, field, event.target.value)} /></label> : <label key={field}>{labelize(field)}<input type={numericStageFields.has(field) ? "number" : "text"} step="0.01" value={stage[field]} onChange={(event) => updateStage(index, field, event.target.value)} /></label>)}</div></details>)}<button className="button" type="button" onClick={() => setStages((current) => [...current, emptyStage()])}>+ Add press stage</button></div></Fieldset>
        <Fieldset index="05" title="Measured result"><div className="form-grid form-grid-3"><Area name="final_geometry" label="Final geometry" /><Input name="undercut_depth_mm" label="Undercut depth" type="number" /><Input name="undercut_width_mm" label="Undercut width" type="number" /><Input name="undercut_height_mm" label="Undercut height" type="number" /><Input name="lateral_displacement_mm" label="Lateral displacement" type="number" /><Input name="springback_deg" label="Springback" type="number" /><Input name="measured_thickness_min_mm" label="Minimum measured thickness" type="number" /><Input name="max_thinning_percent" label="Maximum thinning %" type="number" /><Input name="wrinkling_severity" label="Wrinkling" /><Input name="surface_condition" label="Surface condition" /><Input name="tool_damage" label="Tool damage" /><Input name="measurement_method" label="Measurement method" /><Input name="ambient_temperature_c" label="Ambient temperature" type="number" /></div></Fieldset>
        <Fieldset index="06" title="Interpretation"><div className="form-grid form-grid-3"><label>Outcome<select name="outcome" defaultValue=""><option value="">Select</option><option>successful</option><option>partial</option><option>failed</option><option>unexpected</option></select></label><Area name="observations" label="General observations" /><Area name="failure_notes" label="Failure notes" /><Area name="conclusion" label="Conclusion" /><Area name="next_test" label="Next test" /><label className="full">Images<input name="media" type="file" accept="image/*" multiple /></label></div></Fieldset>
        <Fieldset index="07" title="Research links"><div className="form-grid form-grid-3"><Select name="related_material_id" label="Related material" options={materials} /><Input name="material_role" label="Material role" defaultValue="sheet" /><Select name="related_product_id" label="Exact product" options={products} /><Input name="product_role" label="Product role" defaultValue="sheet" /><Select name="related_equipment_id" label="Equipment" options={equipment} /><Input name="equipment_role" label="Equipment role" defaultValue="press" /><Select name="related_source_id" label="Research source" options={sources} /><Input name="source_relationship" label="Source relationship" defaultValue="precedent" /><Select name="parent_experiment_id" label="Parent experiment" options={experiments} /></div></Fieldset>
        <div className="submit-bar"><button className="button" value="draft" type="submit" disabled={busy}>Save Draft</button><button className="button primary" value="submitted" type="submit" disabled={busy}>Submit for Review</button>{message && <span className="form-message">{message}</span>}</div>
      </form>
    </section>
  );
}

function Fieldset({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return <fieldset><legend><span>{index}</span> {title}</legend>{children}</fieldset>;
}
function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
function Input({ name, label, type = "text", required = false, defaultValue = "" }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string }) {
  return <label>{label}<input name={name} type={type} step={type === "number" ? "0.01" : undefined} required={required} defaultValue={defaultValue} /></label>;
}
function Area({ name, label }: { name: string; label: string }) {
  return <label className="full">{label}<textarea name={name} rows={3} /></label>;
}
function Select({ name, label, options }: { name: string; label: string; options: Option[] }) {
  return <label>{label}<select name={name}><option value="">Select</option>{options.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>;
}
