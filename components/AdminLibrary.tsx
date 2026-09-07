"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { EditorialStatus, editorialStatuses, slugify, syncPublished } from "../lib/library";
import { StatusPill } from "./StatusPill";

type AdminKind = "research" | "materials" | "products" | "vendors" | "equipment";
type Row = Record<string, string | number | boolean | null | { name?: string | null; title?: string | null } | undefined>;

const adminConfigs = {
  research: { table: "research_sources", title: "Research", titleField: "title", newHref: "/contribute/research/new", editBase: "/contribute/research", openBase: "/research", select: "id, title, source_type, publication_year, status, visibility, is_published, updated_at, added_by" },
  materials: { table: "materials", title: "Materials", titleField: "name", newHref: "/contribute/materials/new", editBase: "/contribute/materials", openBase: "/materials", select: "id, name, material_family, alloy_grade, status, visibility, is_published, updated_at, created_by" },
  products: { table: "products", title: "Products", titleField: "product_name", newHref: "/contribute/products/new", editBase: "/contribute/products", openBase: "/resources/products", select: "id, product_name, manufacturer, price, quantity_in_lab, reorder_level, status, visibility, is_published, updated_at, materials(name), vendors(name)" },
  vendors: { table: "vendors", title: "Vendors", titleField: "name", newHref: "/contribute/vendors/new", editBase: "/contribute/vendors", openBase: "/resources/products", select: "id, name, website_url, contact_name, contact_email, is_active, updated_at" },
  equipment: { table: "equipment", title: "Equipment", titleField: "name", newHref: "/contribute/equipment/new", editBase: "/contribute/equipment", openBase: "/resources/equipment", select: "id, name, manufacturer, model, equipment_type, status, visibility, is_published, updated_at" },
} satisfies Record<AdminKind, { table: string; title: string; titleField: string; newHref: string; editBase: string; openBase: string; select: string }>;

