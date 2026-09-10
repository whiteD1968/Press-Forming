"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { isEditableStatus, LibraryMedia } from "../lib/library";
import { MediaGrid } from "./MediaGrid";
import { StatusPill } from "./StatusPill";
import { CopyCitationButton } from "./CopyCitationButton";
import type { ResearchAccessState } from "../lib/access";

type Source = {
  id: string;
  title: string;
  author: string | null;
  publication_year: number | null;
  publisher: string | null;
  source_type: string | null;
  url: string | null;
  doi: string | null;
  citation: string | null;
  file_url: string | null;
  abstract: string | null;
  summary: string | null;
  short_note?: string | null;
  why_it_matters?: string | null;
  historical_context: string | null;
  principle: string | null;
  research_translation: string | null;
  forming_method: string | null;
  material_relevance: string | null;
  tool_relevance: string | null;
  undercut_relevance: string | null;
  notes: string | null;
  status: string | null;
  is_published: boolean | null;
  added_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type AtlasCategory = {
  id: string;
  code: string | null;
  title: string;
  slug: string | null;
  description: string | null;
  sort_order: number | null;
  is_published: boolean | null;
};

type AtlasEntry = {
  id: string;
  category_id: string | null;
  title: string;
  slug: string | null;
  short_description: string | null;
  description: string | null;
  principle: string | null;
  research_relevance: string | null;
  sort_order: number | null;
  status: string | null;
  is_published: boolean | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  atlas_categories?: AtlasCategory | null;
};

type Material = {
  id: string;
  name: string;
  material_family: string | null;
  alloy_grade: string | null;
  temper_condition: string | null;
  description: string | null;
  thickness_min_mm: number | null;
  thickness_max_mm: number | null;
  hardness: string | null;
  shore_hardness: string | null;
  elastic_modulus_notes: string | null;
  forming_notes: string | null;
  annealing_notes: string | null;
  surface_notes: string | null;
  safety_notes: string | null;
  research_notes: string | null;
  status: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Product = {
  id: string;
  material_id: string | null;
  vendor_id: string | null;
  manufacturer: string | null;
  product_name: string;
  manufacturer_product_code: string | null;
  vendor_sku: string | null;
  product_url: string | null;
  manufacturer_url: string | null;
  package_description: string | null;
  nominal_thickness_mm: number | null;
  nominal_width_mm: number | null;
  nominal_length_mm: number | null;
  filament_diameter_mm: number | null;
  shore_hardness: string | null;
  color: string | null;
  price: number | null;
  currency: string | null;
  price_checked_at: string | null;
  quantity_in_lab: number | null;
  reorder_level: number | null;
  status: string | null;
  created_by?: string | null;
  materials?: Pick<Material, "id" | "name"> | null;
  vendors?: { id: string; name: string; website_url: string | null } | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Equipment = {
  id: string;
  name: string;
  equipment_type: string | null;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  capacity: string | null;
  working_envelope: string | null;
  power_requirements: string | null;
  manual_url: string | null;
  manufacturer_url: string | null;
  purchase_url: string | null;
  operating_notes: string | null;
  safety_notes: string | null;
  status: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ExperimentLink = {
  experiment_id: string;
  experiments?: {
    id: string;
    code: string | null;
    title: string;
    status: string;
  } | null;
};

const sourceTypes = ["Website", "Video", "Journal Article", "Conference Paper", "Patent", "Book", "Book Chapter", "Thesis", "Technical Manual", "Historical Object", "Historical Image", "Contemporary Image", "Process Image", "Supplier / Manufacturer Page", "Other"];
const quickSourceTypes = ["Website", "Video", "Journal Article", "Conference Paper", "Patent", "Book", "Book Chapter", "Technical Manual", "Historical Image", "Contemporary Image", "Process Image", "Supplier / Manufacturer Page", "Other"];

async function loadMedia(entityType: string, entityIds: string[]) {
  if (!entityIds.length) return new Map<string, LibraryMedia[]>();
  const supabase = createClient();
  const { data } = await supabase
    .from("library_media")
    .select("*")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds)
    .order("display_order", { ascending: true });

  const media = await Promise.all(((data ?? []) as LibraryMedia[]).map(async (item) => {
    if (!item.storage_path) return { ...item, signedUrl: null };
    const { data: signed } = await supabase.storage.from("library-media").createSignedUrl(item.storage_path, 3600);
    return { ...item, signedUrl: signed?.signedUrl ?? null };
  }));

  return media.sort((a, b) => Number(b.is_primary === true) - Number(a.is_primary === true) || Number(a.display_order ?? 0) - Number(b.display_order ?? 0)).reduce((map, item) => {
    const current = map.get(item.entity_id) ?? [];
    current.push(item);
    map.set(item.entity_id, current);
    return map;
  }, new Map<string, LibraryMedia[]>());
}

function firstMedia(media: Map<string, LibraryMedia[]>, id: string) {
  const item = (media.get(id) ?? []).sort((a, b) => Number(b.is_primary === true) - Number(a.is_primary === true) || Number(a.display_order ?? 0) - Number(b.display_order ?? 0))[0];
  return item?.signedUrl || item?.external_url || "";
}

function SafeLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return null;
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}

function DetailPair({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function researchSourceActionLabel(sourceType?: string | null) {
  const type = String(sourceType || "").toLowerCase();
  if (type.includes("video")) return "WATCH VIDEO";
  if (type.includes("journal") || type.includes("conference") || type.includes("thesis") || type.includes("book")) return "OPEN PAPER";
  if (type.includes("supplier") || type.includes("manufacturer")) return "OPEN MANUFACTURER PAGE";
  if (type.includes("historical") || type.includes("archive")) return "OPEN ARCHIVE SOURCE";
  return "OPEN SOURCE";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  if (!children) return null;
  return <section className="detail-section"><p className="section-index">{title}</p>{children}</section>;
}

function isApprovedAccess(state?: ResearchAccessState) {
  return state === "researcher" || state === "admin";
}

function canEditRecord(record: { status?: string | null; added_by?: string | null; created_by?: string | null }, userId: string, role: string) {
  return role === "admin" || (!!userId && (record.added_by === userId || record.created_by === userId) && isEditableStatus(record.status || "draft"));
}

function PublicEmptyState() {
  return (
    <div className="empty-state">
      <strong>Selected research from Forming Material will appear here when released publicly.</strong>
      <p>Sign in or request access to view the working research archive.</p>
      <div className="hero-actions"><Link className="button primary" href="/login">Sign In</Link><Link className="button" href="/login">Request Research Access</Link></div>
    </div>
  );
}

function ResearchQuickAdd({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState("");
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessage("Sign in to save research.");
      setBusy(false);
      return;
    }
    const yearValue = String(form.get("publication_year") || "").trim();
    const { data, error } = await supabase
      .from("research_sources")
      .insert({
        title: String(form.get("title") || "").trim(),
        source_type: String(form.get("source_type") || "Website"),
        url: String(form.get("url") || "").trim(),
        author: String(form.get("author") || "").trim() || null,
        publication_year: yearValue ? Number(yearValue) : null,
        why_it_matters: String(form.get("why_it_matters") || "").trim(),
        status: "draft",
        visibility: "internal",
        is_published: false,
        added_by: auth.user.id,
      })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      setMessage(error?.message ?? "Unable to save source.");
      return;
    }
    setSavedId(String(data.id));
    setMessage("SOURCE SAVED");
    event.currentTarget.reset();
    onSaved?.();
  }

  return (
    <div className="quick-add">
      <button className="button" type="button" onClick={() => setOpen((current) => !current)}>QUICK ADD LINK</button>
      {open && (
        <form className="form-panel" onSubmit={save}>
          <div className="form-grid form-grid-3">
            <label>URL<input name="url" type="url" required /></label>
            <label>Title<input name="title" required /></label>
            <label>Source Type<select name="source_type" defaultValue="Website">{quickSourceTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Author / Creator<input name="author" /></label>
            <label>Year<input name="publication_year" type="number" min="0" max="3000" /></label>
            <label className="full">Why It Matters<textarea name="why_it_matters" rows={3} required /></label>
          </div>
          <div className="submit-bar">
            <button className="button primary" type="submit" disabled={busy}>Save Draft</button>
            {message && <span className="form-message">{message}</span>}
          </div>
          {savedId && (
            <div className="hero-actions">
              <Link className="button" href={`/research/${savedId}`}>View Source</Link>
              <Link className="button primary" href={`/contribute/research/${savedId}/edit`}>Add More Detail</Link>
              <button className="button" type="button" onClick={() => { setSavedId(""); setMessage(""); }}>Add Another Source</button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export function ResearchLibraryPage({ accessState }: { accessState?: ResearchAccessState }) {
  const [items, setItems] = useState<Source[]>([]);
  const [media, setMedia] = useState(new Map<string, LibraryMedia[]>());
  const [tagsBySource, setTagsBySource] = useState(new Map<string, string[]>());
  const [message, setMessage] = useState("Loading...");
  const [query, setQuery] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [year, setYear] = useState("");
  const [formingMethod, setFormingMethod] = useState("");
  const [materialRelevance, setMaterialRelevance] = useState("");
  const [undercutRelevance, setUndercutRelevance] = useState("");
  const [tag, setTag] = useState("");
  const [viewMode, setViewMode] = useState<"visual" | "index">("visual");

  useEffect(() => {
    const preferred = window.localStorage.getItem("research-view-mode");
    if (preferred === "visual" || preferred === "index") setViewMode(preferred);
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("research_sources")
        .select("id, title, author, publication_year, source_type, summary, short_note, why_it_matters, principle, research_translation, forming_method, material_relevance, undercut_relevance, notes, status, is_published")
        .order("publication_year", { ascending: false })
        .limit(80);
      if (error) {
        setMessage(error.message);
        return;
      }
      const sources = (data ?? []) as Source[];
      setItems(sources);
      setMedia(await loadMedia("research_source", sources.map((item) => item.id)));
      const { data: tagRows } = await supabase
        .from("research_source_tags")
        .select("source_id, taxonomy_terms(name)")
        .in("source_id", sources.map((item) => item.id));
      const tagMap = new Map<string, string[]>();
      ((tagRows ?? []) as any[]).forEach((row) => {
        const term = Array.isArray(row.taxonomy_terms) ? row.taxonomy_terms[0] : row.taxonomy_terms;
        if (!term?.name) return;
        tagMap.set(row.source_id, [...(tagMap.get(row.source_id) ?? []), term.name]);
      });
      setTagsBySource(tagMap);
      setMessage("");
    }
    load();
  }, []);

  const years = Array.from(new Set(items.map((item) => item.publication_year).filter(Boolean))).sort((a, b) => Number(b) - Number(a));
  const methods = Array.from(new Set(items.map((item) => item.forming_method).filter(Boolean) as string[])).sort();
  const materials = Array.from(new Set(items.map((item) => item.material_relevance).filter(Boolean) as string[])).sort();
  const undercuts = Array.from(new Set(items.map((item) => item.undercut_relevance).filter(Boolean) as string[])).sort();
  const tags = Array.from(new Set(Array.from(tagsBySource.values()).flat())).sort();
  const filtered = useMemo(() => items.filter((item) => {
    const text = [item.title, item.author, item.summary, item.short_note, item.why_it_matters, item.principle, item.research_translation, item.notes].join(" ").toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (!sourceType || item.source_type === sourceType)
      && (!year || String(item.publication_year ?? "") === year)
      && (!formingMethod || item.forming_method === formingMethod)
      && (!materialRelevance || item.material_relevance === materialRelevance)
      && (!undercutRelevance || item.undercut_relevance === undercutRelevance)
      && (!tag || (tagsBySource.get(item.id) ?? []).includes(tag));
  }), [items, query, sourceType, year, formingMethod, materialRelevance, undercutRelevance, tag, tagsBySource]);

  return (
    <section className="page-shell">
      <div className="page-heading split-heading">
        <div>
          <p className="eyebrow">Research Library</p>
          <h1>Research</h1>
          <p>Precedents, principles, supplier knowledge, technical manuals, and process references for press-forming research.</p>
        </div>
        {isApprovedAccess(accessState) && <div className="detail-actions"><Link className="button primary" href="/contribute/research/new">+ ADD RESEARCH SOURCE</Link><ResearchQuickAdd /></div>}
      </div>
      <div className="filter-bar">
        <input placeholder="Search title, author, summary, principle" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="">All types</option>{sourceTypes.map((type) => <option key={type}>{type}</option>)}</select>
        <select value={year} onChange={(event) => setYear(event.target.value)}><option value="">All years</option>{years.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={formingMethod} onChange={(event) => setFormingMethod(event.target.value)}><option value="">All methods</option>{methods.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={materialRelevance} onChange={(event) => setMaterialRelevance(event.target.value)}><option value="">All material relevance</option>{materials.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={undercutRelevance} onChange={(event) => setUndercutRelevance(event.target.value)}><option value="">All undercut relevance</option>{undercuts.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">All tags</option>{tags.map((item) => <option key={item}>{item}</option>)}</select>
        <button className={viewMode === "visual" ? "button primary" : "button secondary"} type="button" onClick={() => { setViewMode("visual"); window.localStorage.setItem("research-view-mode", "visual"); }}>Visual</button>
        <button className={viewMode === "index" ? "button primary" : "button secondary"} type="button" onClick={() => { setViewMode("index"); window.localStorage.setItem("research-view-mode", "index"); }}>Index</button>
      </div>
      {message && <div className="notice">{message}</div>}
      {!message && filtered.length === 0 && (isApprovedAccess(accessState) ? <div className="empty-state"><strong>NO RESEARCH SOURCES YET</strong><p>Capture papers, videos, websites, historical references, and technical precedents.</p><div className="hero-actions"><ResearchQuickAdd /><Link className="button primary" href="/contribute/research/new">+ ADD FULL RESEARCH SOURCE</Link></div></div> : <PublicEmptyState />)}
      <div className={viewMode === "visual" ? "research-index" : "admin-table"}>
        {filtered.map((item) => (
          <Link href={`/research/${item.id}`} className={viewMode === "visual" ? "research-card" : "library-admin-row"} key={item.id}>
            {firstMedia(media, item.id) ? <img loading="lazy" src={firstMedia(media, item.id)} alt={item.title} /> : <div className="media-placeholder">No image</div>}
            <div>
              <span>{item.source_type || "Source"}{item.publication_year ? ` / ${item.publication_year}` : ""}</span>
              <h2>{item.title}</h2>
              <small>{item.author || "Unknown author"}</small>
              <p>{item.summary || item.principle || "No summary recorded."}</p>
              {item.forming_method && <b>{item.forming_method}</b>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ResearchDetailPage({ id }: { id: string }) {
  const [item, setItem] = useState<Source | null>(null);
  const [media, setMedia] = useState<LibraryMedia[]>([]);
  const [atlas, setAtlas] = useState<AtlasEntry[]>([]);
  const [experiments, setExperiments] = useState<ExperimentLink[]>([]);
  const [approved, setApproved] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        setUserId(auth.user.id);
        const { data: profile } = await supabase.from("profiles").select("role, approval_status, is_active").eq("id", auth.user.id).single();
        setRole(profile?.role ?? "");
        setApproved(profile?.approval_status === "approved" && profile.is_active !== false);
      }
      const { data, error } = await supabase.from("research_sources").select("*").eq("id", id).single();
      if (error || !data) {
        setMessage("RESEARCH ACCESS REQUIRED");
        return;
      }
      setItem(data as Source);
      const mediaMap = await loadMedia("research_source", [id]);
      setMedia(mediaMap.get(id) ?? []);
      const { data: atlasRows } = await supabase.from("atlas_entry_sources").select("atlas_entries(id, title, short_description, status, is_published)").eq("source_id", id);
      setAtlas(((atlasRows ?? []) as unknown as { atlas_entries: AtlasEntry | AtlasEntry[] | null }[]).map((row) => Array.isArray(row.atlas_entries) ? row.atlas_entries[0] : row.atlas_entries).filter(Boolean) as AtlasEntry[]);
      const { data: experimentRows } = await supabase.from("experiment_sources").select("experiment_id, experiments(id, code, title, status)").eq("source_id", id);
      setExperiments((experimentRows ?? []) as unknown as ExperimentLink[]);
      setMessage("");
    }
    load();
  }, [id]);

  if (!item) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  const canEdit = canEditRecord(item, userId, role);

  return (
    <section className="page-shell experiment-detail">
      <div className="detail-head">
        <div><p className="eyebrow">{item.source_type || "Research Source"}</p><h1>{item.title}</h1><p className="lede">{item.summary}</p></div>
        <div className="detail-actions">
          <StatusPill status={item.status || (item.is_published ? "published" : "draft")} />
          {approved && item.url && <SafeLink href={item.url}>{researchSourceActionLabel(item.source_type)}</SafeLink>}
          {approved && item.file_url && <SafeLink href={item.file_url}>OPEN FILE</SafeLink>}
          {approved && item.citation && <CopyCitationButton citation={item.citation} />}
          {canEdit && <Link className="button" href={`/contribute/research/${item.id}/edit`}>EDIT</Link>}
        </div>
      </div>
      <div className="facts-grid">
        <DetailPair label="Author" value={item.author || "Unknown"} />
        <DetailPair label="Year" value={item.publication_year} />
        <DetailPair label="Publisher" value={item.publisher} />
        <DetailPair label="DOI" value={item.doi} />
        <DetailPair label="Source" value={<SafeLink href={item.url}>Open source</SafeLink>} />
        <DetailPair label="File" value={<SafeLink href={item.file_url}>Open file</SafeLink>} />
      </div>
      <MediaGrid items={media} />
      <Section title="Abstract">{item.abstract && <p>{item.abstract}</p>}</Section>
      <Section title="Historical context">{item.historical_context && <p>{item.historical_context}</p>}</Section>
      <section className="detail-section grid-2">
        <div><p className="section-index">Principle</p><p>{item.principle || "No principle recorded."}</p></div>
        <div><p className="section-index">Research translation</p><p>{item.research_translation || "No translation recorded."}</p></div>
      </section>
      <section className="detail-section grid-2">
        <div><p className="section-index">Relevance</p><p>{[item.forming_method, item.material_relevance, item.tool_relevance, item.undercut_relevance].filter(Boolean).join(" / ") || "No relevance notes recorded."}</p></div>
        <div><p className="section-index">Notes</p><p>{item.notes || "No notes recorded."}</p></div>
      </section>
      <Related title="Related Atlas entries" items={atlas.map((entry) => ({ href: `/atlas/${entry.id}`, title: entry.title, detail: entry.short_description }))} />
      <Related title="Related experiments" items={experiments.map((row) => ({ href: `/experiments/${row.experiment_id}`, title: row.experiments?.title || "Experiment", detail: row.experiments?.code }))} />
    </section>
  );
}

function Related({ title, items }: { title: string; items: { href: string; title: string; detail?: string | null }[] }) {
  return (
    <section className="detail-section">
      <p className="section-index">{title}</p>
      {items.length ? <div className="related-list">{items.map((item) => <Link key={item.href} href={item.href}><strong>{item.title}</strong><small>{item.detail || ""}</small></Link>)}</div> : <p>No related records yet.</p>}
    </section>
  );
}

export function DynamicAtlasPage({ fallback, accessState, allowFallback = false }: { fallback: { code: string; title: string; items: string[] }[]; accessState?: ResearchAccessState; allowFallback?: boolean }) {
  const [categories, setCategories] = useState<AtlasCategory[]>([]);
  const [entries, setEntries] = useState<AtlasEntry[]>([]);
  const [media, setMedia] = useState(new Map<string, LibraryMedia[]>());
  const [query, setQuery] = useState("");
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: categoryData, error: categoryError } = await supabase.from("atlas_categories").select("*").order("sort_order", { ascending: true });
      const { data: entryData, error: entryError } = await supabase.from("atlas_entries").select("*").order("sort_order", { ascending: true });
      if (categoryError || entryError) {
        setUseFallback(allowFallback);
        return;
      }
      setCategories((categoryData ?? []) as AtlasCategory[]);
      const atlasEntries = (entryData ?? []) as AtlasEntry[];
      setEntries(atlasEntries);
      setMedia(await loadMedia("atlas_entry", atlasEntries.map((entry) => entry.id)));
    }
    load();
  }, [allowFallback]);

  const filteredEntries = entries.filter((entry) => [entry.title, entry.short_description, entry.description, entry.principle, entry.research_relevance, entry.atlas_categories?.title].join(" ").toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="page-shell">
      <div className="page-heading split-heading">
        <div>
          <p className="eyebrow">Research Atlas</p>
          <h1>Methods, materials, tool systems, and behaviors</h1>
          <p>The Atlas is an editable knowledge network connecting precedent, principle, tool translation, experiment, and next test.</p>
        </div>
        {isApprovedAccess(accessState) && <Link className="button primary" href="/contribute/atlas/new">+ ADD ATLAS ENTRY</Link>}
      </div>
      {!useFallback && categories.length > 0 && <div className="filter-bar"><input placeholder="Search Atlas entries, principles, relevance" value={query} onChange={(event) => setQuery(event.target.value)} /></div>}
      {useFallback ? (
        <div className="atlas-grid">
          {fallback.map((group) => (
            <article className="atlas-card" key={group.code}><div className="atlas-card-head"><span>{group.code}</span><h2>{group.title}</h2></div><ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul></article>
          ))}
        </div>
      ) : categories.length === 0 && !isApprovedAccess(accessState) ? (
        <PublicEmptyState />
      ) : (
        <div className="atlas-grid">
          {categories.map((category) => (
            <article className="atlas-card" key={category.id}>
              <div className="atlas-card-head"><span>{category.code}</span><h2>{category.title}</h2></div>
              <small>{filteredEntries.filter((entry) => entry.category_id === category.id).length} entries</small>
              {category.description && <p>{category.description}</p>}
              <ul>{filteredEntries.filter((entry) => entry.category_id === category.id).map((entry) => <li key={entry.id}>{firstMedia(media, entry.id) && <img loading="lazy" src={firstMedia(media, entry.id)} alt={entry.title} />}<Link href={`/atlas/${entry.id}`}>{entry.title}</Link>{entry.short_description && <small>{entry.short_description}</small>}</li>)}</ul>
            </article>
          ))}
        </div>
      )}
      <Lineage />
    </section>
  );
}

export function AtlasDetailPage({ id }: { id: string }) {
  const [entry, setEntry] = useState<AtlasEntry | null>(null);
  const [media, setMedia] = useState<LibraryMedia[]>([]);
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
      const { data, error } = await supabase.from("atlas_entries").select("*, atlas_categories(*)").eq("id", id).single();
      if (error || !data) {
        setMessage("RESEARCH ACCESS REQUIRED");
        return;
      }
      setEntry(data as AtlasEntry);
      const mediaMap = await loadMedia("atlas_entry", [id]);
      setMedia(mediaMap.get(id) ?? []);
      setMessage("");
    }
    load();
  }, [id]);

  if (!entry) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  const canEdit = canEditRecord(entry, userId, role);

  return (
    <section className="page-shell experiment-detail">
      <div className="detail-head"><div><p className="eyebrow">{entry.atlas_categories?.title || "Atlas Entry"}</p><h1>{entry.title}</h1><p className="lede">{entry.short_description}</p></div><div className="detail-actions"><StatusPill status={entry.status || "draft"} />{canEdit && <Link className="button" href={`/contribute/atlas/${entry.id}/edit`}>EDIT</Link>}</div></div>
      <Lineage />
      <MediaGrid items={media} />
      <section className="detail-section grid-2"><div><p className="section-index">Principle</p><p>{entry.principle || "No principle recorded."}</p></div><div><p className="section-index">Research relevance</p><p>{entry.research_relevance || "No relevance recorded."}</p></div></section>
      <Section title="Description">{entry.description && <p>{entry.description}</p>}</Section>
      <AtlasRelations id={id} />
    </section>
  );
}

function AtlasRelations({ id }: { id: string }) {
  const [links, setLinks] = useState<{ title: string; items: { href: string; title: string; detail?: string | null }[] }[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [sources, materials, experiments, equipment] = await Promise.all([
        supabase.from("atlas_entry_sources").select("research_sources(id, title, source_type)").eq("atlas_entry_id", id),
        supabase.from("atlas_entry_materials").select("materials(id, name, material_family)").eq("atlas_entry_id", id),
        supabase.from("atlas_entry_experiments").select("experiments(id, code, title)").eq("atlas_entry_id", id),
        supabase.from("atlas_entry_equipment").select("equipment(id, name, equipment_type)").eq("atlas_entry_id", id),
      ]);
      setLinks([
        { title: "Related Research Sources", items: ((sources.data ?? []) as unknown as { research_sources: { id: string; title: string; source_type: string | null } | { id: string; title: string; source_type: string | null }[] | null }[]).map((row) => relationItem(row.research_sources, "/research", "source_type")) },
        { title: "Related Materials", items: ((materials.data ?? []) as unknown as { materials: { id: string; name: string; material_family: string | null } | { id: string; name: string; material_family: string | null }[] | null }[]).map((row) => relationItem(row.materials, "/materials", "material_family", "name")) },
        { title: "Related Experiments", items: ((experiments.data ?? []) as unknown as { experiments: { id: string; code: string | null; title: string } | { id: string; code: string | null; title: string }[] | null }[]).map((row) => relationItem(row.experiments, "/experiments", "code")) },
        { title: "Related Equipment", items: ((equipment.data ?? []) as unknown as { equipment: { id: string; name: string; equipment_type: string | null } | { id: string; name: string; equipment_type: string | null }[] | null }[]).map((row) => relationItem(row.equipment, "/resources/equipment", "equipment_type", "name")) },
      ]);
    }
    load();
  }, [id]);

  return <>{links.map((section) => <Related key={section.title} title={section.title} items={section.items.filter((item) => !item.href.endsWith("undefined"))} />)}</>;
}

function relationItem<T extends { id: string; title?: string; name?: string } & Record<string, string | null | undefined>>(value: T | T[] | null, base: string, detailKey: keyof T, titleKey: keyof T = "title") {
  const record = Array.isArray(value) ? value[0] : value;
  return { href: `${base}/${record?.id}`, title: String(record?.[titleKey] || "Related record"), detail: record?.[detailKey] || null };
}

function Lineage() {
  return <div className="lineage-panel"><p className="section-index">Research lineage</p><div className="lineage"><span>Precedent</span><b>-&gt;</b><span>Principle</span><b>-&gt;</b><span>Tool Translation</span><b>-&gt;</b><span>Experiment</span><b>-&gt;</b><span>Next Test</span></div></div>;
}

export function MaterialsPage({ accessState }: { accessState?: ResearchAccessState }) {
  const [items, setItems] = useState<Material[]>([]);
  const [media, setMedia] = useState(new Map<string, LibraryMedia[]>());
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("");
  const [grade, setGrade] = useState("");
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase.from("materials").select("*").order("name", { ascending: true }).limit(80);
      if (error) {
        setMessage(error.message);
        return;
      }
      const materials = (data ?? []) as Material[];
      setItems(materials);
      setMedia(await loadMedia("material", materials.map((item) => item.id)));
      setMessage("");
    }
    load();
  }, []);

  const families = Array.from(new Set(items.map((item) => item.material_family).filter(Boolean) as string[])).sort();
  const grades = Array.from(new Set(items.map((item) => item.alloy_grade).filter(Boolean) as string[])).sort();
  const filtered = items.filter((item) => [item.name, item.description, item.forming_notes].join(" ").toLowerCase().includes(query.toLowerCase()) && (!family || item.material_family === family) && (!grade || item.alloy_grade === grade));

  return (
    <section className="page-shell">
      <div className="page-heading split-heading"><div><p className="eyebrow">Material Library</p><h1>Materials</h1><p>Scientific and fabrication material identities separated from exact purchasable products.</p></div>{isApprovedAccess(accessState) && <Link className="button primary" href="/contribute/materials/new">+ ADD MATERIAL</Link>}</div>
      <div className="filter-bar"><input placeholder="Search materials" value={query} onChange={(event) => setQuery(event.target.value)} /><select value={family} onChange={(event) => setFamily(event.target.value)}><option value="">All families</option>{families.map((item) => <option key={item}>{item}</option>)}</select><select value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">All grades</option>{grades.map((item) => <option key={item}>{item}</option>)}</select></div>
      {message && <div className="notice">{message}</div>}
      {!message && filtered.length === 0 && (isApprovedAccess(accessState) ? <div className="empty-state"><strong>NO MATERIALS YET</strong><p>Begin the material library by documenting a material used or proposed for forming research.</p><div className="hero-actions"><Link className="button primary" href="/contribute/materials/new">+ ADD MATERIAL</Link></div></div> : <PublicEmptyState />)}
      <div className="research-index">{filtered.map((item) => <Link href={`/materials/${item.id}`} className="research-card" key={item.id}>{firstMedia(media, item.id) ? <img loading="lazy" src={firstMedia(media, item.id)} alt={item.name} /> : <div className="media-placeholder">No image</div>}<div><span>{item.material_family || "Material"}</span><h2>{item.name}</h2><small>{[item.alloy_grade, item.temper_condition].filter(Boolean).join(" / ")}</small><p>{item.forming_notes || item.description || "No notes recorded."}</p><b>{[item.thickness_min_mm, item.thickness_max_mm].filter((value) => value !== null).join(" - ")}{item.thickness_min_mm || item.thickness_max_mm ? " mm" : ""}</b></div></Link>)}</div>
    </section>
  );
}

export function MaterialDetailPage({ id }: { id: string }) {
  const [item, setItem] = useState<Material | null>(null);
  const [media, setMedia] = useState<LibraryMedia[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("Loading...");
  const [approved, setApproved] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        setUserId(auth.user.id);
        const { data: profile } = await supabase.from("profiles").select("role, approval_status, is_active").eq("id", auth.user.id).single();
        setRole(profile?.role ?? "");
        setApproved(profile?.approval_status === "approved" && profile.is_active !== false);
      }
      const { data, error } = await supabase.from("materials").select("*").eq("id", id).single();
      if (error || !data) {
        setMessage("RESEARCH ACCESS REQUIRED");
        return;
      }
      setItem(data as Material);
      setMedia((await loadMedia("material", [id])).get(id) ?? []);
      const { data: productData } = await supabase.from("products").select("*, vendors(id, name, website_url)").eq("material_id", id).order("product_name", { ascending: true });
      setProducts((productData ?? []) as Product[]);
      setMessage("");
    }
    load();
  }, [id]);

  if (!item) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  const canEdit = canEditRecord(item, userId, role);
  return (
    <section className="page-shell experiment-detail">
      <div className="detail-head"><div><p className="eyebrow">Material Identity</p><h1>{item.name}</h1><p className="lede">{item.description}</p></div><div className="detail-actions"><StatusPill status={item.status || "draft"} />{approved && <Link className="button" href={`/contribute/products/new?material=${id}`}>+ ADD PRODUCT FOR THIS MATERIAL</Link>}{canEdit && <Link className="button" href={`/contribute/materials/${item.id}/edit`}>EDIT</Link>}</div></div>
      <div className="facts-grid"><DetailPair label="Family" value={item.material_family} /><DetailPair label="Grade" value={item.alloy_grade} /><DetailPair label="Temper" value={item.temper_condition} /><DetailPair label="Thickness" value={[item.thickness_min_mm, item.thickness_max_mm].filter((value) => value !== null).join(" - ")} /><DetailPair label="Hardness" value={item.hardness} /><DetailPair label="Shore" value={item.shore_hardness} /></div>
      <MediaGrid items={media} />
      <section className="detail-section grid-2"><div><p className="section-index">Material Properties / Notes</p><p>{item.elastic_modulus_notes || item.description || "No material notes."}</p></div><div><p className="section-index">Forming Behavior</p><p>{item.forming_notes || "No forming notes."}</p></div></section>
      <section className="detail-section grid-2"><div><p className="section-index">Surface / safety</p><p>{[item.surface_notes, item.safety_notes].filter(Boolean).join(" ") || "No surface or safety notes."}</p></div><div><p className="section-index">Research notes</p><p>{item.research_notes || item.annealing_notes || "No research notes."}</p></div></section>
      <Related title="Products Used in Lab" items={products.map((product) => ({ href: `/resources/products/${product.id}`, title: product.product_name, detail: [product.manufacturer, product.vendors?.name, product.price ? `${product.currency || "USD"} ${product.price}` : null].filter(Boolean).join(" / ") }))} />
      <RelatedLinks table="atlas_entry_materials" column="material_id" id={id} type="atlas" />
      <RelatedLinks table="experiment_materials" column="material_id" id={id} type="experiment" />
    </section>
  );
}

