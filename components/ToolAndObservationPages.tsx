"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { EditorialStatus, LibraryMedia, editorialStatuses, isEditableStatus, mediaTypes, numberOrNull, stringOrNull, syncPublished } from "../lib/library";
import type { ResearchAccessState } from "../lib/access";
import { MediaGrid } from "./MediaGrid";
import { StatusPill } from "./StatusPill";

type Option = { id: string; label: string };
type RecordShape = Record<string, string | number | boolean | null>;

type FormingTool = {
  id: string;
  name: string;
  tool_code: string | null;
  description: string | null;
  tool_type: string | null;
  geometry_description: string | null;
  geometry_file_url: string | null;
  tool_material_id: string | null;
  tool_product_id: string | null;
  fabrication_method: string | null;
  printer_equipment_id: string | null;
  created_by: string | null;
  status: string | null;
  visibility: string | null;
  materials?: { id: string; name: string } | null;
  products?: { id: string; product_name: string; materials?: { id: string; name: string } | null } | null;
  equipment?: { id: string; name: string } | null;
  forming_tool_print_settings?: PrintSettings[] | null;
};

type PrintSettings = {
  id?: string;
  print_material_text: string | null;
  material_id: string | null;
  product_id: string | null;
  printer_equipment_id: string | null;
  slicer: string | null;
  print_profile_name: string | null;
  nozzle_diameter_mm: number | null;
  nozzle_type: string | null;
  layer_height_mm: number | null;
  wall_count: number | null;
  top_shell_layers: number | null;
  bottom_shell_layers: number | null;
  infill_percent: number | null;
  infill_pattern: string | null;
  print_orientation: string | null;
  support_enabled: boolean | null;
  support_type: string | null;
  support_interface_notes: string | null;
  nozzle_temperature_c: number | null;
  bed_temperature_c: number | null;
  plate_type: string | null;
  part_cooling_percent: number | null;
  aux_fan_percent: number | null;
  print_speed_notes: string | null;
  estimated_print_time_minutes: number | null;
  actual_print_time_minutes: number | null;
  filament_used_g: number | null;
  additional_settings: string | null;
  materials?: { name: string } | null;
  products?: { product_name: string } | null;
  equipment?: { name: string } | null;
};

type Observation = {
  id: string;
  experiment_id: string;
  stage_id: string | null;
  observation_type: string;
  severity: string | null;
  location: string | null;
  geometry_relationship: string | null;
  description: string | null;
  measurement_value: number | null;
  measurement_unit: string | null;
  cause_notes: string | null;
  experiments?: { id: string; code: string | null; title: string; material_name: string | null; forming_method: string | null } | null;
  experiment_stages?: { id: string; stage_number: number | null; title: string | null } | null;
  experiment_observation_media?: { caption: string | null; experiment_media: ExperimentMedia | ExperimentMedia[] | null }[] | null;
};

type ExperimentMedia = {
  id: string;
  storage_path: string;
  caption: string | null;
  media_type: string | null;
  display_order: number | null;
  signedUrl?: string | null;
};

const toolFields = ["name", "tool_code", "tool_type", "description", "geometry_description", "geometry_file_url", "fabrication_method"] as const;
const printNumberFields = new Set(["nozzle_diameter_mm", "layer_height_mm", "wall_count", "top_shell_layers", "bottom_shell_layers", "infill_percent", "nozzle_temperature_c", "bed_temperature_c", "part_cooling_percent", "aux_fan_percent", "estimated_print_time_minutes", "actual_print_time_minutes", "filament_used_g"]);
const printFields = ["print_material_text", "material_id", "product_id", "printer_equipment_id", "slicer", "print_profile_name", "nozzle_diameter_mm", "nozzle_type", "layer_height_mm", "wall_count", "top_shell_layers", "bottom_shell_layers", "infill_percent", "infill_pattern", "print_orientation", "support_type", "support_interface_notes", "nozzle_temperature_c", "bed_temperature_c", "plate_type", "part_cooling_percent", "aux_fan_percent", "print_speed_notes", "estimated_print_time_minutes", "actual_print_time_minutes", "filament_used_g", "additional_settings"] as const;
const toolTypes = ["male die", "female die", "matched die", "insert", "compliant insert", "backing tool", "restraining tool", "calibration tool", "restrike tool"];
const fabricationMethods = ["FDM / FFF", "SLA", "SLS", "machined", "cast", "hand fabricated", "other"];
export const defaultObservationTypes = ["Wrinkling", "Creasing", "Folding", "Buckling", "Tearing", "Cracking", "Thinning", "Necking", "Springback", "Surface Marking", "Tool Imprint", "Material Slip", "Material Flow", "Local Stretching", "Local Compression", "Undercut Formation", "Re-entrant Formation", "Tool Deformation", "Tool Failure", "Unexpected Behavior", "Other"];

