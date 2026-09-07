"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { EditorialStatus, editorialStatuses, isEditableStatus, LibraryMedia, mediaTypes, numberOrNull, stringOrNull, syncPublished } from "../lib/library";
import { MediaGrid } from "./MediaGrid";
import { StatusPill } from "./StatusPill";

type Kind = "research" | "material" | "product" | "vendor" | "equipment" | "atlas";
type Option = { id: string; label: string };
type Field = { name: string; label: string; type?: "text" | "number" | "date" | "textarea" | "select"; section?: string; options?: string[] };
type RecordShape = Record<string, string | number | boolean | null>;

const configs: Record<Kind, { table: string; titleField: string; entityType?: string; publicHref: (id: string) => string; fields: Field[] }> = {
  research: {
    table: "research_sources",
    titleField: "title",
    entityType: "research_source",
    publicHref: (id) => `/research/${id}`,
    fields: [
      { name: "title", label: "Title" },
      { name: "source_type", label: "Source type", type: "select", options: ["Article", "Journal Paper", "Conference Paper", "Patent", "Book", "Thesis", "Technical Manual", "Historical Object", "Image", "Video", "Website", "Supplier Page"] },
      { name: "author", label: "Author" },
      { name: "publication_year", label: "Publication year", type: "number" },
      { name: "publisher", label: "Publisher" },
      { name: "source_date", label: "Source date", type: "date" },
      { name: "url", label: "URL" },
      { name: "doi", label: "DOI" },
      { name: "citation", label: "Citation", type: "textarea" },
      { name: "file_url", label: "File URL" },
      { name: "abstract", label: "Abstract", type: "textarea" },
      { name: "summary", label: "Summary", type: "textarea" },
      { name: "historical_context", label: "Historical context", type: "textarea" },
      { name: "principle", label: "Principle", type: "textarea" },
      { name: "research_translation", label: "Research translation", type: "textarea" },
      { name: "forming_method", label: "Forming method" },
      { name: "material_relevance", label: "Material relevance", type: "textarea" },
      { name: "tool_relevance", label: "Tool relevance", type: "textarea" },
      { name: "undercut_relevance", label: "Undercut relevance", type: "textarea" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  material: {
    table: "materials",
    titleField: "name",
    entityType: "material",
    publicHref: (id) => `/materials/${id}`,
    fields: [
      { name: "name", label: "Name" },
      { name: "material_family", label: "Material family" },
      { name: "alloy_grade", label: "Alloy / grade" },
      { name: "temper_condition", label: "Temper / condition" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "thickness_min_mm", label: "Thickness minimum", type: "number" },
      { name: "thickness_max_mm", label: "Thickness maximum", type: "number" },
      { name: "hardness", label: "Hardness" },
      { name: "shore_hardness", label: "Shore hardness" },
      { name: "elastic_modulus_notes", label: "Elastic modulus notes", type: "textarea" },
      { name: "forming_notes", label: "Forming notes", type: "textarea" },
      { name: "annealing_notes", label: "Annealing notes", type: "textarea" },
      { name: "surface_notes", label: "Surface notes", type: "textarea" },
      { name: "safety_notes", label: "Safety notes", type: "textarea" },
      { name: "research_notes", label: "Research notes", type: "textarea" },
    ],
  },
  product: {
    table: "products",
    titleField: "product_name",
    entityType: "product",
    publicHref: (id) => `/resources/products/${id}`,
    fields: [
      { name: "manufacturer", label: "Manufacturer" },
      { name: "product_name", label: "Product name" },
      { name: "manufacturer_product_code", label: "Manufacturer product code" },
      { name: "vendor_sku", label: "Vendor SKU" },
      { name: "product_url", label: "Product URL" },
      { name: "manufacturer_url", label: "Manufacturer URL" },
      { name: "package_description", label: "Package description", type: "textarea" },
      { name: "nominal_thickness_mm", label: "Nominal thickness", type: "number" },
      { name: "nominal_width_mm", label: "Nominal width", type: "number" },
      { name: "nominal_length_mm", label: "Nominal length", type: "number" },
      { name: "filament_diameter_mm", label: "Filament diameter", type: "number" },
      { name: "shore_hardness", label: "Shore hardness" },
      { name: "color", label: "Color" },
      { name: "price", label: "Price", type: "number" },
      { name: "currency", label: "Currency" },
      { name: "price_checked_at", label: "Price checked date", type: "date" },
      { name: "quantity_in_lab", label: "Quantity in lab", type: "number", section: "Internal lab data" },
      { name: "reorder_level", label: "Reorder level", type: "number", section: "Internal lab data" },
      { name: "inventory_notes", label: "Inventory notes", type: "textarea", section: "Internal lab data" },
      { name: "purchase_notes", label: "Purchase notes", type: "textarea", section: "Internal lab data" },
    ],
  },
  vendor: {
    table: "vendors",
    titleField: "name",
    publicHref: () => "/resources/products",
    fields: [
      { name: "name", label: "Name" },
      { name: "website_url", label: "Website" },
      { name: "contact_name", label: "Contact name" },
      { name: "contact_email", label: "Contact email" },
      { name: "contact_phone", label: "Contact phone" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
  equipment: {
    table: "equipment",
    titleField: "name",
    entityType: "equipment",
    publicHref: (id) => `/resources/equipment/${id}`,
    fields: [
      { name: "name", label: "Name" },
      { name: "equipment_type", label: "Equipment type" },
      { name: "manufacturer", label: "Manufacturer" },
      { name: "model", label: "Model" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "capacity", label: "Capacity" },
      { name: "working_envelope", label: "Working envelope" },
      { name: "power_requirements", label: "Power requirements" },
      { name: "location", label: "Location" },
      { name: "manual_url", label: "Manual URL" },
      { name: "manufacturer_url", label: "Manufacturer URL" },
      { name: "purchase_url", label: "Purchase URL" },
      { name: "operating_notes", label: "Operating notes", type: "textarea" },
      { name: "maintenance_notes", label: "Maintenance notes", type: "textarea" },
      { name: "safety_notes", label: "Safety notes", type: "textarea" },
    ],
  },
  atlas: {
    table: "atlas_entries",
    titleField: "title",
    entityType: "atlas_entry",
    publicHref: (id) => `/atlas/${id}`,
    fields: [
      { name: "title", label: "Title" },
      { name: "short_description", label: "Short description", type: "textarea" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "principle", label: "Principle", type: "textarea" },
      { name: "research_relevance", label: "Research relevance", type: "textarea" },
      { name: "sort_order", label: "Sort order", type: "number" },
    ],
  },
};

const numericFields = new Set(configs.material.fields.concat(configs.product.fields, configs.atlas.fields).filter((field) => field.type === "number").map((field) => field.name));
const dateFields = new Set(configs.research.fields.concat(configs.product.fields).filter((field) => field.type === "date").map((field) => field.name));

export function LibraryEditor({ kind, id, admin = false }: { kind: Kind; id?: string; admin?: boolean }) {
  const config = configs[kind];
  const [record, setRecord] = useState<RecordShape>({});
  const [media, setMedia] = useState<LibraryMedia[]>([]);
  const [message, setMessage] = useState(id ? "Loading..." : "");
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState(!id);
  const [isAdmin, setIsAdmin] = useState(false);
  const [materials, setMaterials] = useState<Option[]>([]);
  const [vendors, setVendors] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [sources, setSources] = useState<Option[]>([]);
  const [equipment, setEquipment] = useState<Option[]>([]);
  const [experiments, setExperiments] = useState<Option[]>([]);
  const [purchases, setPurchases] = useState<RowPurchase[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setMessage("Sign in to edit this record.");
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", auth.user.id).single();
      const adminUser = profile?.role === "admin";
      setIsAdmin(adminUser);

      if (!adminUser && !profile?.is_active) {
        setMessage("Inactive accounts cannot contribute.");
        return;
      }

      const [materialRows, vendorRows, categoryRows] = await Promise.all([
        supabase.from("materials").select("id, name").order("name", { ascending: true }),
        supabase.from("vendors").select("id, name").order("name", { ascending: true }),
        supabase.from("atlas_categories").select("id, title").order("sort_order", { ascending: true }),
      ]);
      setMaterials(((materialRows.data ?? []) as { id: string; name: string }[]).map((item) => ({ id: item.id, label: item.name })));
      setVendors(((vendorRows.data ?? []) as { id: string; name: string }[]).map((item) => ({ id: item.id, label: item.name })));
      setCategories(((categoryRows.data ?? []) as { id: string; title: string }[]).map((item) => ({ id: item.id, label: item.title })));
      const [sourceRows, equipmentRows, experimentRows] = await Promise.all([
        supabase.from("research_sources").select("id, title").order("title", { ascending: true }).limit(100),
        supabase.from("equipment").select("id, name").order("name", { ascending: true }).limit(100),
        supabase.from("experiments").select("id, code, title").order("created_at", { ascending: false }).limit(100),
      ]);
      setSources(((sourceRows.data ?? []) as { id: string; title: string }[]).map((item) => ({ id: item.id, label: item.title })));
      setEquipment(((equipmentRows.data ?? []) as { id: string; name: string }[]).map((item) => ({ id: item.id, label: item.name })));
      setExperiments(((experimentRows.data ?? []) as { id: string; code: string | null; title: string }[]).map((item) => ({ id: item.id, label: `${item.code || "Experiment"} / ${item.title}` })));

      if (!id) {
        setAllowed(true);
        setRecord({ status: "draft", is_published: false, currency: "USD", is_active: true });
        return;
      }

      const { data, error } = await supabase.from(config.table).select("*").eq("id", id).single();
      if (error || !data) {
        setMessage(error?.message ?? "Record not found.");
        return;
      }

      const loaded = data as RecordShape;
      const ownerId = kind === "research" ? loaded.added_by : loaded.created_by;
      const canEdit = adminUser || (ownerId === auth.user.id && isEditableStatus(String(loaded.status ?? "draft")));
      setRecord(loaded);
      setAllowed(canEdit);
      if (!canEdit) {
        setMessage("This record is part of the reviewed research archive. Contact an administrator to revise it.");
      } else {
        setMessage("");
      }

      if (config.entityType) {
        const { data: mediaRows } = await supabase.from("library_media").select("*").eq("entity_type", config.entityType).eq("entity_id", id).order("display_order", { ascending: true });
        const signed = await Promise.all(((mediaRows ?? []) as LibraryMedia[]).map(async (item) => {
          if (!item.storage_path) return { ...item, signedUrl: null };
          const { data: url } = await supabase.storage.from("library-media").createSignedUrl(item.storage_path, 3600);
          return { ...item, signedUrl: url?.signedUrl ?? null };
        }));
        setMedia(signed);
      }

      if (kind === "product" && adminUser) {
        const { data: purchaseRows } = await supabase.from("product_purchases").select("*").eq("product_id", id).order("purchase_date", { ascending: false });
        setPurchases((purchaseRows ?? []) as RowPurchase[]);
      }
    }
    load();
  }, [config.entityType, config.table, id, kind]);

  const fieldsBySection = useMemo(() => {
    return config.fields.reduce((groups, field) => {
      const key = field.section || "Public record data";
      groups.set(key, [...(groups.get(key) ?? []), field]);
      return groups;
    }, new Map<string, Field[]>());
  }, [config.fields]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("Saving...");
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      setMessage("Sign in to save.");
      setBusy(false);
      return;
    }

    const effectiveAdmin = admin || isAdmin;
    const status = effectiveAdmin ? String(form.get("status") || "draft") as EditorialStatus : submitter?.value === "submitted" ? "submitted" : "draft";
    const payload: RecordShape = {};
    config.fields.forEach((field) => {
      if (numericFields.has(field.name)) payload[field.name] = numberOrNull(form.get(field.name));
      else if (dateFields.has(field.name)) payload[field.name] = stringOrNull(form.get(field.name));
      else payload[field.name] = stringOrNull(form.get(field.name));
    });

    if (kind === "research") payload.added_by = id ? record.added_by ?? auth.user.id : auth.user.id;
    else payload.created_by = id ? record.created_by ?? auth.user.id : auth.user.id;
    if (kind !== "vendor") {
      payload.status = status;
      payload.is_published = syncPublished(status);
    } else {
      payload.is_active = form.get("is_active") === "on";
    }
    if (kind === "product") {
      payload.material_id = stringOrNull(form.get("material_id"));
      payload.vendor_id = stringOrNull(form.get("vendor_id"));
    }
    if (kind === "atlas") {
      payload.category_id = stringOrNull(form.get("category_id"));
    }

    const result = id
      ? await supabase.from(config.table).update(payload).eq("id", id).select("id").single()
      : await supabase.from(config.table).insert(payload).select("id").single();

    if (result.error || !result.data) {
      setMessage(result.error?.message ?? "Unable to save record.");
      setBusy(false);
      return;
    }

    const savedId = String(result.data.id);
    if (kind === "atlas") await saveAtlasLinks(savedId, form);
    await saveMedia(savedId, form);
    window.location.href = effectiveAdmin ? config.publicHref(savedId) : "/my-work";
  }

  async function saveAtlasLinks(atlasEntryId: string, form: FormData) {
    const supabase = createClient();
    const jobs = [
      stringOrNull(form.get("link_source_id")) && supabase.from("atlas_entry_sources").insert({ atlas_entry_id: atlasEntryId, source_id: stringOrNull(form.get("link_source_id")) }),
      stringOrNull(form.get("link_material_id")) && supabase.from("atlas_entry_materials").insert({ atlas_entry_id: atlasEntryId, material_id: stringOrNull(form.get("link_material_id")) }),
      stringOrNull(form.get("link_experiment_id")) && supabase.from("atlas_entry_experiments").insert({ atlas_entry_id: atlasEntryId, experiment_id: stringOrNull(form.get("link_experiment_id")) }),
      stringOrNull(form.get("link_equipment_id")) && supabase.from("atlas_entry_equipment").insert({ atlas_entry_id: atlasEntryId, equipment_id: stringOrNull(form.get("link_equipment_id")) }),
    ].filter(Boolean);
    for (const job of jobs) await job;
  }

  async function addPurchaseFrom(button: HTMLButtonElement) {
    if (!id) return;
    const scope = button.closest("fieldset");
    if (!scope) return;
    const form = new FormData();
    scope.querySelectorAll("input, textarea").forEach((element) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        form.set(element.name, element.value);
      }
    });
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("product_purchases").insert({
      product_id: id,
      purchase_date: stringOrNull(form.get("purchase_date")),
      quantity: numberOrNull(form.get("quantity")),
      unit_price: numberOrNull(form.get("unit_price")),
      total_price: numberOrNull(form.get("total_price")),
      currency: stringOrNull(form.get("purchase_currency")) || "USD",
      order_reference: stringOrNull(form.get("order_reference")),
      notes: stringOrNull(form.get("purchase_notes")),
      purchased_by: auth.user?.id ?? null,
    });
    if (error) setMessage(error.message);
    else window.location.reload();
  }

  async function saveMedia(entityId: string, form: FormData) {
    if (!config.entityType) return;
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const externalUrl = stringOrNull(form.get("external_url"));
    const caption = stringOrNull(form.get("media_caption"));
    const credit = stringOrNull(form.get("media_credit"));
    const sourceUrl = stringOrNull(form.get("media_source_url"));
    const mediaType = stringOrNull(form.get("media_type")) || "reference";

    if (externalUrl) {
      await supabase.from("library_media").insert({ entity_type: config.entityType, entity_id: entityId, external_url: externalUrl, caption, credit, source_url: sourceUrl, media_type: mediaType, display_order: media.length, created_by: auth.user.id });
    }

    const files = form.getAll("media").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const storagePath = `${config.entityType}/${entityId}/${Date.now()}-${index}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("library-media").upload(storagePath, file, { upsert: false });
      if (uploadError) throw uploadError;
      await supabase.from("library_media").insert({ entity_type: config.entityType, entity_id: entityId, storage_path: storagePath, caption: caption || file.name, credit, source_url: sourceUrl, media_type: mediaType, display_order: media.length + index, created_by: auth.user.id });
    }
  }

  async function removeMedia(item: LibraryMedia) {
    const supabase = createClient();
    if (item.storage_path) await supabase.storage.from("library-media").remove([item.storage_path]);
    const { error } = await supabase.from("library_media").delete().eq("id", item.id);
    if (error) setMessage(error.message);
    else setMedia((current) => current.filter((entry) => entry.id !== item.id));
  }

  if (id && !Object.keys(record).length) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;

  return (
    <section className="page-shell">
      <div className="page-heading split-heading">
        <div>
          <p className="eyebrow">{admin ? "Administration" : "Contribute"}</p>
          <h1>{id ? `Edit ${kind}` : `New ${kind}`}</h1>
          <p>{allowed ? "Save a draft or submit it for review." : "This record is read-only for your account."}</p>
        </div>
        {id && <Link className="button" href={config.publicHref(id)}>Open</Link>}
      </div>

      {message && <div className="notice">{message}</div>}
      <form className="experiment-form" onSubmit={save}>
        {kind === "product" && (
          <fieldset><legend><span>00</span> Product relations</legend><div className="form-grid"><label>Material<select name="material_id" defaultValue={String(record.material_id ?? "")}><option value="">Select material</option>{materials.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label>Vendor<select name="vendor_id" defaultValue={String(record.vendor_id ?? "")}><option value="">Select vendor</option>{vendors.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select><Link href="/contribute/vendors/new">+ Add Vendor</Link></label></div></fieldset>
        )}
        {kind === "atlas" && (
          <fieldset><legend><span>00</span> Atlas category</legend><label>Category<select name="category_id" defaultValue={String(record.category_id ?? "")} required><option value="">Select category</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label></fieldset>
        )}
        {Array.from(fieldsBySection.entries()).map(([section, fields], sectionIndex) => (
          <fieldset key={section}><legend><span>{String(sectionIndex + 1).padStart(2, "0")}</span> {section}</legend><div className="form-grid">{fields.map((field) => <FieldControl key={field.name} field={field} value={record[field.name]} disabled={!allowed} />)}</div></fieldset>
        ))}
        {kind === "atlas" && (
          <fieldset>
            <legend><span>Links</span> Related records</legend>
            <div className="form-grid form-grid-3">
              <OptionSelect name="link_source_id" label="Research Source" options={sources} disabled={!allowed} />
              <OptionSelect name="link_material_id" label="Material" options={materials} disabled={!allowed} />
              <OptionSelect name="link_experiment_id" label="Experiment" options={experiments} disabled={!allowed} />
              <OptionSelect name="link_equipment_id" label="Equipment" options={equipment} disabled={!allowed} />
            </div>
          </fieldset>
        )}
        {kind !== "vendor" && (
          <fieldset><legend><span>Media</span> Images</legend><MediaGrid items={media} />{allowed && media.map((item) => <button key={item.id} type="button" onClick={() => removeMedia(item)}>Remove {item.caption || "image"}</button>)}<div className="form-grid form-grid-3"><label>Upload image<input name="media" type="file" accept="image/*" multiple disabled={!allowed} /></label><label>External image URL<input name="external_url" disabled={!allowed} /></label><label>Media type<select name="media_type" disabled={!allowed}>{mediaTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label>Caption<input name="media_caption" disabled={!allowed} /></label><label>Credit<input name="media_credit" disabled={!allowed} /></label><label>Source URL<input name="media_source_url" disabled={!allowed} /></label></div></fieldset>
        )}
        {kind === "vendor" && <fieldset><legend><span>Status</span> Vendor status</legend><label><input name="is_active" type="checkbox" defaultChecked={record.is_active !== false} disabled={!allowed} /> Active</label></fieldset>}
        {(admin || isAdmin) && kind !== "vendor" && <fieldset><legend><span>Status</span> Editorial status</legend><label>Status<select name="status" defaultValue={String(record.status ?? "draft")} disabled={!allowed}>{editorialStatuses.map((status) => <option key={status}>{status}</option>)}</select></label></fieldset>}
        {kind === "product" && id && isAdmin && (
          <fieldset id="purchase-history">
            <legend><span>Purchase</span> Purchase history</legend>
            <div className="admin-table">{purchases.map((purchase) => <div className="library-admin-row" key={purchase.id}><span>{purchase.purchase_date || "No date"}</span><span>{purchase.quantity ?? "-"}</span><span>{purchase.unit_price ? `${purchase.currency || "USD"} ${purchase.unit_price}` : "-"}</span><span>{purchase.total_price ? `${purchase.currency || "USD"} ${purchase.total_price}` : "-"}</span><span>{purchase.order_reference || "-"}</span><span>{purchase.notes || "-"}</span></div>)}</div>
            <div className="section-heading-row"><p className="section-index">Record Purchase</p></div>
            <div className="form-panel">
              <div className="form-grid form-grid-3">
                <label>Purchase date<input name="purchase_date" type="date" /></label>
                <label>Quantity<input name="quantity" type="number" step="0.01" /></label>
                <label>Unit price<input name="unit_price" type="number" step="0.01" /></label>
                <label>Total price<input name="total_price" type="number" step="0.01" /></label>
                <label>Currency<input name="purchase_currency" defaultValue="USD" /></label>
                <label>Order reference<input name="order_reference" /></label>
                <label className="full">Notes<textarea name="purchase_notes" rows={2} /></label>
              </div>
              <button className="button" type="button" onClick={(event) => addPurchaseFrom(event.currentTarget)}>+ Record Purchase</button>
            </div>
          </fieldset>
        )}
        <div className="submit-bar">
          {!(admin || isAdmin) && <button className="button" type="submit" value="draft" disabled={busy || !allowed}>Save Draft</button>}
          {!(admin || isAdmin) && <button className="button primary" type="submit" value="submitted" disabled={busy || !allowed}>Submit for Review</button>}
          {(admin || isAdmin) && <button className="button primary" type="submit" disabled={busy || !allowed}>Save Changes</button>}
          {record.status && <StatusPill status={String(record.status)} />}
        </div>
      </form>
    </section>
  );
}

function OptionSelect({ name, label, options, disabled }: { name: string; label: string; options: Option[]; disabled: boolean }) {
  return <label>{label}<select name={name} disabled={disabled}><option value="">Select</option>{options.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>;
}

type RowPurchase = {
  id: string;
  purchase_date: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  currency: string | null;
  order_reference: string | null;
  notes: string | null;
};

function FieldControl({ field, value, disabled }: { field: Field; value: string | number | boolean | null | undefined; disabled: boolean }) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  if (field.type === "textarea") return <label className="full">{field.label}<textarea name={field.name} rows={4} defaultValue={stringValue} disabled={disabled} /></label>;
  if (field.type === "select") return <label>{field.label}<select name={field.name} defaultValue={stringValue} disabled={disabled}><option value="">Select</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select></label>;
  return <label>{field.label}<input name={field.name} type={field.type || "text"} step={field.type === "number" ? "0.01" : undefined} defaultValue={stringValue} disabled={disabled} /></label>;
}