export function ResourcesPage({ accessState }: { accessState?: ResearchAccessState }) {
  const approved = isApprovedAccess(accessState);
  const sections = [
    { code: "01", title: "Products", href: "/resources/products", addHref: "/contribute/products/new", addLabel: "+ Add Product", detail: "Exact purchasable materials, inserts, tooling supplies, and reorder links." },
    { code: "02", title: "Equipment", href: "/resources/equipment", addHref: "/contribute/equipment/new", addLabel: "+ Add Equipment", detail: "Fabrication and measurement hardware used in the research workflow." },
    { code: "03", title: "Forming Tools", href: "/resources/tools", addHref: "/contribute/tools/new", addLabel: "+ Add Forming Tool", detail: "Reusable molds, dies, inserts, and printed tool construction records." },
    { code: "04", title: "Suppliers", href: "/resources/products", addHref: "/contribute/vendors/new", addLabel: "+ Add Vendor", detail: "Supplier information connected to exact products and repeatable purchasing." },
  ];
  return <section className="page-shell"><div className="page-heading"><p className="eyebrow">Fabrication Resources</p><h1>Resources</h1><p>The practical layer connecting experiments to the exact products, hardware, and suppliers needed to repeat the work.</p></div><div className="admin-grid">{sections.map((section) => <article className="admin-tile" key={section.code}><span>{section.code}</span><strong>{section.title}</strong><small>{section.detail}</small><div className="hero-actions"><Link className="button" href={section.href}>Browse {section.title}</Link>{approved && <Link className="button primary" href={section.addHref}>{section.addLabel}</Link>}</div></article>)}</div></section>;
}

