"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import { defaultObservationTypes, ObservationCardFields } from "../../components/ToolAndObservationPages";

type Stage = Record<string, string>;
type Option = { id: string; label: string };
type ParentExperiment = Record<string, string | number | null>;

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
  const [formingTools, setFormingTools] = useState<Option[]>([]);
  const [observationTypes, setObservationTypes] = useState(defaultObservationTypes);
  const [observationCount, setObservationCount] = useState(1);
  const [parentExperiment, setParentExperiment] = useState<ParentExperiment | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("approval_status, is_active")
        .eq("id", data.user.id)
        .single();
      if (!profile || profile.approval_status !== "approved" || profile.is_active === false) {
        window.location.href = "/access-status";
        return;
      }
      const parentId = new URLSearchParams(window.location.search).get("parent");
      if (parentId) {
        const { data: parent } = await supabase
          .from("experiments")
          .select("id, code, title, material_name, material_condition, thickness_mm, forming_method, geometry_type, undercut_type")
          .eq("id", parentId)
          .single();
        if (parent) setParentExperiment(parent as ParentExperiment);
      }
      setUserId(data.user.id);
    });
    Promise.all([
      supabase.from("materials").select("id, name").order("name"),
      supabase.from("products").select("id, product_name").order("product_name"),
      supabase.from("equipment").select("id, name").order("name"),
      supabase.from("forming_tools").select("id, tool_code, name").order("name"),
      supabase.from("research_sources").select("id, title").order("title"),
      supabase.from("experiments").select("id, code, title").order("created_at", { ascending: false }).limit(80),
      supabase.from("taxonomy_terms").select("name").eq("taxonomy_type", "observation_type").eq("is_active", true).order("sort_order"),
    ]).then(([materialRows, productRows, equipmentRows, toolRows, sourceRows, experimentRows, taxonomyRows]) => {
      setMaterials(((materialRows.data ?? []) as { id: string; name: string }[]).map((item) => ({ id: item.id, label: item.name })));
      setProducts(((productRows.data ?? []) as { id: string; product_name: string }[]).map((item) => ({ id: item.id, label: item.product_name })));
      setEquipment(((equipmentRows.data ?? []) as { id: string; name: string }[]).map((item) => ({ id: item.id, label: item.name })));
      setFormingTools(((toolRows.data ?? []) as { id: string; tool_code: string | null; name: string }[]).map((item) => ({ id: item.id, label: `${item.tool_code || "Tool"} / ${item.name}` })));
      setSources(((sourceRows.data ?? []) as { id: string; title: string }[]).map((item) => ({ id: item.id, label: item.title })));
      setExperiments(((experimentRows.data ?? []) as { id: string; code: string | null; title: string }[]).map((item) => ({ id: item.id, label: `${item.code || "Experiment"} / ${item.title}` })));
      const terms = ((taxonomyRows.data ?? []) as { name: string }[]).map((item) => item.name);
      if (terms.length) setObservationTypes(terms);
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
      let savedStages: { id: string; stage_number: number }[] = [];
      if (stageRows.length) {
        const { data, error } = await supabase.from("experiment_stages").insert(stageRows).select("id, stage_number");
        if (error) throw new Error(`Experiment saved, but stages could not be saved: ${error.message}`);
        savedStages = (data ?? []) as { id: string; stage_number: number }[];
      }

      for (let index = 0; index < savedStages.length; index++) {
        const toolId = text(`stage_tool_id_${index}`);
        if (toolId) {
          const { error } = await supabase.from("experiment_stage_tools").insert({ stage_id: savedStages[index].id, forming_tool_id: toolId, role: text(`stage_tool_role_${index}`) || "forming tool" });
          if (error) throw new Error(`Experiment saved, but stage tool link could not be saved: ${error.message}`);
        }
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

      for (let index = 0; index < observationCount; index++) {
        const observationType = text(`observation_type_${index}`);
        const observationFiles = form.getAll(`observation_media_${index}`).filter((entry): entry is File => entry instanceof File && entry.size > 0);
        if (!observationType && observationFiles.length === 0) continue;
        if (!observationType) throw new Error(`Observation ${index + 1} needs a type before photos can be attached.`);
        const stageIndexText = text(`observation_stage_index_${index}`);
        const stageId = stageIndexText ? savedStages[Number(stageIndexText)]?.id ?? null : null;
        const { data: observation, error: observationError } = await supabase.from("experiment_observations").insert({
          experiment_id: experiment.id,
          stage_id: stageId,
          observation_type: observationType,
          severity: text(`observation_severity_${index}`),
          location: text(`observation_location_${index}`),
          geometry_relationship: text(`observation_geometry_relationship_${index}`),
          description: text(`observation_description_${index}`),
          measurement_value: num(`observation_measurement_value_${index}`),
          measurement_unit: text(`observation_measurement_unit_${index}`),
          cause_notes: text(`observation_cause_notes_${index}`),
          created_by: auth.user.id,
        }).select("id").single();
        if (observationError || !observation) throw new Error(`Observation ${index + 1} could not be saved: ${observationError?.message ?? "unknown error"}`);
        for (let photoIndex = 0; photoIndex < observationFiles.length; photoIndex++) {
          setMessage(`Uploading observation ${index + 1} photo ${photoIndex + 1} of ${observationFiles.length}...`);
          const file = observationFiles[photoIndex];
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
          const storagePath = `${experiment.id}/observations/${observation.id}/${Date.now()}-${photoIndex}-${safeName}`;
          const { error: uploadError } = await supabase.storage.from("experiment-media").upload(storagePath, file, { upsert: false });
          if (uploadError) throw new Error(`Observation photo could not be uploaded: ${uploadError.message}`);
          const caption = text(`observation_caption_${index}`) || file.name;
          const { data: mediaRow, error: mediaError } = await supabase.from("experiment_media").insert({ experiment_id: experiment.id, storage_path: storagePath, media_type: "observation", caption, display_order: photoIndex, created_by: auth.user.id }).select("id").single();
          if (mediaError || !mediaRow) throw new Error(`Observation photo metadata could not be saved: ${mediaError?.message ?? "unknown error"}`);
          const { error: linkError } = await supabase.from("experiment_observation_media").insert({ observation_id: observation.id, media_id: mediaRow.id, caption });
          if (linkError) throw new Error(`Observation photo link could not be saved: ${linkError.message}`);
        }
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
      {parentExperiment && <div className="notice">PARENT EXPERIMENT<br />{String(parentExperiment.code || "Experiment")} / {String(parentExperiment.title || "")}</div>}
      <form className="experiment-form" onSubmit={submitExperiment} key={String(parentExperiment?.id ?? "new")}>
        <Fieldset index="01" title="Research question"><div className="form-grid"><Input name="title" label="Title" required /><Input name="researcher_name" label="Researcher" required /><Area name="research_question" label="Research question" /><Area name="research_objective" label="Research objective" /><Area name="hypothesis" label="Hypothesis" /><Area name="summary" label="Short summary" /></div></Fieldset>
        <Fieldset index="02" title="Sheet / specimen"><div className="form-grid form-grid-3"><Input name="material_name" label="Material" defaultValue={String(parentExperiment?.material_name ?? "")} /><Input name="material_condition" label="Material condition" defaultValue={String(parentExperiment?.material_condition ?? "")} /><Input name="thickness_mm" label="Thickness" type="number" defaultValue={String(parentExperiment?.thickness_mm ?? "")} /><Input name="sheet_width_mm" label="Width" type="number" /><Input name="sheet_length_mm" label="Length" type="number" /><Area name="initial_geometry" label="Initial geometry" /></div></Fieldset>
        <Fieldset index="03" title="Forming strategy"><div className="form-grid form-grid-3"><Input name="forming_method" label="Forming method" defaultValue={String(parentExperiment?.forming_method ?? "")} /><Input name="geometry_type" label="Geometry type" defaultValue={String(parentExperiment?.geometry_type ?? "")} /><Input name="undercut_type" label="Undercut type" defaultValue={String(parentExperiment?.undercut_type ?? "")} /></div></Fieldset>
        <Fieldset index="04" title="Press sequence"><div className="stage-editor">{stages.map((stage, index) => <details className="stage-editor-card" open={index === 0} key={index}><summary className="stage-editor-head"><strong>Stage {String(index + 1).padStart(2, "0")}</strong>{stages.length > 1 && <button type="button" onClick={() => setStages((current) => current.filter((_, i) => i !== index))}>Remove</button>}</summary><div className="form-panel"><p className="section-index">Linked detailed tool</p><div className="form-grid form-grid-3"><Select name={`stage_tool_id_${index}`} label="Link existing tool" options={formingTools} /><Input name={`stage_tool_role_${index}`} label="Tool role" defaultValue="upper tool" /><Link className="button" href="/contribute/tools/new" target="_blank" rel="noopener noreferrer">+ CREATE TOOL</Link></div></div><div className="form-grid form-grid-3">{stageFields.map((field) => field === "observations" || field === "stage_result" || field === "stage_image_notes" ? <label className="full" key={field}>{labelize(field)}<textarea rows={2} value={stage[field]} onChange={(event) => updateStage(index, field, event.target.value)} /></label> : <label key={field}>{labelize(field)}<input type={numericStageFields.has(field) ? "number" : "text"} step="0.01" value={stage[field]} onChange={(event) => updateStage(index, field, event.target.value)} /></label>)}</div></details>)}<button className="button" type="button" onClick={() => setStages((current) => [...current, emptyStage()])}>+ Add press stage</button></div></Fieldset>
        <Fieldset index="05" title="Measured result"><div className="form-grid form-grid-3"><Area name="final_geometry" label="Final geometry" /><Input name="undercut_depth_mm" label="Undercut depth" type="number" /><Input name="undercut_width_mm" label="Undercut width" type="number" /><Input name="undercut_height_mm" label="Undercut height" type="number" /><Input name="lateral_displacement_mm" label="Lateral displacement" type="number" /><Input name="springback_deg" label="Springback" type="number" /><Input name="measured_thickness_min_mm" label="Minimum measured thickness" type="number" /><Input name="max_thinning_percent" label="Maximum thinning %" type="number" /><Input name="wrinkling_severity" label="Wrinkling" /><Input name="surface_condition" label="Surface condition" /><Input name="tool_damage" label="Tool damage" /><Input name="measurement_method" label="Measurement method" /><Input name="ambient_temperature_c" label="Ambient temperature" type="number" /></div><div className="stage-editor"><div className="section-heading-row"><p className="section-index">Visual observations</p><button className="button" type="button" onClick={() => setObservationCount((current) => current + 1)}>+ ADD OBSERVATION</button></div>{Array.from({ length: observationCount }).map((_, index) => <ObservationCardFields key={index} index={index} stages={stages.map((stage, stageIndex) => ({ value: String(stageIndex), label: `Stage ${String(stageIndex + 1).padStart(2, "0")} / ${stage.title || "Untitled"}` }))} observationTypes={observationTypes} />)}</div></Fieldset>
        <Fieldset index="06" title="Interpretation"><div className="form-grid form-grid-3"><label>Outcome<select name="outcome" defaultValue=""><option value="">Select</option><option>successful</option><option>partial</option><option>failed</option><option>unexpected</option></select></label><Area name="observations" label="General observations" /><Area name="failure_notes" label="Failure notes" /><Area name="conclusion" label="Conclusion" /><Area name="next_test" label="Next test" /><label className="full">Images<input name="media" type="file" accept="image/*" multiple /></label></div></Fieldset>
        <Fieldset index="07" title="Research links"><div className="form-grid form-grid-3"><Select name="related_material_id" label="Related material" options={materials} /><Input name="material_role" label="Material role" defaultValue="sheet" /><Select name="related_product_id" label="Exact product" options={products} /><Input name="product_role" label="Product role" defaultValue="sheet" /><Select name="related_equipment_id" label="Equipment" options={equipment} /><Input name="equipment_role" label="Equipment role" defaultValue="press" /><Select name="related_source_id" label="Research source" options={sources} /><Input name="source_relationship" label="Source relationship" defaultValue="precedent" /><Select name="parent_experiment_id" label="Parent experiment" options={experiments} defaultValue={String(parentExperiment?.id ?? "")} /></div></Fieldset>
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
function Area({ name, label, defaultValue = "" }: { name: string; label: string; defaultValue?: string }) {
  return <label className="full">{label}<textarea name={name} rows={3} defaultValue={defaultValue} /></label>;
}
function Select({ name, label, options, defaultValue = "" }: { name: string; label: string; options: Option[]; defaultValue?: string }) {
  return <label>{label}<select name={name} defaultValue={defaultValue}><option value="">Select</option>{options.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>;
}