export function AdminLibraryList({ kind }: { kind: AdminKind }) {
  const config = adminConfigs[kind];
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("Loading...");
  const [filter, setFilter] = useState("");

  async function load() {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage("Administrator access required.");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
    if (profile?.role !== "admin") {
      setMessage("Administrator access required.");
      return;
    }
    setIsAdmin(true);
    const { data, error } = await supabase.from(config.table).select(config.select).order("updated_at", { ascending: false });
    if (error) setMessage(error.message); else { setRows((data ?? []) as unknown as Row[]); setMessage(""); }
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: EditorialStatus) {
    const supabase = createClient();
    const { error } = await supabase.from(config.table).update({ status, is_published: syncPublished(status) }).eq("id", id);
    if (error) setMessage(error.message); else await load();
  }

  async function setVisibility(id: string, visibility: "internal" | "public") {
    if (visibility === "public" && !window.confirm("Make this record visible on the public internet?")) return;
    const supabase = createClient();
    const { error } = await supabase.from(config.table).update({ visibility }).eq("id", id);
    if (error) setMessage(error.message); else await load();
  }

  async function toggleVendor(id: string, active: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from("vendors").update({ is_active: active }).eq("id", id);
    if (error) setMessage(error.message); else await load();
  }

  const filtered = rows.filter((row) => !filter || String(row.status ?? row.is_active ?? "").toLowerCase() === filter);

  if (!isAdmin) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;

  return (
    <section className="page-shell">
      <div className="page-heading split-heading">
        <div><p className="eyebrow">Administration</p><h1>{config.title}</h1><p>Review, edit, publish, archive, and maintain canonical library records.</p></div>
        <Link className="button primary" href={config.newHref}>+ New {config.title}</Link>
      </div>
      <div className="filter-bar">{kind !== "vendors" && <select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All statuses</option>{editorialStatuses.map((status) => <option key={status}>{status}</option>)}</select>}</div>
      {message && <div className="notice">{message}</div>}
      <div className="admin-table">
        {filtered.map((row) => {
          const id = String(row.id);
          const reorder = kind === "products" && typeof row.quantity_in_lab === "number" && typeof row.reorder_level === "number" && row.quantity_in_lab <= row.reorder_level;
          return (
            <div className="library-admin-row" key={id}>
              <span><strong>{String(row[config.titleField] ?? "Untitled")}</strong>{reorder && <small>REORDER</small>}</span>
              <span>{String(row.source_type ?? row.material_family ?? row.manufacturer ?? row.equipment_type ?? row.website_url ?? "-")}</span>
              <span>{row.status ? <StatusPill status={String(row.status)} /> : String(row.is_active === false ? "Inactive" : "Active")}</span>
              <span>{row.visibility ? <span className="status-pill">{String(row.visibility).toUpperCase()}</span> : ""}</span>
              <span>{row.updated_at ? new Date(String(row.updated_at)).toLocaleDateString() : "-"}</span>
              <span className="inline-actions">
                <Link href={kind === "vendors" ? config.openBase : `${config.openBase}/${id}`}>Open</Link>
                <Link href={`${config.editBase}/${id}/edit`}>Edit</Link>
                {kind === "products" && <Link href={`${config.editBase}/${id}/edit#purchase-history`}>Purchase History</Link>}
                {kind === "vendors" ? <button type="button" onClick={() => toggleVendor(id, row.is_active === false)}> {row.is_active === false ? "Reactivate" : "Deactivate"}</button> : <select value={String(row.status ?? "draft")} onChange={(event) => setStatus(id, event.target.value as EditorialStatus)}>{editorialStatuses.map((status) => <option key={status}>{status}</option>)}</select>}
                {kind !== "vendors" && <select value={String(row.visibility ?? "internal")} onChange={(event) => setVisibility(id, event.target.value as "internal" | "public")}><option value="internal">Internal</option><option value="public">Public</option></select>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function LibraryReviewPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<{ id: string; title: string; group: string; table: string; open: string; edit: string; updated_at?: string | null; status: string }[]>([]);
  const [message, setMessage] = useState("Loading...");

  async function load() {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setMessage("Administrator access required."); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
    if (profile?.role !== "admin") { setMessage("Administrator access required."); return; }
    setIsAdmin(true);
    const [research, materials, products, equipment, atlas] = await Promise.all([
      supabase.from("research_sources").select("id, title, updated_at, status").eq("status", "submitted"),
      supabase.from("materials").select("id, name, updated_at, status").eq("status", "submitted"),
      supabase.from("products").select("id, product_name, updated_at, status").eq("status", "submitted"),
      supabase.from("equipment").select("id, name, updated_at, status").eq("status", "submitted"),
      supabase.from("atlas_entries").select("id, title, updated_at, status").eq("status", "submitted"),
    ]);
    setItems([
      ...((research.data ?? []) as unknown as { id: string; title: string; updated_at: string; status: string }[]).map((item) => ({ id: item.id, title: item.title, group: "RESEARCH", table: "research_sources", open: `/research/${item.id}`, edit: `/contribute/research/${item.id}/edit`, updated_at: item.updated_at, status: item.status })),
      ...((materials.data ?? []) as unknown as { id: string; name: string; updated_at: string; status: string }[]).map((item) => ({ id: item.id, title: item.name, group: "MATERIAL", table: "materials", open: `/materials/${item.id}`, edit: `/contribute/materials/${item.id}/edit`, updated_at: item.updated_at, status: item.status })),
      ...((products.data ?? []) as unknown as { id: string; product_name: string; updated_at: string; status: string }[]).map((item) => ({ id: item.id, title: item.product_name, group: "PRODUCT", table: "products", open: `/resources/products/${item.id}`, edit: `/contribute/products/${item.id}/edit`, updated_at: item.updated_at, status: item.status })),
      ...((equipment.data ?? []) as unknown as { id: string; name: string; updated_at: string; status: string }[]).map((item) => ({ id: item.id, title: item.name, group: "EQUIPMENT", table: "equipment", open: `/resources/equipment/${item.id}`, edit: `/contribute/equipment/${item.id}/edit`, updated_at: item.updated_at, status: item.status })),
      ...((atlas.data ?? []) as unknown as { id: string; title: string; updated_at: string; status: string }[]).map((item) => ({ id: item.id, title: item.title, group: "ATLAS", table: "atlas_entries", open: `/atlas/${item.id}`, edit: `/contribute/atlas/${item.id}/edit`, updated_at: item.updated_at, status: item.status })),
    ]);
    setMessage("");
  }

  useEffect(() => { load(); }, []);

  async function setStatus(item: { id: string; table: string }, status: EditorialStatus) {
    const supabase = createClient();
    const { error } = await supabase.from(item.table).update({ status, is_published: syncPublished(status) }).eq("id", item.id);
    if (error) setMessage(error.message); else await load();
  }

  if (!isAdmin) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  return <section className="page-shell"><div className="page-heading"><p className="eyebrow">Administration</p><h1>Library Review</h1><p>Submitted research library records awaiting canonical review. Experiment review remains separate.</p></div>{message && <div className="notice">{message}</div>}<div className="admin-table">{items.map((item) => <div className="library-admin-row" key={`${item.group}-${item.id}`}><span><strong>{item.title}</strong><small>{item.group}</small></span><span>{item.updated_at ? new Date(item.updated_at).toLocaleDateString() : "-"}</span><span><StatusPill status={item.status} /></span><span className="inline-actions"><Link href={item.open}>Open</Link><Link href={item.edit}>Edit</Link><button type="button" onClick={() => setStatus(item, "draft")}>Return to Draft</button><button type="button" onClick={() => setStatus(item, "reviewed")}>Mark Reviewed</button><button type="button" onClick={() => setStatus(item, "published")}>Publish</button></span></div>)}</div></section>;
}

export function TaxonomyAdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [terms, setTerms] = useState<Row[]>([]);
  const [message, setMessage] = useState("Loading...");

  async function load() {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setMessage("Administrator access required."); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
    if (profile?.role !== "admin") { setMessage("Administrator access required."); return; }
    setIsAdmin(true);
    const { data, error } = await supabase.from("taxonomy_terms").select("*").order("taxonomy_type").order("sort_order");
    if (error) setMessage(error.message); else { setTerms((data ?? []) as unknown as Row[]); setMessage(""); }
  }

  useEffect(() => { load(); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "");
    const taxonomyType = String(form.get("taxonomy_type") || "");
    const supabase = createClient();
    const { error } = await supabase.from("taxonomy_terms").insert({ taxonomy_type: taxonomyType, name, slug: slugify(name), description: String(form.get("description") || ""), sort_order: Number(form.get("sort_order") || 0), is_active: true });
    if (error) setMessage(error.message); else { event.currentTarget.reset(); await load(); }
  }

  async function update(id: string, changes: Row) {
    const supabase = createClient();
    const { error } = await supabase.from("taxonomy_terms").update(changes).eq("id", id);
    if (error) setMessage(error.message); else await load();
  }

  if (!isAdmin) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  const groups = Array.from(new Set(terms.map((term) => String(term.taxonomy_type))));
  return <section className="page-shell"><div className="page-heading"><p className="eyebrow">Administration</p><h1>Taxonomy</h1><p>Terms are data, not enums, so the research language can evolve without code deployments.</p></div><form className="form-panel" onSubmit={save}><div className="form-grid form-grid-3"><label>Type<input name="taxonomy_type" required /></label><label>Name<input name="name" required /></label><label>Sort order<input name="sort_order" type="number" defaultValue="0" /></label><label className="full">Description<textarea name="description" rows={2} /></label></div><button className="button primary" type="submit">Add Term</button></form>{message && <div className="notice">{message}</div>}{groups.map((group) => <section className="detail-section" key={group}><p className="section-index">{group}</p><div className="admin-table">{terms.filter((term) => term.taxonomy_type === group).map((term) => <div className="library-admin-row" key={String(term.id)}><input defaultValue={String(term.name ?? "")} onBlur={(event) => update(String(term.id), { name: event.target.value, slug: slugify(event.target.value) })} /><input type="number" defaultValue={String(term.sort_order ?? 0)} onBlur={(event) => update(String(term.id), { sort_order: Number(event.target.value) })} /><span>{term.is_active === false ? "Inactive" : "Active"}</span><button type="button" onClick={() => update(String(term.id), { is_active: term.is_active === false })}>{term.is_active === false ? "Reactivate" : "Deactivate"}</button></div>)}</div></section>)}</section>;
}

export function AtlasAdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [categories, setCategories] = useState<Row[]>([]);
  const [entries, setEntries] = useState<Row[]>([]);
  const [message, setMessage] = useState("Loading...");

  async function load() {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setMessage("Administrator access required."); return; }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
    if (profile?.role !== "admin") { setMessage("Administrator access required."); return; }
    setIsAdmin(true);
    const [categoryRows, entryRows] = await Promise.all([
      supabase.from("atlas_categories").select("*").order("sort_order", { ascending: true }),
      supabase.from("atlas_entries").select("*, atlas_categories(title)").order("sort_order", { ascending: true }),
    ]);
    if (categoryRows.error || entryRows.error) setMessage(categoryRows.error?.message || entryRows.error?.message || "Unable to load Atlas.");
    else { setCategories((categoryRows.data ?? []) as unknown as Row[]); setEntries((entryRows.data ?? []) as unknown as Row[]); setMessage(""); }
  }

  useEffect(() => { load(); }, []);

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "");
    const supabase = createClient();
    const visibility = String(form.get("visibility") || "internal");
    if (visibility === "public" && !window.confirm("Make this record visible on the public internet?")) return;
    const { error } = await supabase.from("atlas_categories").insert({ code: String(form.get("code") || ""), title, slug: String(form.get("slug") || slugify(title)), description: String(form.get("description") || ""), sort_order: Number(form.get("sort_order") || 0), is_published: form.get("is_published") === "on", visibility });
    if (error) setMessage(error.message); else { event.currentTarget.reset(); await load(); }
  }

  async function updateCategory(id: string, changes: Row) {
    const supabase = createClient();
    const { error } = await supabase.from("atlas_categories").update(changes).eq("id", id);
    if (error) setMessage(error.message); else await load();
  }

  async function updateEntry(id: string, status: EditorialStatus) {
    const supabase = createClient();
    const { error } = await supabase.from("atlas_entries").update({ status, is_published: syncPublished(status) }).eq("id", id);
    if (error) setMessage(error.message); else await load();
  }

  async function updateVisibility(table: "atlas_categories" | "atlas_entries", id: string, visibility: "internal" | "public") {
    if (visibility === "public" && !window.confirm("Make this record visible on the public internet?")) return;
    const supabase = createClient();
    const { error } = await supabase.from(table).update({ visibility }).eq("id", id);
    if (error) setMessage(error.message); else await load();
  }

  if (!isAdmin) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  return <section className="page-shell"><div className="page-heading split-heading"><div><p className="eyebrow">Administration</p><h1>Atlas</h1><p>Manage categories, entry publication, and public ordering for the editable Atlas.</p></div><Link className="button primary" href="/contribute/atlas/new">+ Add Entry</Link></div><form className="form-panel" onSubmit={addCategory}><div className="form-grid form-grid-3"><label>Code<input name="code" /></label><label>Title<input name="title" required /></label><label>Slug<input name="slug" /></label><label>Sort order<input name="sort_order" type="number" defaultValue="0" /></label><label><input name="is_published" type="checkbox" defaultChecked /> Published</label><label>Visibility<select name="visibility" defaultValue="internal"><option value="internal">Internal</option><option value="public">Public</option></select></label><label className="full">Description<textarea name="description" rows={2} /></label></div><button className="button" type="submit">+ Add Category</button></form>{message && <div className="notice">{message}</div>}<section className="detail-section"><p className="section-index">Categories</p><div className="admin-table">{categories.map((category) => <div className="library-admin-row" key={String(category.id)}><input defaultValue={String(category.code ?? "")} onBlur={(event) => updateCategory(String(category.id), { code: event.target.value })} /><input defaultValue={String(category.title ?? "")} onBlur={(event) => updateCategory(String(category.id), { title: event.target.value, slug: slugify(event.target.value) })} /><input type="number" defaultValue={String(category.sort_order ?? 0)} onBlur={(event) => updateCategory(String(category.id), { sort_order: Number(event.target.value) })} /><span className="status-pill">{String(category.visibility ?? "internal").toUpperCase()}</span><select value={String(category.visibility ?? "internal")} onChange={(event) => updateVisibility("atlas_categories", String(category.id), event.target.value as "internal" | "public")}><option value="internal">Internal</option><option value="public">Public</option></select><button type="button" onClick={() => updateCategory(String(category.id), { is_published: category.is_published === false })}>{category.is_published === false ? "Publish Category" : "Hide Category"}</button></div>)}</div></section><section className="detail-section"><p className="section-index">Entries</p><div className="admin-table">{entries.map((entry) => <div className="library-admin-row" key={String(entry.id)}><span><strong>{String(entry.title ?? "Untitled")}</strong><small>{typeof entry.atlas_categories === "object" && entry.atlas_categories ? String(entry.atlas_categories.title ?? "") : ""}</small></span><span><StatusPill status={String(entry.status ?? "draft")} /></span><span className="status-pill">{String(entry.visibility ?? "internal").toUpperCase()}</span><span className="inline-actions"><Link href={`/atlas/${entry.id}`}>Open</Link><Link href={`/contribute/atlas/${entry.id}/edit`}>Edit</Link><select value={String(entry.status ?? "draft")} onChange={(event) => updateEntry(String(entry.id), event.target.value as EditorialStatus)}>{editorialStatuses.map((status) => <option key={status}>{status}</option>)}</select><select value={String(entry.visibility ?? "internal")} onChange={(event) => updateVisibility("atlas_entries", String(entry.id), event.target.value as "internal" | "public")}><option value="internal">Internal</option><option value="public">Public</option></select></span></div>)}</div></section></section>;
}