function isApprovedAccess(state?: ResearchAccessState) {
  return state === "researcher" || state === "admin";
}

async function loadLibraryMedia(entityType: string, entityIds: string[]) {
  const supabase = createClient();
  if (!entityIds.length) return new Map<string, LibraryMedia[]>();
  const { data } = await supabase.from("library_media").select("*").eq("entity_type", entityType).in("entity_id", entityIds).order("display_order", { ascending: true });
  const signed = await Promise.all(((data ?? []) as LibraryMedia[]).map(async (item) => {
    if (!item.storage_path) return { ...item, signedUrl: null };
    const { data: url } = await supabase.storage.from("library-media").createSignedUrl(item.storage_path, 3600);
    return { ...item, signedUrl: url?.signedUrl ?? null };
  }));
  return signed.reduce((map, item) => {
    map.set(item.entity_id, [...(map.get(item.entity_id) ?? []), item]);
    return map;
  }, new Map<string, LibraryMedia[]>());
}

function firstMedia(media: Map<string, LibraryMedia[]>, id: string) {
  const item = (media.get(id) ?? []).sort((a, b) => Number(b.is_primary === true) - Number(a.is_primary === true) || Number(a.display_order ?? 0) - Number(b.display_order ?? 0))[0];
  return item?.signedUrl || item?.external_url || "";
}

function DetailPair({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function canEditRecord(record: { status?: string | null; created_by?: string | null }, userId: string, role: string) {
  return role === "admin" || (!!userId && record.created_by === userId && isEditableStatus(record.status || "draft"));
}

export function FormingToolsPage({ accessState }: { accessState?: ResearchAccessState }) {
  const [items, setItems] = useState<FormingTool[]>([]);
  const [media, setMedia] = useState(new Map<string, LibraryMedia[]>());
  const [message, setMessage] = useState("Loading...");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [method, setMethod] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase.from("forming_tools").select("*, materials(id, name), products(id, product_name, materials(id, name)), equipment(id, name), forming_tool_print_settings(*)").order("updated_at", { ascending: false }).limit(100);
      if (error) {
        setMessage(error.message);
        return;
      }
      const tools = (data ?? []) as FormingTool[];
      setItems(tools);
      setMedia(await loadLibraryMedia("forming_tool", tools.map((item) => item.id)));
      setMessage("");
    }
    load();
  }, []);

  const filtered = useMemo(() => items.filter((item) => {
    const text = [item.name, item.tool_code, item.description, item.geometry_description, item.materials?.name, item.products?.product_name].join(" ").toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!type || item.tool_type === type) && (!method || item.fabrication_method === method);
  }), [items, query, type, method]);

  return (
    <section className="page-shell">
      <div className="page-heading split-heading">
        <div><p className="eyebrow">Fabrication Resources</p><h1>Forming Tools</h1><p>Reusable forming molds, inserts, dies, and tool assemblies with fabrication variables for repeatable experiments.</p></div>
        {isApprovedAccess(accessState) && <Link className="button primary" href="/contribute/tools/new">+ ADD FORMING TOOL</Link>}
      </div>
      <div className="filter-bar"><input placeholder="Search tools, code, geometry, material" value={query} onChange={(event) => setQuery(event.target.value)} /><select value={type} onChange={(event) => setType(event.target.value)}><option value="">All tool types</option>{toolTypes.map((item) => <option key={item}>{item}</option>)}</select><select value={method} onChange={(event) => setMethod(event.target.value)}><option value="">All fabrication</option>{fabricationMethods.map((item) => <option key={item}>{item}</option>)}</select></div>
      {message && <div className="notice">{message}</div>}
      {!message && filtered.length === 0 && <div className="empty-state"><strong>NO FORMING TOOLS YET</strong><p>Document printed and fabricated tooling as reusable experimental variables.</p>{isApprovedAccess(accessState) && <Link className="button primary" href="/contribute/tools/new">+ ADD FORMING TOOL</Link>}</div>}
      <div className="research-index">{filtered.map((item) => {
        const settings = item.forming_tool_print_settings?.[0];
        return <Link href={`/resources/tools/${item.id}`} className="research-card" key={item.id}>{firstMedia(media, item.id) ? <img loading="lazy" src={firstMedia(media, item.id)} alt={item.name} /> : <div className="media-placeholder">No image</div>}<div><span>{item.tool_code || item.tool_type || "Forming tool"}</span><h2>{item.name}</h2><small>{[item.fabrication_method, item.materials?.name, item.products?.product_name].filter(Boolean).join(" / ")}</small><p>{item.geometry_description || item.description || "No geometry notes recorded."}</p>{settings && <b>{[settings.print_material_text, settings.layer_height_mm && `${settings.layer_height_mm} mm`, settings.wall_count && `${settings.wall_count} walls`, settings.infill_percent && `${settings.infill_percent}% infill`, settings.print_orientation].filter(Boolean).join(" / ")}</b>}</div></Link>;
      })}</div>
    </section>
  );
}

