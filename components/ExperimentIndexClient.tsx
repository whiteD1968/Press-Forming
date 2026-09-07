"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusPill } from "./StatusPill";

type Experiment = Record<string, string | number | null>;

export function ExperimentIndexClient({ experiments, approved }: { experiments: Experiment[]; approved: boolean }) {
  const [query, setQuery] = useState("");
  const [material, setMaterial] = useState("");
  const [condition, setCondition] = useState("");
  const [method, setMethod] = useState("");
  const [geometry, setGeometry] = useState("");
  const [undercut, setUndercut] = useState("");
  const [outcome, setOutcome] = useState("");
  const [researcher, setResearcher] = useState("");
  const [status, setStatus] = useState("");
  const [minThickness, setMinThickness] = useState("");
  const [maxThickness, setMaxThickness] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "matrix">("list");

  const option = (key: string) => Array.from(new Set(experiments.map((item) => item[key]).filter(Boolean).map(String))).sort();
  const filtered = useMemo(() => experiments.filter((item) => {
    const text = [item.code, item.title, item.research_question, item.research_objective, item.summary, item.observations, item.conclusion].join(" ").toLowerCase();
    const thickness = Number(item.thickness_mm ?? Number.NaN);
    return (!query || text.includes(query.toLowerCase()))
      && (!material || item.material_name === material)
      && (!condition || item.material_condition === condition)
      && (!method || item.forming_method === method)
      && (!geometry || item.geometry_type === geometry)
      && (!undercut || item.undercut_type === undercut)
      && (!outcome || item.outcome === outcome)
      && (!researcher || item.researcher_name === researcher)
      && (!status || item.status === status)
      && (!minThickness || (!Number.isNaN(thickness) && thickness >= Number(minThickness)))
      && (!maxThickness || (!Number.isNaN(thickness) && thickness <= Number(maxThickness)));
  }), [experiments, query, material, condition, method, geometry, undercut, outcome, researcher, status, minThickness, maxThickness]);

  return (
    <>
      {approved && (
        <div className="filter-bar">
          <input placeholder="Search experiments" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select value={material} onChange={(event) => setMaterial(event.target.value)}><option value="">All materials</option>{option("material_name").map((value) => <option key={value}>{value}</option>)}</select>
          <select value={condition} onChange={(event) => setCondition(event.target.value)}><option value="">All conditions</option>{option("material_condition").map((value) => <option key={value}>{value}</option>)}</select>
          <input placeholder="Min thickness" type="number" value={minThickness} onChange={(event) => setMinThickness(event.target.value)} />
          <input placeholder="Max thickness" type="number" value={maxThickness} onChange={(event) => setMaxThickness(event.target.value)} />
          <select value={method} onChange={(event) => setMethod(event.target.value)}><option value="">All methods</option>{option("forming_method").map((value) => <option key={value}>{value}</option>)}</select>
          <select value={geometry} onChange={(event) => setGeometry(event.target.value)}><option value="">All geometry</option>{option("geometry_type").map((value) => <option key={value}>{value}</option>)}</select>
          <select value={undercut} onChange={(event) => setUndercut(event.target.value)}><option value="">All undercuts</option>{option("undercut_type").map((value) => <option key={value}>{value}</option>)}</select>
          <select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="">All outcomes</option>{option("outcome").map((value) => <option key={value}>{value}</option>)}</select>
          <select value={researcher} onChange={(event) => setResearcher(event.target.value)}><option value="">All researchers</option>{option("researcher_name").map((value) => <option key={value}>{value}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{option("status").map((value) => <option key={value}>{value}</option>)}</select>
          <button className={viewMode === "list" ? "button primary" : "button secondary"} type="button" onClick={() => setViewMode("list")}>List</button>
          <button className={viewMode === "matrix" ? "button primary" : "button secondary"} type="button" onClick={() => setViewMode("matrix")}>Matrix</button>
        </div>
      )}

      {approved && filtered.length > 0 && (
        <form className="form-panel" action="/experiments/compare">
          <div className="section-heading-row"><p className="section-index">Compare Experiments</p><button className="button" type="submit">Compare Selected</button></div>
          <div className="filter-bar">
            {filtered.map((experiment) => <label key={String(experiment.id)}><input name="id" type="checkbox" value={String(experiment.id)} /> {String(experiment.code || experiment.title)}</label>)}
          </div>
        </form>
      )}

      {viewMode === "matrix" && approved ? (
        <div className="comparison-table">
          <div className="comparison-row comparison-head"><span>Code</span><span>Material</span><span>Thickness</span><span>Method</span><span>Undercut</span><span>Outcome</span><span>Stages</span><span>Researcher</span></div>
          {filtered.map((experiment) => <Link className="comparison-row" href={`/experiments/${experiment.id}`} key={String(experiment.id)}><span>{String(experiment.code || "-")}</span><span>{String(experiment.material_name || "-")}</span><span>{experiment.thickness_mm ? `${experiment.thickness_mm} mm` : "-"}</span><span>{String(experiment.forming_method || "-")}</span><span>{String(experiment.undercut_type || "-")}</span><span>{String(experiment.outcome || "-")}</span><span>{String(experiment.stage_count || "0")}</span><span>{String(experiment.researcher_name || "-")}</span></Link>)}
        </div>
      ) : (
        <div className="experiment-list">
          {filtered.map((experiment) => (
            <Link href={`/experiments/${experiment.id}`} className="experiment-row" key={String(experiment.id)}>
              <div className="experiment-code">{experiment.code}</div>
              <div className="experiment-main">
                <h2>{experiment.title}</h2>
                <p>{experiment.summary || "No summary recorded."}</p>
              </div>
              <div className="experiment-meta">
                <span>{experiment.material_name || "-"}</span>
                <span>{experiment.thickness_mm ? `${experiment.thickness_mm} mm` : "-"}</span>
                {experiment.outcome && <span>{experiment.outcome}</span>}
                <StatusPill status={String(experiment.status)} />
                {approved && experiment.visibility && <span className="status-pill">{String(experiment.visibility).toUpperCase()}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