export function ProductsPage({ accessState }: { accessState?: ResearchAccessState }) {
  const [items, setItems] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [material, setMaterial] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [vendor, setVendor] = useState("");
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase.from("products").select("*, materials(id, name), vendors(id, name, website_url)").eq("is_active", true).order("product_name", { ascending: true }).limit(100);
      if (error) setMessage(error.message); else { setItems((data ?? []) as Product[]); setMessage(""); }
    }
    load();
  }, []);

  const materials = Array.from(new Set(items.map((item) => item.materials?.name).filter(Boolean) as string[])).sort();
  const manufacturers = Array.from(new Set(items.map((item) => item.manufacturer).filter(Boolean) as string[])).sort();
  const vendors = Array.from(new Set(items.map((item) => item.vendors?.name).filter(Boolean) as string[])).sort();
  const filtered = items.filter((item) => [item.product_name, item.manufacturer, item.vendor_sku, item.manufacturer_product_code].join(" ").toLowerCase().includes(query.toLowerCase()) && (!material || item.materials?.name === material) && (!manufacturer || item.manufacturer === manufacturer) && (!vendor || item.vendors?.name === vendor));

  return <section className="page-shell"><div className="page-heading split-heading"><div><p className="eyebrow">Fabrication Resources</p><h1>Products</h1><p>Exact commercial products linked to materials, vendors, dimensions, and reorder URLs.</p></div>{isApprovedAccess(accessState) && <div className="detail-actions"><Link className="button primary" href="/contribute/products/new">+ ADD PRODUCT</Link><Link className="button" href="/contribute/vendors/new">+ ADD VENDOR</Link></div>}</div><div className="filter-bar"><input placeholder="Search products, manufacturer, SKU" value={query} onChange={(event) => setQuery(event.target.value)} /><select value={material} onChange={(event) => setMaterial(event.target.value)}><option value="">All materials</option>{materials.map((item) => <option key={item}>{item}</option>)}</select><select value={manufacturer} onChange={(event) => setManufacturer(event.target.value)}><option value="">All manufacturers</option>{manufacturers.map((item) => <option key={item}>{item}</option>)}</select><select value={vendor} onChange={(event) => setVendor(event.target.value)}><option value="">All vendors</option>{vendors.map((item) => <option key={item}>{item}</option>)}</select></div>{message && <div className="notice">{message}</div>}{!message && filtered.length === 0 && (isApprovedAccess(accessState) ? <div className="empty-state"><strong>NO PRODUCTS YET</strong><p>Record exact commercial products so materials can be reordered and experiments reproduced.</p><div className="hero-actions"><Link className="button primary" href="/contribute/products/new">+ ADD PRODUCT</Link><Link className="button" href="/contribute/vendors/new">+ ADD VENDOR</Link></div></div> : <PublicEmptyState />)}<div className="experiment-list">{filtered.map((item) => <Link href={`/resources/products/${item.id}`} className="experiment-row" key={item.id}><div className="experiment-code">{item.vendor_sku || item.manufacturer_product_code || "PRODUCT"}</div><div className="experiment-main"><h2>{item.product_name}</h2><p>{[item.manufacturer, item.materials?.name, item.package_description].filter(Boolean).join(" / ")}</p></div><div className="experiment-meta"><span>{item.vendors?.name || "-"}</span><span>{item.price ? `${item.currency || "USD"} ${item.price}` : "-"}</span><span>{item.price_checked_at ? new Date(item.price_checked_at).toLocaleDateString() : "-"}</span><span>Reorder</span></div></Link>)}</div></section>;
}

