"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type Stage = {
  title: string;
  forming_operation: string;
  tool_material: string;
  press_force_tons: string;
  constraint_type: string;
  observations: string;
};

const emptyStage = (): Stage => ({
  title: "",
  forming_operation: "",
  tool_material: "",
  press_force_tons: "",
  constraint_type: "",
  observations: "",
});

export default function SubmitPage() {
  const [stages, setStages] = useState<Stage[]>([emptyStage()]);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  function updateStage(index: number, key: keyof Stage, value: string) {
    setStages((current) => current.map((stage, i) => i === index ? { ...stage, [key]: value } : stage));
  }

  async function submitExperiment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Please sign in before submitting an experiment.");

      const form = new FormData(event.currentTarget);
      const status = String(form.get("submit_mode") || "draft") === "submitted" ? "submitted" : "draft";

      const experimentPayload = {
        researcher_id: auth.user.id,
        researcher_name: String(form.get("researcher_name") || ""),
        title: String(form.get("title") || ""),
        summary: String(form.get("summary") || ""),
        research_question: String(form.get("research_question") || ""),
        material_name: String(form.get("material_name") || ""),
        material_condition: String(form.get("material_condition") || ""),
        thickness_mm: form.get("thickness_mm") ? Number(form.get("thickness_mm")) : null,
        outcome: String(form.get("outcome") || ""),
        undercut_depth_mm: form.get("undercut_depth_mm") ? Number(form.get("undercut_depth_mm")) : null,
        springback_deg: form.get("springback_deg") ? Number(form.get("springback_deg")) : null,
        observations: String(form.get("observations") || ""),
        failure_notes: String(form.get("failure_notes") || ""),
        status,
      };

      const { data: experiment, error: experimentError } = await supabase
        .from("experiments")
        .insert(experimentPayload)
        .select("id, code")
        .single();
      if (experimentError) throw experimentError;

      const stageRows = stages
        .filter((stage) => Object.values(stage).some((value) => value.trim()))
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
        if (error) throw error;
      }

      const files = form.getAll("media").filter((entry): entry is File => entry instanceof File && entry.size > 0);
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const storagePath = `${experiment.id}/${Date.now()}-${index}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("experiment-media").upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;
        const { error: mediaError } = await supabase.from("experiment_media").insert({
          experiment_id: experiment.id,
          storage_path: storagePath,
          media_type: "result",
          caption: file.name,
          display_order: index,
          created_by: auth.user.id,
        });
        if (mediaError) throw mediaError;
      }

      window.location.href = `/experiments/${experiment.id}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save experiment.");
      setBusy(false);
    }
  }

  if (userId === null) {
    return (
      <section className="page-shell narrow-shell">
        <div className="notice">Sign in to create an experiment. <a href="/login">Open researcher login →</a></div>
      </section>
    );
  }

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Research Portal</p>
        <h1>New experiment</h1>
        <p>Record the research question, initial sheet condition, each press stage, and the resulting geometry. Failures are retained as research data.</p>
      </div>

      <form className="experiment-form" onSubmit={submitExperiment}>
        <fieldset>
          <legend><span>01</span> Research question</legend>
          <div className="form-grid">
            <label>Experiment title<input name="title" required placeholder="TPU-assisted return test" /></label>
            <label>Researcher<input name="researcher_name" required /></label>
            <label className="full">Question / hypothesis<textarea name="research_question" rows={4} placeholder="What are we testing in this run?" /></label>
            <label className="full">Short summary<textarea name="summary" rows={3} /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>02</span> Initial material</legend>
          <div className="form-grid form-grid-3">
            <label>Material<input name="material_name" placeholder="Aluminum 3003" /></label>
            <label>Condition<input name="material_condition" placeholder="Annealed / as received" /></label>
            <label>Thickness (mm)<input name="thickness_mm" type="number" min="0" step="0.01" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>03</span> Forming sequence</legend>
          <div className="stage-editor">
            {stages.map((stage, index) => (
              <div className="stage-editor-card" key={index}>
                <div className="stage-editor-head"><strong>Stage {String(index + 1).padStart(2, "0")}</strong>{stages.length > 1 && <button type="button" onClick={() => setStages((current) => current.filter((_, i) => i !== index))}>Remove</button>}</div>
                <div className="form-grid form-grid-3">
                  <label>Stage title<input value={stage.title} onChange={(e) => updateStage(index, "title", e.target.value)} placeholder="Rigid pre-form" /></label>
                  <label>Operation<input value={stage.forming_operation} onChange={(e) => updateStage(index, "forming_operation", e.target.value)} placeholder="Draw / return / undercut" /></label>
                  <label>Tool material<input value={stage.tool_material} onChange={(e) => updateStage(index, "tool_material", e.target.value)} placeholder="PLA / TPU 95A" /></label>
                  <label>Press force (tons)<input type="number" min="0" step="0.1" value={stage.press_force_tons} onChange={(e) => updateStage(index, "press_force_tons", e.target.value)} /></label>
                  <label>Constraint / restraint<input value={stage.constraint_type} onChange={(e) => updateStage(index, "constraint_type", e.target.value)} placeholder="Enclosed / side restrained" /></label>
                  <label className="full">Stage observations<textarea rows={3} value={stage.observations} onChange={(e) => updateStage(index, "observations", e.target.value)} /></label>
                </div>
              </div>
            ))}
            <button className="button" type="button" onClick={() => setStages((current) => [...current, emptyStage()])}>+ Add press stage</button>
          </div>
        </fieldset>

        <fieldset>
          <legend><span>04</span> Result</legend>
          <div className="form-grid form-grid-3">
            <label>Outcome<select name="outcome" defaultValue=""><option value="">Select</option><option>successful</option><option>partial</option><option>failed</option><option>unexpected</option></select></label>
            <label>Undercut depth (mm)<input name="undercut_depth_mm" type="number" min="0" step="0.01" /></label>
            <label>Springback (deg)<input name="springback_deg" type="number" min="0" step="0.1" /></label>
            <label className="full">General observations<textarea name="observations" rows={4} /></label>
            <label className="full">Failure / behavior notes<textarea name="failure_notes" rows={4} placeholder="Wrinkling, thinning, tearing, tool distortion, surface marking…" /></label>
            <label className="full">Images<input name="media" type="file" accept="image/*" multiple /></label>
          </div>
        </fieldset>

        <div className="submit-bar">
          <button className="button" name="submit_mode" value="draft" type="submit" disabled={busy}>Save draft</button>
          <button className="button primary" name="submit_mode" value="submitted" type="submit" disabled={busy}>Submit for review</button>
          {message && <span className="form-message">{message}</span>}
        </div>
      </form>
    </section>
  );
}