export function FormingToolDetailPage({ id }: { id: string }) {
  const [item, setItem] = useState<FormingTool | null>(null);
  const [media, setMedia] = useState<LibraryMedia[]>([]);
  const [experiments, setExperiments] = useState<{ href: string; title: string; detail: string }[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        setUserId(auth.user.id);
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
        setRole(profile?.role ?? "");
      }
      const { data, error } = await supabase.from("forming_tools").select("*, materials(id, name), products(id, product_name, materials(id, name)), equipment(id, name), forming_tool_print_settings(*, materials(name), products(product_name), equipment(name))").eq("id", id).single();
      if (error || !data) {
        setMessage("RESEARCH ACCESS REQUIRED");
        return;
      }
      setItem(data as FormingTool);
      setMedia((await loadLibraryMedia("forming_tool", [id])).get(id) ?? []);
      const { data: stageLinks } = await supabase.from("experiment_stage_tools").select("role, experiment_stages(stage_number, title, experiments(id, code, title, material_name, thickness_mm, forming_method))").eq("forming_tool_id", id);
      const mapped = ((stageLinks ?? []) as any[]).map((row) => {
        const stage = Array.isArray(row.experiment_stages) ? row.experiment_stages[0] : row.experiment_stages;
        const exp = Array.isArray(stage?.experiments) ? stage.experiments[0] : stage?.experiments;
        return exp ? { href: `/experiments/${exp.id}`, title: `${exp.code || "Experiment"} / ${exp.title}`, detail: [`Stage ${String(stage.stage_number || "")}`, stage.title, row.role, exp.material_name, exp.thickness_mm ? `${exp.thickness_mm} mm` : null, exp.forming_method].filter(Boolean).join(" / ") } : null;
      }).filter(Boolean) as { href: string; title: string; detail: string }[];
      setExperiments(mapped);
      setMessage("");
    }
    load();
  }, [id]);

  if (!item) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  const settings = item.forming_tool_print_settings?.[0];
  const canEdit = canEditRecord(item, userId, role);

  return (
    <section className="page-shell experiment-detail">
      <div className="detail-head"><div><p className="eyebrow">{item.tool_code || item.tool_type || "Forming Tool"}</p><h1>{item.name}</h1><p className="lede">{item.description}</p></div><div className="detail-actions"><StatusPill status={item.status || "draft"} />{canEdit && <Link className="button" href={`/contribute/tools/${item.id}/edit`}>EDIT</Link>}</div></div>
      <div className="facts-grid"><DetailPair label="Type" value={item.tool_type} /><DetailPair label="Material" value={item.materials?.name} /><DetailPair label="Exact Product" value={item.products?.product_name} /><DetailPair label="Fabrication" value={item.fabrication_method} /><DetailPair label="Printer" value={item.equipment?.name} /><DetailPair label="Geometry File" value={item.geometry_file_url ? <a href={item.geometry_file_url} target="_blank" rel="noopener noreferrer">Open file</a> : null} /></div>
      <MediaGrid items={media} />
      <section className="detail-section grid-2"><div><p className="section-index">Geometry</p><p>{item.geometry_description || "No geometry description recorded."}</p></div><div><p className="section-index">Tool Construction</p><p>{[item.fabrication_method, item.materials?.name, item.products?.product_name].filter(Boolean).join(" / ") || "No fabrication notes recorded."}</p></div></section>
      <section className="detail-section"><p className="section-index">Print Settings</p>{settings ? <div className="facts-grid"><DetailPair label="Print Material" value={settings.print_material_text || settings.materials?.name || settings.products?.product_name} /><DetailPair label="Printer" value={settings.equipment?.name} /><DetailPair label="Slicer / Profile" value={[settings.slicer, settings.print_profile_name].filter(Boolean).join(" / ")} /><DetailPair label="Nozzle" value={[settings.nozzle_diameter_mm && `${settings.nozzle_diameter_mm} mm`, settings.nozzle_type].filter(Boolean).join(" / ")} /><DetailPair label="Layer Height" value={settings.layer_height_mm ? `${settings.layer_height_mm} mm` : null} /><DetailPair label="Walls" value={settings.wall_count} /><DetailPair label="Shells" value={[settings.top_shell_layers && `${settings.top_shell_layers} top`, settings.bottom_shell_layers && `${settings.bottom_shell_layers} bottom`].filter(Boolean).join(" / ")} /><DetailPair label="Infill" value={[settings.infill_percent && `${settings.infill_percent}%`, settings.infill_pattern].filter(Boolean).join(" / ")} /><DetailPair label="Orientation" value={settings.print_orientation} /><DetailPair label="Supports" value={[settings.support_enabled === true ? "enabled" : settings.support_enabled === false ? "disabled" : null, settings.support_type, settings.support_interface_notes].filter(Boolean).join(" / ")} /><DetailPair label="Temperatures" value={[settings.nozzle_temperature_c && `${settings.nozzle_temperature_c} C nozzle`, settings.bed_temperature_c && `${settings.bed_temperature_c} C bed`, settings.plate_type].filter(Boolean).join(" / ")} /><DetailPair label="Cooling" value={[settings.part_cooling_percent && `${settings.part_cooling_percent}% part`, settings.aux_fan_percent && `${settings.aux_fan_percent}% aux`].filter(Boolean).join(" / ")} /><DetailPair label="Print Time" value={[settings.estimated_print_time_minutes && `${settings.estimated_print_time_minutes} min estimated`, settings.actual_print_time_minutes && `${settings.actual_print_time_minutes} min actual`].filter(Boolean).join(" / ")} /><DetailPair label="Filament Used" value={settings.filament_used_g ? `${settings.filament_used_g} g` : null} /><DetailPair label="Additional Settings" value={settings.additional_settings} /></div> : <p>No detailed print settings recorded.</p>}</section>
      <section className="detail-section"><p className="section-index">Experiments Using This Tool</p><div className="related-list">{experiments.map((experiment) => <Link href={experiment.href} key={`${experiment.href}-${experiment.detail}`}><strong>{experiment.title}</strong><small>{experiment.detail}</small></Link>)}{experiments.length === 0 && <p>No experiment stages link to this tool yet.</p>}</div></section>
    </section>
  );
}