export function ProductDetailPage({ id }: { id: string }) {
  const [item, setItem] = useState<Product | null>(null);
  const [media, setMedia] = useState<LibraryMedia[]>([]);
  const [alternatives, setAlternatives] = useState<Product[]>([]);
  const [approved, setApproved] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("Loading...");
  useEffect(() => { async function load() { const supabase = createClient(); const { data: auth } = await supabase.auth.getUser(); if (auth.user) { setUserId(auth.user.id); const { data: profile } = await supabase.from("profiles").select("role, approval_status, is_active").eq("id", auth.user.id).single(); setRole(profile?.role ?? ""); setApproved(profile?.approval_status === "approved" && profile.is_active !== false); } const { data, error } = await supabase.from("products").select("*, materials(id, name), vendors(id, name, website_url)").eq("id", id).single(); if (error || !data) { setMessage("RESEARCH ACCESS REQUIRED"); return; } setItem(data as Product); setMedia((await loadMedia("product", [id])).get(id) ?? []); const { data: altRows } = await supabase.from("product_alternatives").select("products!product_alternatives_alternative_product_id_fkey(*, materials(id, name), vendors(id, name, website_url))").eq("product_id", id); setAlternatives(((altRows ?? []) as any[]).map((row) => Array.isArray(row.products) ? row.products[0] : row.products).filter(Boolean) as Product[]); setMessage(""); } load(); }, [id]);
  if (!item) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  const reorder = approved && typeof item.quantity_in_lab === "number" && typeof item.reorder_level === "number" && item.quantity_in_lab <= item.reorder_level;
  const canEdit = canEditRecord(item, userId, role);
  return <section className="page-shell experiment-detail"><div className="detail-head"><div><p className="eyebrow">Product</p><h1>{item.product_name}</h1><p className="lede">{item.package_description}</p></div><div className="detail-actions"><StatusPill status={item.status || "draft"} />{reorder && <span className="status-pill">REORDER</span>}{canEdit && <Link className="button" href={`/contribute/products/${item.id}/edit`}>EDIT</Link>}</div></div><div className="facts-grid"><DetailPair label="Manufacturer" value={item.manufacturer} /><DetailPair label="Material" value={item.materials?.name} /><DetailPair label="Vendor" value={item.vendors?.name} /><DetailPair label="Vendor SKU" value={item.vendor_sku} /><DetailPair label="Price" value={item.price ? `${item.currency || "USD"} ${item.price}` : null} /><DetailPair label="Checked" value={item.price_checked_at ? new Date(item.price_checked_at).toLocaleDateString() : null} /></div><MediaGrid items={media} /><section className="detail-section grid-2"><div><p className="section-index">Nominal dimensions</p><p>{[item.nominal_thickness_mm && `${item.nominal_thickness_mm} mm thick`, item.nominal_width_mm && `${item.nominal_width_mm} mm wide`, item.nominal_length_mm && `${item.nominal_length_mm} mm long`, item.filament_diameter_mm && `${item.filament_diameter_mm} mm filament`].filter(Boolean).join(" / ") || "No dimensions recorded."}</p></div><div><p className="section-index">Links</p><p><SafeLink href={item.product_url}>Purchase / reorder</SafeLink> <SafeLink href={item.manufacturer_url}>Manufacturer</SafeLink> <SafeLink href={item.vendors?.website_url ?? null}>Vendor website</SafeLink></p></div></section>{approved && <section className="detail-section"><p className="section-index">LAB / REORDER</p><div className="facts-grid"><DetailPair label="Quantity in Lab" value={item.quantity_in_lab} /><DetailPair label="Reorder Level" value={item.reorder_level} /><DetailPair label="Vendor" value={item.vendors?.name} /><DetailPair label="Recorded Price" value={item.price ? `${item.currency || "USD"} ${item.price}` : null} /><DetailPair label="Price Checked" value={item.price_checked_at ? new Date(item.price_checked_at).toLocaleDateString() : null} /><DetailPair label="Purchase Link" value={<SafeLink href={item.product_url}>Open link</SafeLink>} /></div></section>}<Related title="Alternative Products" items={alternatives.map((product) => ({ href: `/resources/products/${product.id}`, title: product.product_name, detail: [product.manufacturer, product.materials?.name, product.vendors?.name].filter(Boolean).join(" / ") }))} /><RelatedLinks table="experiment_products" column="product_id" id={id} type="experiment" /></section>;
}

