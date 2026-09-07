"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../../lib/supabase/client";

type ExperimentStatus = "draft" | "submitted" | "reviewed" | "published";
type Role = "student" | "research_assistant" | "admin";
type Experiment = {
  id: string;
  code: string | null;
  researcher_id: string;
  researcher_name: string | null;
  title: string;
  summary: string | null;
  research_question: string | null;
  material_name: string | null;
  material_condition: string | null;
  thickness_mm: number | null;
  outcome: string | null;
  undercut_depth_mm: number | null;
  springback_deg: number | null;
  observations: string | null;
  failure_notes: string | null;
  status: ExperimentStatus;
};
type Stage = {
  id?: string;
  title: string;
  forming_operation: string;
  tool_material: string;
  press_force_tons: string;
  constraint_type: string;
  observations: string;
};
type MediaItem = {
  id: string;
  storage_path: string;
  caption: string | null;
  media_type: string | null;
  signedUrl: string | null;
};

const emptyStage = (): Stage => ({
  title: "",
  forming_operation: "",
  tool_material: "",
  press_force_tons: "",
  constraint_type: "",
  observations: "",
});

export default function EditExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const [experimentId, setExperimentId] = useState("");
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [stages, setStages] = useState<Stage[]>([emptyStage()]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [message, setMessage] = useState("Loading...");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    params.then(({ id }) => setExperimentId(id));
  }, [params]);

  useEffect(() => {
    if (!experimentId) return;
    loadExperiment(experimentId);
  }, [experimentId]);

  async function loadExperiment(id: string) {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setMessage("Sign in to edit this experiment.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    const { data: experimentData, error: experimentError } = await supabase
      .from("experiments")
      .select("*")
      .eq("id", id)
      .single();

    if (experimentError || !experimentData) {
      setMessage(experimentError?.message ?? "Experiment not found.");
      return;
    }

    const item = experimentData as Experiment;
    const role = profile?.role as Role | undefined;
    const canEdit = role === "admin" || (item.researcher_id === auth.user.id && (item.status === "draft" || item.status === "submitted"));

    if (!canEdit) {
      setMessage("You do not have permission to edit this experiment.");
      return;
    }

    const { data: stageData } = await supabase
      .from("experiment_stages")
      .select("*")
      .eq("experiment_id", id)
      .order("stage_number", { ascending: true });

    const { data: mediaData } = await supabase
      .from("experiment_media")
      .select("id, storage_path, caption, media_type")
      .eq("experiment_id", id)
      .order("display_order", { ascending: true });

    const mediaWithUrls = await Promise.all(((mediaData ?? []) as Omit<MediaItem, "signedUrl">[]).map(async (item) => {
      const { data } = await supabase.storage.from("experiment-media").createSignedUrl(item.storage_path, 3600);
      return { ...item, signedUrl: data?.signedUrl ?? null };
    }));

    setExperiment(item);
    setStages((stageData ?? []).length ? (stageData ?? []).map((stage) => ({
      id: stage.id,
      title: stage.title ?? "",
      forming_operation: stage.forming_operation ?? "",
      tool_material: stage.tool_material ?? "",
      press_force_tons: stage.press_force_tons == null ? "" : String(stage.press_force_tons),
      constraint_type: stage.constraint_type ?? "",
      observations: stage.observations ?? "",
    })) : [emptyStage()]);
    setMedia(mediaWithUrls);
    setMessage("");
  }

  function updateStage(index: number, key: keyof Stage, value: string) {
    setStages((current) => current.map((stage, i) => i === index ? { ...stage, [key]: value } : stage));
  }

  function moveStage(index: number, direction: -1 | 1) {
    setStages((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  async function removeImage(item: MediaItem) {
    if (!window.confirm("Remove this image from the experiment?")) return;

    const supabase = createClient();
    const { error: storageError } = await supabase.storage.from("experiment-media").remove([item.storage_path]);
    if (storageError) {
      setMessage(storageError.message);
      return;
    }

    const { error } = await supabase.from("experiment_media").delete().eq("id", item.id);
    if (error) {
      setMessage(error.message);
      return;
    }

    setMedia((current) => current.filter((entry) => entry.id !== item.id));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!experiment) return;

    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("Saving experiment...");

    try {
      const supabase = createClient();
      const toNumber = (key: string) => form.get(key) ? Number(form.get(key)) : null;
      const outcome = String(form.get("outcome") || "");

      const { error: experimentError } = await supabase
        .from("experiments")
        .update({
          title: String(form.get("title") || ""),
          researcher_name: String(form.get("researcher_name") || ""),
          research_question: String(form.get("research_question") || ""),
          summary: String(form.get("summary") || ""),
          material_name: String(form.get("material_name") || ""),
          material_condition: String(form.get("material_condition") || ""),
          thickness_mm: toNumber("thickness_mm"),
          outcome: outcome || null,
          undercut_depth_mm: toNumber("undercut_depth_mm"),
          springback_deg: toNumber("springback_deg"),
          observations: String(form.get("observations") || ""),
          failure_notes: String(form.get("failure_notes") || ""),
        })
        .eq("id", experiment.id);

      if (experimentError) throw experimentError;

      const { error: deleteStagesError } = await supabase.from("experiment_stages").delete().eq("experiment_id", experiment.id);
      if (deleteStagesError) throw new Error(`Experiment saved, but stages could not be replaced: ${deleteStagesError.message}`);

      const stageRows = stages
        .filter((stage) => Object.values(stage).some((value) => String(value).trim()))
        .map((stage, index) => ({
          experiment_id: experiment.id,
          stage_number: index + 1,
          title: stage.title || `Stage ${index + 1}`,
          forming_operation: stage.forming_operation,
          tool_material: stage.tool_material,
          press_force_tons: stage.press_force_tons ? Number(stage.press_force_tons) : null,
          constraint_type: stage.constraint_type,
          observations: stage.observations,
        }));

      if (stageRows.length) {
        const { error } = await supabase.from("experiment_stages").insert(stageRows);
        if (error) throw new Error(`Experiment saved, but stages could not be saved: ${error.message}`);
      }

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Your session expired before media upload.");

      const files = form.getAll("media").filter((entry): entry is File => entry instanceof File && entry.size > 0);
      for (let index = 0; index < files.length; index++) {
        setMessage(`Uploading image ${index + 1} of ${files.length}...`);
        const file = files[index];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const storagePath = `${experiment.id}/${Date.now()}-${index}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("experiment-media").upload(storagePath, file, { upsert: false });
        if (uploadError) throw new Error(`Image ${index + 1} could not be uploaded: ${uploadError.message}`);

        const { error: mediaError } = await supabase.from("experiment_media").insert({
          experiment_id: experiment.id,
          storage_path: storagePath,
          media_type: "result",
          caption: file.name,
          display_order: media.length + index,
          created_by: auth.user.id,
        });
        if (mediaError) throw new Error(`Image ${index + 1} uploaded, but media metadata could not be saved: ${mediaError.message}`);
      }

      window.location.href = `/experiments/${experiment.id}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save experiment.");
      setBusy(false);
    }
  }

  if (!experiment) {
    return (
      <section className="page-shell narrow-shell">
        <div className="notice">{message}</div>
      </section>
    );
  }

  return (
    <section className="page-shell">
      <div className="page-heading split-heading">
        <div>
          <p className="eyebrow">{experiment.code}</p>
          <h1>Edit experiment</h1>
          <p>Update experiment details, forming stages, and media without recreating the research record.</p>
        </div>
        <Link className="button" href={`/experiments/${experiment.id}`}>Open Experiment</Link>
      </div>

      <form className="experiment-form" onSubmit={save}>
        <fieldset>
          <legend><span>01</span> Research question</legend>
          <div className="form-grid">
            <label>Experiment title<input name="title" required defaultValue={experiment.title} /></label>
            <label>Researcher<input name="researcher_name" required defaultValue={experiment.researcher_name ?? ""} /></label>
            <label className="full">Question / hypothesis<textarea name="research_question" rows={4} defaultValue={experiment.research_question ?? ""} /></label>
            <label className="full">Short summary<textarea name="summary" rows={3} defaultValue={experiment.summary ?? ""} /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>02</span> Initial material</legend>
          <div className="form-grid form-grid-3">
            <label>Material<input name="material_name" defaultValue={experiment.material_name ?? ""} /></label>
            <label>Condition<input name="material_condition" defaultValue={experiment.material_condition ?? ""} /></label>
            <label>Thickness (mm)<input name="thickness_mm" type="number" min="0" step="0.01" defaultValue={experiment.thickness_mm ?? ""} /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>03</span> Forming sequence</legend>
          <div className="stage-editor">
            {stages.map((stage, index) => (
              <div className="stage-editor-card" key={`${stage.id ?? "new"}-${index}`}>
                <div className="stage-editor-head">
                  <strong>Stage {String(index + 1).padStart(2, "0")}</strong>
                  <span className="inline-actions">
                    <button type="button" disabled={index === 0} onClick={() => moveStage(index, -1)}>Up</button>
                    <button type="button" disabled={index === stages.length - 1} onClick={() => moveStage(index, 1)}>Down</button>
                    {stages.length > 1 && <button type="button" onClick={() => setStages((current) => current.filter((_, i) => i !== index))}>Remove</button>}
                  </span>
                </div>
                <div className="form-grid form-grid-3">
                  <label>Stage title<input value={stage.title} onChange={(e) => updateStage(index, "title", e.target.value)} /></label>
                  <label>Operation<input value={stage.forming_operation} onChange={(e) => updateStage(index, "forming_operation", e.target.value)} /></label>
                  <label>Tool material<input value={stage.tool_material} onChange={(e) => updateStage(index, "tool_material", e.target.value)} /></label>
                  <label>Press force (tons)<input type="number" min="0" step="0.1" value={stage.press_force_tons} onChange={(e) => updateStage(index, "press_force_tons", e.target.value)} /></label>
                  <label>Constraint / restraint<input value={stage.constraint_type} onChange={(e) => updateStage(index, "constraint_type", e.target.value)} /></label>
                  <label className="full">Stage observations<textarea rows={3} value={stage.observations} onChange={(e) => updateStage(index, "observations", e.target.value)} /></label>
                </div>
              </div>
            ))}
            <button className="button" type="button" onClick={() => setStages((current) => [...current, emptyStage()])}>+ Add Stage</button>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>04</span> Result</legend>
          <div className="form-grid form-grid-3">
            <label>Outcome<select name="outcome" defaultValue={experiment.outcome ?? ""}><option value="">Select</option><option>successful</option><option>partial</option><option>failed</option><option>unexpected</option></select></label>
            <label>Undercut depth (mm)<input name="undercut_depth_mm" type="number" min="0" step="0.01" defaultValue={experiment.undercut_depth_mm ?? ""} /></label>
            <label>Springback (deg)<input name="springback_deg" type="number" min="0" step="0.1" defaultValue={experiment.springback_deg ?? ""} /></label>
            <label className="full">General observations<textarea name="observations" rows={4} defaultValue={experiment.observations ?? ""} /></label>
            <label className="full">Failure / behavior notes<textarea name="failure_notes" rows={4} defaultValue={experiment.failure_notes ?? ""} /></label>
            <label className="full">Add images<input name="media" type="file" accept="image/*" multiple /></label>
          </div>
        </fieldset>

        {media.length > 0 && (
          <fieldset>
            <legend><span>05</span> Existing images</legend>
            <div className="media-grid">
              {media.map((item) => (
                <figure key={item.id}>
                  {item.signedUrl && <img src={item.signedUrl} alt={item.caption || item.media_type || "Experiment image"} />}
                  <figcaption><span>{item.media_type}</span>{item.caption}</figcaption>
                  <button type="button" onClick={() => removeImage(item)}>Remove Image</button>
                </figure>
              ))}
            </div>
          </fieldset>
        )}

        <div className="submit-bar">
          <button className="button primary" type="submit" disabled={busy}>Save Changes</button>
          {message && <span className="form-message">{message}</span>}
        </div>
      </form>
    </section>
  );
}