export function FormingToolEditor({ id }: { id?: string }) {
  const [record, setRecord] = useState<RecordShape>({ status: "draft", visibility: "internal" });
  const [settings, setSettings] = useState<RecordShape>({});
  const [media, setMedia] = useState<LibraryMedia[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({ materials: [], products: [], equipment: [] });
  const [allowed, setAllowed] = useState(!id);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState(id ? "Loading..." : "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setMessage("Sign in to edit this record.");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role, approval_status, is_active").eq("id", auth.user.id).single();
      const adminUser = profile?.role === "admin";
      setIsAdmin(adminUser);
      if (!adminUser && (profile?.approval_status !== "approved" || profile.is_active === false)) {
        setMessage("Approved research access is required to contribute.");
        return;
      }
      const [materialRows, productRows, equipmentRows] = await Promise.all([
        supabase.from("materials").select("id, name").order("name"),
        supabase.from("products").select("id, product_name").order("product_name"),
        supabase.from("equipment").select("id, name").order("name"),
      ]);
      setOptions({
        materials: ((materialRows.data ?? []) as { id: string; name: string }[]).map((item) => ({ id: item.id, label: item.name })),
        products: ((productRows.data ?? []) as { id: string; product_name: string }[]).map((item) => ({ id: item.id, label: item.product_name })),
        equipment: ((equipmentRows.data ?? []) as { id: string; name: string }[]).map((item) => ({ id: item.id, label: item.name })),
      });
      if (!id) {
        setAllowed(true);
        setMessage("");
        return;
      }
      const { data, error } = await supabase.from("forming_tools").select("*, forming_tool_print_settings(*)").eq("id", id).single();
      if (error || !data) {
        setMessage(error?.message ?? "Tool not found.");
        return;
      }
      const loaded = data as FormingTool;
      setRecord(loaded as unknown as RecordShape);
      setSettings((loaded.forming_tool_print_settings?.[0] ?? {}) as unknown as RecordShape);
      const canEdit = adminUser || (loaded.created_by === auth.user.id && isEditableStatus(String(loaded.status ?? "draft")));
      setAllowed(canEdit);
      if (!canEdit) setMessage("This forming tool is read-only for your account.");
      else setMessage("");
      setMedia((await loadLibraryMedia("forming_tool", [id])).get(id) ?? []);
    }
    load();
  }, [id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("Saving tool...");
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage("Sign in to save.");
      setBusy(false);
      return;
    }
    const status = isAdmin ? String(form.get("status") || "draft") as EditorialStatus : submitter?.value === "submitted" ? "submitted" : "draft";
    const payload: RecordShape = { created_by: id ? record.created_by ?? auth.user.id : auth.user.id, status, is_published: syncPublished(status), visibility: isAdmin ? String(form.get("visibility") || "internal") : "internal" };
    toolFields.forEach((field) => { payload[field] = stringOrNull(form.get(field)); });
    payload.tool_material_id = stringOrNull(form.get("tool_material_id"));
    payload.tool_product_id = stringOrNull(form.get("tool_product_id"));
    payload.printer_equipment_id = stringOrNull(form.get("printer_equipment_id"));
    const result = id ? await supabase.from("forming_tools").update(payload).eq("id", id).select("id").single() : await supabase.from("forming_tools").insert(payload).select("id").single();
    if (result.error || !result.data) {
      setMessage(result.error?.message ?? "Unable to save tool.");
      setBusy(false);
      return;
    }
    const savedId = String(result.data.id);
    const printPayload: RecordShape = { forming_tool_id: savedId, support_enabled: form.get("support_enabled") === "on" };
    printFields.forEach((field) => { printPayload[field] = printNumberFields.has(field) ? numberOrNull(form.get(field)) : stringOrNull(form.get(field)); });
    printPayload.printer_equipment_id = stringOrNull(form.get("print_printer_equipment_id")) || stringOrNull(form.get("printer_equipment_id"));
    const hasPrintData = Object.entries(printPayload).some(([key, value]) => key !== "forming_tool_id" && key !== "support_enabled" && value !== null && value !== "");
    if (id) await supabase.from("forming_tool_print_settings").delete().eq("forming_tool_id", savedId);
    if (hasPrintData || printPayload.support_enabled === true) {
      const { error } = await supabase.from("forming_tool_print_settings").insert(printPayload);
      if (error) {
        setMessage(`Tool saved, but print settings could not be saved: ${error.message}`);
        setBusy(false);
        return;
      }
    }
    await saveMedia(savedId, form);
    window.location.href = isAdmin ? `/resources/tools/${savedId}` : "/my-work";
  }

  async function saveMedia(entityId: string, form: FormData) {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const caption = stringOrNull(form.get("media_caption"));
    const mediaType = stringOrNull(form.get("media_type")) || "tooling";
    const externalUrl = stringOrNull(form.get("external_url"));
    const isPrimary = form.get("media_primary") === "on";
    if (isPrimary) await supabase.from("library_media").update({ is_primary: false }).eq("entity_type", "forming_tool").eq("entity_id", entityId);
    if (externalUrl) await supabase.from("library_media").insert({ entity_type: "forming_tool", entity_id: entityId, external_url: externalUrl, caption, media_type: mediaType, display_order: media.length, is_primary: isPrimary, created_by: auth.user.id });
    const files = form.getAll("media").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `forming_tool/${entityId}/${Date.now()}-${index}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("library-media").upload(storagePath, file, { upsert: false });
      if (uploadError) throw uploadError;
      await supabase.from("library_media").insert({ entity_type: "forming_tool", entity_id: entityId, storage_path: storagePath, caption: caption || file.name, media_type: mediaType, display_order: media.length + index, is_primary: isPrimary && index === 0, created_by: auth.user.id });
    }
  }

  if (id && !Object.keys(record).length) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;

  return (
    <section className="page-shell">
      <div className="page-heading split-heading"><div><p className="eyebrow">Contribute</p><h1>{id ? "Edit forming tool" : "New forming tool"}</h1><p>{allowed ? "Capture geometry, construction, material, print settings, and tool images." : "This record is read-only for your account."}</p></div>{id && <Link className="button" href={`/resources/tools/${id}`}>Open Tool</Link>}</div>
      {message && <div className="notice">{message}</div>}
      <form className="experiment-form" onSubmit={save}>
        <fieldset><legend><span>01</span> Tool identity</legend><div className="form-grid form-grid-3"><Input name="name" label="Name" value={record.name} required disabled={!allowed} /><Input name="tool_code" label="Code" value={record.tool_code} disabled={!allowed} /><SelectText name="tool_type" label="Type" value={record.tool_type} options={toolTypes} disabled={!allowed} /><Area name="description" label="Description" value={record.description} disabled={!allowed} /></div></fieldset>
        <fieldset><legend><span>02</span> Geometry</legend><div className="form-grid"><Area name="geometry_description" label="Geometry description" value={record.geometry_description} disabled={!allowed} /><Input name="geometry_file_url" label="Geometry file URL" value={record.geometry_file_url} disabled={!allowed} /></div></fieldset>
        <fieldset><legend><span>03</span> Tool material</legend><div className="form-grid form-grid-3"><Select name="tool_material_id" label="Material" value={String(record.tool_material_id ?? "")} options={options.materials} disabled={!allowed} /><Select name="tool_product_id" label="Exact product" value={String(record.tool_product_id ?? "")} options={options.products} disabled={!allowed} /></div></fieldset>
        <fieldset><legend><span>04</span> Fabrication</legend><div className="form-grid form-grid-3"><SelectText name="fabrication_method" label="Fabrication method" value={record.fabrication_method} options={fabricationMethods} disabled={!allowed} /><Select name="printer_equipment_id" label="Printer" value={String(record.printer_equipment_id ?? "")} options={options.equipment} disabled={!allowed} /></div></fieldset>
        <fieldset><legend><span>05</span> Print settings</legend><div className="form-grid form-grid-3"><Input name="print_material_text" label="Print material" value={settings.print_material_text} disabled={!allowed} /><Select name="material_id" label="Material record" value={String(settings.material_id ?? "")} options={options.materials} disabled={!allowed} /><Select name="product_id" label="Exact filament/product" value={String(settings.product_id ?? "")} options={options.products} disabled={!allowed} /><Select name="print_printer_equipment_id" label="Printer" value={String(settings.printer_equipment_id ?? "")} options={options.equipment} disabled={!allowed} /><Input name="slicer" label="Slicer" value={settings.slicer} disabled={!allowed} /><Input name="print_profile_name" label="Profile" value={settings.print_profile_name} disabled={!allowed} /><Input name="nozzle_diameter_mm" label="Nozzle diameter" type="number" value={settings.nozzle_diameter_mm} disabled={!allowed} /><Input name="nozzle_type" label="Nozzle type" value={settings.nozzle_type} disabled={!allowed} /><Input name="layer_height_mm" label="Layer height" type="number" value={settings.layer_height_mm} disabled={!allowed} /><Input name="wall_count" label="Wall count" type="number" value={settings.wall_count} disabled={!allowed} /><Input name="top_shell_layers" label="Top layers" type="number" value={settings.top_shell_layers} disabled={!allowed} /><Input name="bottom_shell_layers" label="Bottom layers" type="number" value={settings.bottom_shell_layers} disabled={!allowed} /><Input name="infill_percent" label="Infill %" type="number" value={settings.infill_percent} disabled={!allowed} /><Input name="infill_pattern" label="Infill pattern" value={settings.infill_pattern} disabled={!allowed} /><Input name="print_orientation" label="Print orientation" value={settings.print_orientation} disabled={!allowed} /><label><input name="support_enabled" type="checkbox" defaultChecked={settings.support_enabled === true} disabled={!allowed} /> Supports</label><Input name="support_type" label="Support type" value={settings.support_type} disabled={!allowed} /><Area name="support_interface_notes" label="Interface notes" value={settings.support_interface_notes} disabled={!allowed} /><Input name="nozzle_temperature_c" label="Nozzle temperature" type="number" value={settings.nozzle_temperature_c} disabled={!allowed} /><Input name="bed_temperature_c" label="Bed temperature" type="number" value={settings.bed_temperature_c} disabled={!allowed} /><Input name="plate_type" label="Plate type" value={settings.plate_type} disabled={!allowed} /><Input name="part_cooling_percent" label="Part cooling %" type="number" value={settings.part_cooling_percent} disabled={!allowed} /><Input name="aux_fan_percent" label="Aux cooling %" type="number" value={settings.aux_fan_percent} disabled={!allowed} /><Area name="print_speed_notes" label="Print speed notes" value={settings.print_speed_notes} disabled={!allowed} /><Input name="estimated_print_time_minutes" label="Estimated print time" type="number" value={settings.estimated_print_time_minutes} disabled={!allowed} /><Input name="actual_print_time_minutes" label="Actual print time" type="number" value={settings.actual_print_time_minutes} disabled={!allowed} /><Input name="filament_used_g" label="Filament used" type="number" value={settings.filament_used_g} disabled={!allowed} /><Area name="additional_settings" label="Additional settings" value={settings.additional_settings} disabled={!allowed} /></div></fieldset>
        <fieldset><legend><span>Images</span> Tool media</legend><MediaGrid items={media} /><div className="form-grid form-grid-3"><label>Upload image<input name="media" type="file" accept="image/*" multiple disabled={!allowed} /></label><label>External image URL<input name="external_url" disabled={!allowed} /></label><label>Media type<select name="media_type" defaultValue="tooling" disabled={!allowed}>{mediaTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label><input name="media_primary" type="checkbox" disabled={!allowed} /> Primary image</label><label className="full">Caption<input name="media_caption" disabled={!allowed} /></label></div></fieldset>
        {isAdmin && <fieldset><legend><span>Status</span> Review</legend><div className="form-grid form-grid-3"><label>Status<select name="status" defaultValue={String(record.status ?? "draft")} disabled={!allowed}>{editorialStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><label>Visibility<select name="visibility" defaultValue={String(record.visibility ?? "internal")} disabled={!allowed}><option value="internal">Internal</option><option value="public">Public</option></select></label></div></fieldset>}
        {!isAdmin && <div className="notice">Visibility: Internal</div>}
        <div className="submit-bar">{!isAdmin && <button className="button" value="draft" type="submit" disabled={busy || !allowed}>Save Draft</button>}{!isAdmin && <button className="button primary" value="submitted" type="submit" disabled={busy || !allowed}>Submit for Review</button>}{isAdmin && <button className="button primary" type="submit" disabled={busy || !allowed}>Save Changes</button>}</div>
      </form>
    </section>
  );
}

export function ObservationIndexPage() {
  const [items, setItems] = useState<Observation[]>([]);
  const [message, setMessage] = useState("Loading...");
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const [material, setMaterial] = useState("");
  const [method, setMethod] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase.from("experiment_observations").select("*, experiments(id, code, title, material_name, forming_method), experiment_stages(id, stage_number, title), experiment_observation_media(caption, experiment_media(id, storage_path, caption, media_type, display_order))").order("created_at", { ascending: false }).limit(120);
      if (error) {
        setMessage(error.message);
        return;
      }
      const observations = (data ?? []) as Observation[];
      const signed = await Promise.all(observations.map(async (observation) => {
        const links = await Promise.all((observation.experiment_observation_media ?? []).map(async (link) => {
          const media = Array.isArray(link.experiment_media) ? link.experiment_media[0] : link.experiment_media;
          if (!media?.storage_path) return link;
          const { data: url } = await supabase.storage.from("experiment-media").createSignedUrl(media.storage_path, 3600);
          return { ...link, experiment_media: { ...media, signedUrl: url?.signedUrl ?? null } };
        }));
        return { ...observation, experiment_observation_media: links };
      }));
      setItems(signed);
      setMessage("");
    }
    load();
  }, []);

  const filtered = items.filter((item) => (!type || item.observation_type === type) && (!severity || item.severity === severity) && (!material || item.experiments?.material_name === material) && (!method || item.experiments?.forming_method === method));
  const types = Array.from(new Set([...defaultObservationTypes, ...items.map((item) => item.observation_type)])).filter(Boolean).sort();
  const severities = Array.from(new Set(items.map((item) => item.severity).filter(Boolean) as string[])).sort();
  const materials = Array.from(new Set(items.map((item) => item.experiments?.material_name).filter(Boolean) as string[])).sort();
  const methods = Array.from(new Set(items.map((item) => item.experiments?.forming_method).filter(Boolean) as string[])).sort();

  return (
    <section className="page-shell">
      <div className="page-heading"><p className="eyebrow">Visual Behavior Atlas</p><h1>Observations</h1><p>Image-led observations of forming behavior, failures, tool response, and geometry relationships from actual experiments.</p></div>
      <div className="filter-bar"><select value={type} onChange={(event) => setType(event.target.value)}><option value="">All types</option>{types.map((item) => <option key={item}>{item}</option>)}</select><select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="">All severity</option>{severities.map((item) => <option key={item}>{item}</option>)}</select><select value={material} onChange={(event) => setMaterial(event.target.value)}><option value="">All materials</option>{materials.map((item) => <option key={item}>{item}</option>)}</select><select value={method} onChange={(event) => setMethod(event.target.value)}><option value="">All forming methods</option>{methods.map((item) => <option key={item}>{item}</option>)}</select></div>
      {message && <div className="notice">{message}</div>}
      <div className="research-index">{filtered.map((item) => {
        const media = Array.isArray(item.experiment_observation_media?.[0]?.experiment_media) ? item.experiment_observation_media?.[0]?.experiment_media[0] : item.experiment_observation_media?.[0]?.experiment_media;
        return <Link className="research-card" href={`/experiments/${item.experiment_id}#observation-${item.id}`} key={item.id}>{media?.signedUrl ? <img loading="lazy" src={media.signedUrl} alt={item.experiment_observation_media?.[0]?.caption || media.caption || item.observation_type} /> : <div className="media-placeholder">No image</div>}<div><span>{item.observation_type}{item.severity ? ` / ${item.severity}` : ""}</span><h2>{item.experiments?.code || "Experiment"}</h2><small>{item.experiment_stages ? `Stage ${String(item.experiment_stages.stage_number || "")} / ${item.experiment_stages.title || ""}` : "Whole experiment"}</small><p>{item.geometry_relationship || item.description || item.location || "No observation detail recorded."}</p><b>{[item.experiments?.material_name, item.experiments?.forming_method].filter(Boolean).join(" / ")}</b></div></Link>;
      })}</div>
      {!message && filtered.length === 0 && <div className="empty-state"><strong>NO OBSERVATIONS FOUND</strong><p>Observation photos added during experiment entry will build this comparison atlas.</p></div>}
    </section>
  );
}