export function EquipmentPage({ accessState }: { accessState?: ResearchAccessState }) {
  const [items, setItems] = useState<Equipment[]>([]);
  const [media, setMedia] = useState(new Map<string, LibraryMedia[]>());
  const [message, setMessage] = useState("Loading...");
  useEffect(() => { async function load() { const supabase = createClient(); const { data, error } = await supabase.from("equipment").select("*").order("name", { ascending: true }).limit(80); if (error) { setMessage(error.message); return; } const equipment = (data ?? []) as Equipment[]; setItems(equipment); setMedia(await loadMedia("equipment", equipment.map((item) => item.id))); setMessage(""); } load(); }, []);
  return <section className="page-shell"><div className="page-heading split-heading"><div><p className="eyebrow">Fabrication Resources</p><h1>Equipment</h1><p>Fabrication and measurement hardware that shapes, records, and tests the research workflow.</p></div>{isApprovedAccess(accessState) && <Link className="button primary" href="/contribute/equipment/new">+ ADD EQUIPMENT</Link>}</div>{message && <div className="notice">{message}</div>}{!message && items.length === 0 && (isApprovedAccess(accessState) ? <div className="empty-state"><strong>NO EQUIPMENT YET</strong><p>Document fabrication and measurement equipment used by the lab.</p><div className="hero-actions"><Link className="button primary" href="/contribute/equipment/new">+ ADD EQUIPMENT</Link></div></div> : <PublicEmptyState />)}<div className="research-index">{items.map((item) => <Link href={`/resources/equipment/${item.id}`} className="research-card" key={item.id}>{firstMedia(media, item.id) ? <img loading="lazy" src={firstMedia(media, item.id)} alt={item.name} /> : <div className="media-placeholder">No image</div>}<div><span>{item.equipment_type || "Equipment"}</span><h2>{item.name}</h2><small>{[item.manufacturer, item.model].filter(Boolean).join(" / ")}</small><p>{item.description || item.capacity || item.working_envelope || "No description recorded."}</p></div></Link>)}</div></section>;
}

export function EquipmentDetailPage({ id }: { id: string }) {
  const [item, setItem] = useState<Equipment | null>(null);
  const [media, setMedia] = useState<LibraryMedia[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("Loading...");
  useEffect(() => { async function load() { const supabase = createClient(); const { data: auth } = await supabase.auth.getUser(); if (auth.user) { setUserId(auth.user.id); const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single(); setRole(profile?.role ?? ""); } const { data, error } = await supabase.from("equipment").select("*").eq("id", id).single(); if (error || !data) { setMessage("RESEARCH ACCESS REQUIRED"); return; } setItem(data as Equipment); setMedia((await loadMedia("equipment", [id])).get(id) ?? []); setMessage(""); } load(); }, [id]);
  if (!item) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  const canEdit = canEditRecord(item, userId, role);
  return <section className="page-shell experiment-detail"><div className="detail-head"><div><p className="eyebrow">{item.equipment_type || "Equipment"}</p><h1>{item.name}</h1><p className="lede">{item.description}</p></div><div className="detail-actions"><StatusPill status={item.status || "draft"} />{canEdit && <Link className="button" href={`/contribute/equipment/${item.id}/edit`}>EDIT</Link>}</div></div><div className="facts-grid"><DetailPair label="Manufacturer" value={item.manufacturer} /><DetailPair label="Model" value={item.model} /><DetailPair label="Capacity" value={item.capacity} /><DetailPair label="Envelope" value={item.working_envelope} /><DetailPair label="Power" value={item.power_requirements} /></div><MediaGrid items={media} /><section className="detail-section grid-2"><div><p className="section-index">Operating notes</p><p>{item.operating_notes || "No operating notes."}</p></div><div><p className="section-index">Safety notes</p><p>{item.safety_notes || "No safety notes."}</p></div></section><section className="detail-section"><p className="section-index">Links</p><p><SafeLink href={item.manual_url}>Manual</SafeLink> <SafeLink href={item.manufacturer_url}>Manufacturer</SafeLink> <SafeLink href={item.purchase_url}>Purchase</SafeLink></p></section><RelatedLinks table="atlas_entry_equipment" column="equipment_id" id={id} type="atlas" /><RelatedLinks table="experiment_equipment" column="equipment_id" id={id} type="experiment" /></section>;
}

function RelatedLinks({ table, column, id, type }: { table: string; column: string; id: string; type: "atlas" | "experiment" }) {
  const [items, setItems] = useState<{ href: string; title: string; detail?: string | null }[]>([]);
  useEffect(() => { async function load() { const supabase = createClient(); const select = type === "atlas" ? "atlas_entries(id, title, short_description)" : "experiments(id, code, title)"; const { data } = await supabase.from(table).select(select).eq(column, id); const mapped = ((data ?? []) as unknown as Record<string, { id: string; title: string; code?: string | null; short_description?: string | null } | { id: string; title: string; code?: string | null; short_description?: string | null }[] | null>[]).map((row) => { const value = type === "atlas" ? row.atlas_entries : row.experiments; const record = Array.isArray(value) ? value[0] : value; return record ? { href: type === "atlas" ? `/atlas/${record.id}` : `/experiments/${record.id}`, title: record.title, detail: record.code || record.short_description || null } : null; }).filter(Boolean) as { href: string; title: string; detail?: string | null }[]; setItems(mapped); } load(); }, [table, column, id, type]);
  return <Related title={type === "atlas" ? "Related Atlas entries" : "Related experiments"} items={items} />;
}

export function ContributePage() {
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("Loading...");
  useEffect(() => { async function load() { const supabase = createClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) { setMessage("Sign in to contribute."); return; } const { data: profile } = await supabase.from("profiles").select("approval_status, is_active").eq("id", auth.user.id).single(); if (profile?.approval_status !== "approved" || !profile?.is_active) { setMessage("Approved research access is required to contribute."); return; } setAllowed(true); setMessage(""); } load(); }, []);
  const groups = [
    { code: "01", title: "EXPERIMENT", actions: [{ label: "+ New Experiment", href: "/submit" }] },
    { code: "02", title: "RESEARCH", actions: [{ label: "+ Full Research Source", href: "/contribute/research/new" }] },
    { code: "03", title: "KNOWLEDGE", actions: [{ label: "+ Atlas Entry", href: "/contribute/atlas/new" }, { label: "+ Material", href: "/contribute/materials/new" }] },
    { code: "04", title: "FABRICATION RESOURCES", actions: [{ label: "+ Product", href: "/contribute/products/new" }, { label: "+ Vendor", href: "/contribute/vendors/new" }, { label: "+ Equipment", href: "/contribute/equipment/new" }, { label: "+ Forming Tool", href: "/contribute/tools/new" }] },
  ];
  if (!allowed) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  return <section className="page-shell"><div className="page-heading"><p className="eyebrow">Contribute</p><h1>CONTRIBUTE</h1><p>Contributions start as internal drafts. Capture first, enrich later, and submit when ready for review.</p></div><div className="admin-grid">{groups.map((group) => <article className="admin-tile" key={group.code}><span>{group.code}</span><strong>{group.title}</strong>{group.title === "RESEARCH" && <ResearchQuickAdd />}<div className="hero-actions">{group.actions.map((action) => <Link className="button primary" href={action.href} key={action.href}>{action.label}</Link>)}</div></article>)}</div></section>;
}