function Input({ name, label, value, type = "text", required = false, disabled = false }: { name: string; label: string; value?: string | number | boolean | null; type?: string; required?: boolean; disabled?: boolean }) {
  return <label>{label}<input name={name} type={type} step={type === "number" ? "0.01" : undefined} required={required} defaultValue={value == null ? "" : String(value)} disabled={disabled} /></label>;
}

function Area({ name, label, value, disabled = false }: { name: string; label: string; value?: string | number | boolean | null; disabled?: boolean }) {
  return <label className="full">{label}<textarea name={name} rows={3} defaultValue={value == null ? "" : String(value)} disabled={disabled} /></label>;
}

function Select({ name, label, options, value = "", disabled = false }: { name: string; label: string; options: Option[]; value?: string; disabled?: boolean }) {
  return <label>{label}<select name={name} defaultValue={value} disabled={disabled}><option value="">Select</option>{options.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>;
}

function SelectText({ name, label, options, value, disabled = false }: { name: string; label: string; options: string[]; value?: string | number | boolean | null; disabled?: boolean }) {
  return <label>{label}<select name={name} defaultValue={value == null ? "" : String(value)} disabled={disabled}><option value="">Select</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

export function ObservationCardFields({ index, stages, observationTypes = defaultObservationTypes }: { index: number; stages: { label: string; value: string }[]; observationTypes?: string[] }) {
  return (
    <details className="stage-editor-card" open={index === 0}>
      <summary className="stage-editor-head"><strong>Observation {String(index + 1).padStart(2, "0")}</strong></summary>
      <div className="form-grid form-grid-3">
        <label>Type<select name={`observation_type_${index}`}><option value="">Select</option>{observationTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Severity<input name={`observation_severity_${index}`} /></label>
        <label>Stage<select name={`observation_stage_index_${index}`}><option value="">Whole experiment</option>{stages.map((stage) => <option value={stage.value} key={stage.value}>{stage.label}</option>)}</select></label>
        <label>Location<input name={`observation_location_${index}`} /></label>
        <label className="full">Geometry relationship<textarea name={`observation_geometry_relationship_${index}`} rows={3} /></label>
        <label className="full">Description<textarea name={`observation_description_${index}`} rows={3} /></label>
        <label>Measurement<input name={`observation_measurement_value_${index}`} type="number" step="0.01" /></label>
        <label>Unit<input name={`observation_measurement_unit_${index}`} /></label>
        <label className="full">Possible cause / interpretation<textarea name={`observation_cause_notes_${index}`} rows={3} /></label>
        <label className="full">Photo<input name={`observation_media_${index}`} type="file" accept="image/*" multiple /></label>
        <label className="full">Photo caption<input name={`observation_caption_${index}`} /></label>
      </div>
    </details>
  );
}