export function MyWorkPage() {
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("Loading...");
  const [groups, setGroups] = useState<{ title: string; add: string; items: { title: string; type: string; date?: string | null; status?: string | null; open: string; edit?: string }[] }[]>([]);
  useEffect(() => { async function load() { const supabase = createClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) { setMessage("Sign in to view your work."); return; } const { data: profile } = await supabase.from("profiles").select("approval_status, is_active").eq("id", auth.user.id).single(); if (profile?.approval_status !== "approved" || !profile?.is_active) { setMessage("Approved research access is required to view your work."); return; } setUserId(auth.user.id); const [experiments, research, atlas, materials, products, equipment, tools] = await Promise.all([supabase.from("experiments").select("id, title, created_at, status").eq("researcher_id", auth.user.id).order("created_at", { ascending: false }), supabase.from("research_sources").select("id, title, updated_at, status").eq("added_by", auth.user.id).order("updated_at", { ascending: false }), supabase.from("atlas_entries").select("id, title, updated_at, status").eq("created_by", auth.user.id).order("updated_at", { ascending: false }), supabase.from("materials").select("id, name, updated_at, status").eq("created_by", auth.user.id).order("updated_at", { ascending: false }), supabase.from("products").select("id, product_name, updated_at, status").eq("created_by", auth.user.id).order("updated_at", { ascending: false }), supabase.from("equipment").select("id, name, updated_at, status").eq("created_by", auth.user.id).order("updated_at", { ascending: false }), supabase.from("forming_tools").select("id, name, updated_at, status").eq("created_by", auth.user.id).order("updated_at", { ascending: false })]); setGroups([{ title: "Experiments", add: "/submit", items: ((experiments.data ?? []) as { id: string; title: string; created_at: string; status: string }[]).map((item) => ({ title: item.title, type: "Experiment", date: item.created_at, status: item.status, open: `/experiments/${item.id}`, edit: isEditableStatus(item.status) ? `/experiments/${item.id}/edit` : undefined })) }, { title: "Research", add: "/contribute/research/new", items: ((research.data ?? []) as { id: string; title: string; updated_at: string; status: string }[]).map((item) => ({ title: item.title, type: "Research", date: item.updated_at, status: item.status, open: `/research/${item.id}`, edit: isEditableStatus(item.status) ? `/contribute/research/${item.id}/edit` : undefined })) }, { title: "Atlas", add: "/contribute/atlas/new", items: ((atlas.data ?? []) as { id: string; title: string; updated_at: string; status: string }[]).map((item) => ({ title: item.title, type: "Atlas", date: item.updated_at, status: item.status, open: `/atlas/${item.id}`, edit: isEditableStatus(item.status) ? `/contribute/atlas/${item.id}/edit` : undefined })) }, { title: "Materials", add: "/contribute/materials/new", items: ((materials.data ?? []) as { id: string; name: string; updated_at: string; status: string }[]).map((item) => ({ title: item.name, type: "Material", date: item.updated_at, status: item.status, open: `/materials/${item.id}`, edit: isEditableStatus(item.status) ? `/contribute/materials/${item.id}/edit` : undefined })) }, { title: "Products", add: "/contribute/products/new", items: ((products.data ?? []) as { id: string; product_name: string; updated_at: string; status: string }[]).map((item) => ({ title: item.product_name, type: "Product", date: item.updated_at, status: item.status, open: `/resources/products/${item.id}`, edit: isEditableStatus(item.status) ? `/contribute/products/${item.id}/edit` : undefined })) }, { title: "Equipment", add: "/contribute/equipment/new", items: ((equipment.data ?? []) as { id: string; name: string; updated_at: string; status: string }[]).map((item) => ({ title: item.name, type: "Equipment", date: item.updated_at, status: item.status, open: `/resources/equipment/${item.id}`, edit: isEditableStatus(item.status) ? `/contribute/equipment/${item.id}/edit` : undefined })) }, { title: "Forming Tools", add: "/contribute/tools/new", items: ((tools.data ?? []) as { id: string; name: string; updated_at: string; status: string }[]).map((item) => ({ title: item.name, type: "Forming Tool", date: item.updated_at, status: item.status, open: `/resources/tools/${item.id}`, edit: isEditableStatus(item.status) ? `/contribute/tools/${item.id}/edit` : undefined })) }]); setMessage(""); } load(); }, []);
  if (!userId) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  return <section className="page-shell"><div className="page-heading split-heading"><div><p className="eyebrow">Research Portal</p><h1>My Work</h1><p>Your experiments, research, Atlas entries, materials, products, and equipment contributions.</p></div><Link className="button primary" href="/contribute">+ Add</Link></div>{groups.map((group) => <section className="detail-section" key={group.title}><div className="section-heading-row"><p className="section-index">{group.title}</p><Link href={group.add}>+ Add</Link></div><div className="admin-table">{group.items.map((item) => <div className="my-experiment-row" key={`${group.title}-${item.open}`}><span>{item.type}</span><span>{item.title}</span><span>{item.date ? new Date(item.date).toLocaleDateString() : "-"}</span><span><StatusPill status={item.status || "draft"} /></span><span className="inline-actions"><Link href={item.open}>Open</Link>{item.edit ? <Link href={item.edit}>Edit</Link> : <small>This record is part of the reviewed research archive. Contact an administrator to revise it.</small>}</span></div>)}</div></section>)}</section>;
}
