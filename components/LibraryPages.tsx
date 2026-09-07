"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { isEditableStatus, LibraryMedia } from "../lib/library";
import { MediaGrid } from "./MediaGrid";
import { StatusPill } from "./StatusPill";

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

const sourceTypes = ["Article", "Journal Paper", "Conference Paper", "Patent", "Book", "Thesis", "Technical Manual", "Historical Object", "Image", "Video", "Website", "Supplier Page"];

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

  return media.reduce((map, item) => {
    const current = map.get(item.entity_id) ?? [];
    current.push(item);
    map.set(item.entity_id, current);
    return map;
  }, new Map<string, LibraryMedia[]>());
}

function firstMedia(media: Map<string, LibraryMedia[]>, id: string) {
  const item = media.get(id)?.[0];
  return item?.signedUrl || item?.external_url || "";
}

function SafeLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return null;
  return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
}

function DetailPair({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  if (!children) return null;
  return <section className="detail-section"><p className="section-index">{title}</p>{children}</section>;
}

export function ResearchLibraryPage() {
  const [items, setItems] = useState<Source[]>([]);
  const [media, setMedia] = useState(new Map<string, LibraryMedia[]>());
  const [message, setMessage] = useState("Loading...");
  const [query, setQuery] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [year, setYear] = useState("");
  const [formingMethod, setFormingMethod] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("research_sources")
        .select("id, title, author, publication_year, source_type, summary, principle, forming_method, status, is_published")
        .order("publication_year", { ascending: false })
        .limit(80);
      if (error) {
        setMessage(error.message);
        return;
      }
      const sources = (data ?? []) as Source[];
      setItems(sources);
      setMedia(await loadMedia("research_source", sources.map((item) => item.id)));
      setMessage("");
    }
    load();
  }, []);

  const years = Array.from(new Set(items.map((item) => item.publication_year).filter(Boolean))).sort((a, b) => Number(b) - Number(a));
  const methods = Array.from(new Set(items.map((item) => item.forming_method).filter(Boolean) as string[])).sort();
  const filtered = useMemo(() => items.filter((item) => {
    const text = [item.title, item.author, item.summary, item.principle].join(" ").toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (!sourceType || item.source_type === sourceType)
      && (!year || String(item.publication_year ?? "") === year)
      && (!formingMethod || item.forming_method === formingMethod);
  }), [items, query, sourceType, year, formingMethod]);

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Research Library</p>
        <h1>Research</h1>
        <p>Precedents, principles, supplier knowledge, technical manuals, and process references for press-forming research.</p>
      </div>
      <div className="filter-bar">
        <input placeholder="Search title, author, summary, principle" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="">All types</option>{sourceTypes.map((type) => <option key={type}>{type}</option>)}</select>
        <select value={year} onChange={(event) => setYear(event.target.value)}><option value="">All years</option>{years.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={formingMethod} onChange={(event) => setFormingMethod(event.target.value)}><option value="">All methods</option>{methods.map((item) => <option key={item}>{item}</option>)}</select>
      </div>
      {message && <div className="notice">{message}</div>}
      <div className="research-index">
        {filtered.map((item) => (
          <Link href={`/research/${item.id}`} className="research-card" key={item.id}>
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
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
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

  return (
    <section className="page-shell experiment-detail">
      <div className="detail-head">
        <div><p className="eyebrow">{item.source_type || "Research Source"}</p><h1>{item.title}</h1><p className="lede">{item.summary}</p></div>
        <StatusPill status={item.status || (item.is_published ? "published" : "draft")} />
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

export function DynamicAtlasPage({ fallback }: { fallback: { code: string; title: string; items: string[] }[] }) {
  const [categories, setCategories] = useState<AtlasCategory[]>([]);
  const [entries, setEntries] = useState<AtlasEntry[]>([]);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: categoryData, error: categoryError } = await supabase.from("atlas_categories").select("*").order("sort_order", { ascending: true });
      const { data: entryData, error: entryError } = await supabase.from("atlas_entries").select("*").order("sort_order", { ascending: true });
      if (categoryError || entryError) {
        setUseFallback(true);
        return;
      }
      setCategories((categoryData ?? []) as AtlasCategory[]);
      setEntries((entryData ?? []) as AtlasEntry[]);
    }
    load();
  }, []);

  return (
    <section className="page-shell">
      <div className="page-heading">
        <p className="eyebrow">Research Atlas</p>
        <h1>Methods, materials, tool systems, and behaviors</h1>
        <p>The Atlas is an editable knowledge network connecting precedent, principle, tool translation, experiment, and next test.</p>
      </div>
      <div className="atlas-grid">
        {useFallback ? fallback.map((group) => (
          <article className="atlas-card" key={group.code}><div className="atlas-card-head"><span>{group.code}</span><h2>{group.title}</h2></div><ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul></article>
        )) : categories.map((category) => (
          <article className="atlas-card" key={category.id}>
            <div className="atlas-card-head"><span>{category.code}</span><h2>{category.title}</h2></div>
            {category.description && <p>{category.description}</p>}
            <ul>{entries.filter((entry) => entry.category_id === category.id).map((entry) => <li key={entry.id}><Link href={`/atlas/${entry.id}`}>{entry.title}</Link>{entry.short_description && <small>{entry.short_description}</small>}</li>)}</ul>
          </article>
        ))}
      </div>
      <Lineage />
    </section>
  );
}

export function AtlasDetailPage({ id }: { id: string }) {
  const [entry, setEntry] = useState<AtlasEntry | null>(null);
  const [media, setMedia] = useState<LibraryMedia[]>([]);
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
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

  return (
    <section className="page-shell experiment-detail">
      <div className="detail-head"><div><p className="eyebrow">{entry.atlas_categories?.title || "Atlas Entry"}</p><h1>{entry.title}</h1><p className="lede">{entry.short_description}</p></div><StatusPill status={entry.status || "draft"} /></div>
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

export function MaterialsPage() {
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
      <div className="page-heading"><p className="eyebrow">Material Library</p><h1>Materials</h1><p>Scientific and fabrication material identities separated from exact purchasable products.</p></div>
      <div className="filter-bar"><input placeholder="Search materials" value={query} onChange={(event) => setQuery(event.target.value)} /><select value={family} onChange={(event) => setFamily(event.target.value)}><option value="">All families</option>{families.map((item) => <option key={item}>{item}</option>)}</select><select value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">All grades</option>{grades.map((item) => <option key={item}>{item}</option>)}</select></div>
      {message && <div className="notice">{message}</div>}
      <div className="research-index">{filtered.map((item) => <Link href={`/materials/${item.id}`} className="research-card" key={item.id}>{firstMedia(media, item.id) ? <img loading="lazy" src={firstMedia(media, item.id)} alt={item.name} /> : <div className="media-placeholder">No image</div>}<div><span>{item.material_family || "Material"}</span><h2>{item.name}</h2><small>{[item.alloy_grade, item.temper_condition].filter(Boolean).join(" / ")}</small><p>{item.forming_notes || item.description || "No notes recorded."}</p><b>{[item.thickness_min_mm, item.thickness_max_mm].filter((value) => value !== null).join(" - ")}{item.thickness_min_mm || item.thickness_max_mm ? " mm" : ""}</b></div></Link>)}</div>
    </section>
  );
}

export function MaterialDetailPage({ id }: { id: string }) {
  const [item, setItem] = useState<Material | null>(null);
  const [media, setMedia] = useState<LibraryMedia[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
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
  return (
    <section className="page-shell experiment-detail">
      <div className="detail-head"><div><p className="eyebrow">Material Identity</p><h1>{item.name}</h1><p className="lede">{item.description}</p></div><StatusPill status={item.status || "draft"} /></div>
      <div className="facts-grid"><DetailPair label="Family" value={item.material_family} /><DetailPair label="Grade" value={item.alloy_grade} /><DetailPair label="Temper" value={item.temper_condition} /><DetailPair label="Thickness" value={[item.thickness_min_mm, item.thickness_max_mm].filter((value) => value !== null).join(" - ")} /><DetailPair label="Hardness" value={item.hardness} /><DetailPair label="Shore" value={item.shore_hardness} /></div>
      <MediaGrid items={media} />
      <section className="detail-section grid-2"><div><p className="section-index">Forming notes</p><p>{item.forming_notes || "No forming notes."}</p></div><div><p className="section-index">Annealing notes</p><p>{item.annealing_notes || "No annealing notes."}</p></div></section>
      <section className="detail-section grid-2"><div><p className="section-index">Surface / safety</p><p>{[item.surface_notes, item.safety_notes].filter(Boolean).join(" ") || "No surface or safety notes."}</p></div><div><p className="section-index">Research notes</p><p>{item.research_notes || item.elastic_modulus_notes || "No research notes."}</p></div></section>
      <Related title="Related products" items={products.map((product) => ({ href: `/resources/products/${product.id}`, title: product.product_name, detail: [product.manufacturer, product.vendors?.name, product.price ? `${product.currency || "USD"} ${product.price}` : null].filter(Boolean).join(" / ") }))} />
      <RelatedLinks table="atlas_entry_materials" column="material_id" id={id} type="atlas" />
      <RelatedLinks table="experiment_materials" column="material_id" id={id} type="experiment" />
    </section>
  );
}

export function ResourcesPage() {
  const sections = [
    { code: "01", title: "Products", href: "/resources/products", detail: "Exact purchasable materials, inserts, tooling supplies, and reorder links." },
    { code: "02", title: "Equipment", href: "/resources/equipment", detail: "Fabrication and measurement hardware used in the research workflow." },
    { code: "03", title: "Suppliers", href: "/resources/products", detail: "Public supplier names and purchase links surfaced through published products." },
  ];
  return <section className="page-shell"><div className="page-heading"><p className="eyebrow">Fabrication Resources</p><h1>Resources</h1><p>The practical layer connecting experiments to the exact products, hardware, and suppliers needed to repeat the work.</p></div><div className="admin-grid">{sections.map((section) => <Link className="admin-tile" href={section.href} key={section.code}><span>{section.code}</span><strong>{section.title}</strong><small>{section.detail}</small></Link>)}</div></section>;
}

export function ProductsPage() {
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

  return <section className="page-shell"><div className="page-heading"><p className="eyebrow">Fabrication Resources</p><h1>Products</h1><p>Exact commercial products linked to materials, vendors, dimensions, and reorder URLs.</p></div><div className="filter-bar"><input placeholder="Search products, manufacturer, SKU" value={query} onChange={(event) => setQuery(event.target.value)} /><select value={material} onChange={(event) => setMaterial(event.target.value)}><option value="">All materials</option>{materials.map((item) => <option key={item}>{item}</option>)}</select><select value={manufacturer} onChange={(event) => setManufacturer(event.target.value)}><option value="">All manufacturers</option>{manufacturers.map((item) => <option key={item}>{item}</option>)}</select><select value={vendor} onChange={(event) => setVendor(event.target.value)}><option value="">All vendors</option>{vendors.map((item) => <option key={item}>{item}</option>)}</select></div>{message && <div className="notice">{message}</div>}<div className="experiment-list">{filtered.map((item) => <Link href={`/resources/products/${item.id}`} className="experiment-row" key={item.id}><div className="experiment-code">{item.vendor_sku || item.manufacturer_product_code || "PRODUCT"}</div><div className="experiment-main"><h2>{item.product_name}</h2><p>{[item.manufacturer, item.materials?.name, item.package_description].filter(Boolean).join(" / ")}</p></div><div className="experiment-meta"><span>{item.vendors?.name || "-"}</span><span>{item.price ? `${item.currency || "USD"} ${item.price}` : "-"}</span><span>{item.price_checked_at ? new Date(item.price_checked_at).toLocaleDateString() : "-"}</span><span>Reorder</span></div></Link>)}</div></section>;
}

export function ProductDetailPage({ id }: { id: string }) {
  const [item, setItem] = useState<Product | null>(null);
  const [media, setMedia] = useState<LibraryMedia[]>([]);
  const [message, setMessage] = useState("Loading...");
  useEffect(() => { async function load() { const supabase = createClient(); const { data, error } = await supabase.from("products").select("*, materials(id, name), vendors(id, name, website_url)").eq("id", id).single(); if (error || !data) { setMessage("RESEARCH ACCESS REQUIRED"); return; } setItem(data as Product); setMedia((await loadMedia("product", [id])).get(id) ?? []); setMessage(""); } load(); }, [id]);
  if (!item) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  return <section className="page-shell experiment-detail"><div className="detail-head"><div><p className="eyebrow">Product</p><h1>{item.product_name}</h1><p className="lede">{item.package_description}</p></div><StatusPill status={item.status || "draft"} /></div><div className="facts-grid"><DetailPair label="Manufacturer" value={item.manufacturer} /><DetailPair label="Material" value={item.materials?.name} /><DetailPair label="Vendor" value={item.vendors?.name} /><DetailPair label="Vendor SKU" value={item.vendor_sku} /><DetailPair label="Price" value={item.price ? `${item.currency || "USD"} ${item.price}` : null} /><DetailPair label="Checked" value={item.price_checked_at ? new Date(item.price_checked_at).toLocaleDateString() : null} /></div><MediaGrid items={media} /><section className="detail-section grid-2"><div><p className="section-index">Nominal dimensions</p><p>{[item.nominal_thickness_mm && `${item.nominal_thickness_mm} mm thick`, item.nominal_width_mm && `${item.nominal_width_mm} mm wide`, item.nominal_length_mm && `${item.nominal_length_mm} mm long`, item.filament_diameter_mm && `${item.filament_diameter_mm} mm filament`].filter(Boolean).join(" / ") || "No dimensions recorded."}</p></div><div><p className="section-index">Reorder</p><p><SafeLink href={item.product_url}>Purchase / reorder</SafeLink> <SafeLink href={item.manufacturer_url}>Manufacturer</SafeLink> <SafeLink href={item.vendors?.website_url ?? null}>Vendor website</SafeLink></p></div></section><RelatedLinks table="experiment_products" column="product_id" id={id} type="experiment" /></section>;
}

export function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [media, setMedia] = useState(new Map<string, LibraryMedia[]>());
  const [message, setMessage] = useState("Loading...");
  useEffect(() => { async function load() { const supabase = createClient(); const { data, error } = await supabase.from("equipment").select("*").order("name", { ascending: true }).limit(80); if (error) { setMessage(error.message); return; } const equipment = (data ?? []) as Equipment[]; setItems(equipment); setMedia(await loadMedia("equipment", equipment.map((item) => item.id))); setMessage(""); } load(); }, []);
  return <section className="page-shell"><div className="page-heading"><p className="eyebrow">Fabrication Resources</p><h1>Equipment</h1><p>Fabrication and measurement hardware that shapes, records, and tests the research workflow.</p></div>{message && <div className="notice">{message}</div>}<div className="research-index">{items.map((item) => <Link href={`/resources/equipment/${item.id}`} className="research-card" key={item.id}>{firstMedia(media, item.id) ? <img loading="lazy" src={firstMedia(media, item.id)} alt={item.name} /> : <div className="media-placeholder">No image</div>}<div><span>{item.equipment_type || "Equipment"}</span><h2>{item.name}</h2><small>{[item.manufacturer, item.model].filter(Boolean).join(" / ")}</small><p>{item.description || item.capacity || item.working_envelope || "No description recorded."}</p></div></Link>)}</div></section>;
}

export function EquipmentDetailPage({ id }: { id: string }) {
  const [item, setItem] = useState<Equipment | null>(null);
  const [media, setMedia] = useState<LibraryMedia[]>([]);
  const [message, setMessage] = useState("Loading...");
  useEffect(() => { async function load() { const supabase = createClient(); const { data, error } = await supabase.from("equipment").select("*").eq("id", id).single(); if (error || !data) { setMessage("RESEARCH ACCESS REQUIRED"); return; } setItem(data as Equipment); setMedia((await loadMedia("equipment", [id])).get(id) ?? []); setMessage(""); } load(); }, [id]);
  if (!item) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  return <section className="page-shell experiment-detail"><div className="detail-head"><div><p className="eyebrow">{item.equipment_type || "Equipment"}</p><h1>{item.name}</h1><p className="lede">{item.description}</p></div><StatusPill status={item.status || "draft"} /></div><div className="facts-grid"><DetailPair label="Manufacturer" value={item.manufacturer} /><DetailPair label="Model" value={item.model} /><DetailPair label="Capacity" value={item.capacity} /><DetailPair label="Envelope" value={item.working_envelope} /><DetailPair label="Power" value={item.power_requirements} /></div><MediaGrid items={media} /><section className="detail-section grid-2"><div><p className="section-index">Operating notes</p><p>{item.operating_notes || "No operating notes."}</p></div><div><p className="section-index">Safety notes</p><p>{item.safety_notes || "No safety notes."}</p></div></section><section className="detail-section"><p className="section-index">Links</p><p><SafeLink href={item.manual_url}>Manual</SafeLink> <SafeLink href={item.manufacturer_url}>Manufacturer</SafeLink> <SafeLink href={item.purchase_url}>Purchase</SafeLink></p></section><RelatedLinks table="atlas_entry_equipment" column="equipment_id" id={id} type="atlas" /><RelatedLinks table="experiment_equipment" column="equipment_id" id={id} type="experiment" /></section>;
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
  const links = [["Add Research Source", "/contribute/research/new"], ["Add Atlas Entry", "/contribute/atlas/new"], ["Add Material", "/contribute/materials/new"], ["Add Product", "/contribute/products/new"], ["Add Vendor", "/contribute/vendors/new"], ["Add Equipment", "/contribute/equipment/new"]];
  if (!allowed) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  return <section className="page-shell"><div className="page-heading"><p className="eyebrow">Contribute</p><h1>Contribute to Forming Material</h1><p>Contributions remain editable while Draft or Submitted. Reviewed and Published records become part of the canonical research archive.</p></div><div className="admin-grid">{links.map(([title, href], index) => <Link className="admin-tile" href={href} key={href}><span>{String(index + 1).padStart(2, "0")}</span><strong>+ {title}</strong><small>Draft or submit for review</small></Link>)}</div></section>;
}

export function MyWorkPage() {
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("Loading...");
  const [groups, setGroups] = useState<{ title: string; add: string; items: { title: string; type: string; date?: string | null; status?: string | null; open: string; edit?: string }[] }[]>([]);
  useEffect(() => { async function load() { const supabase = createClient(); const { data: auth } = await supabase.auth.getUser(); if (!auth.user) { setMessage("Sign in to view your work."); return; } const { data: profile } = await supabase.from("profiles").select("approval_status, is_active").eq("id", auth.user.id).single(); if (profile?.approval_status !== "approved" || !profile?.is_active) { setMessage("Approved research access is required to view your work."); return; } setUserId(auth.user.id); const [experiments, research, atlas, materials, products, equipment] = await Promise.all([supabase.from("experiments").select("id, title, created_at, status").eq("researcher_id", auth.user.id).order("created_at", { ascending: false }), supabase.from("research_sources").select("id, title, updated_at, status").eq("added_by", auth.user.id).order("updated_at", { ascending: false }), supabase.from("atlas_entries").select("id, title, updated_at, status").eq("created_by", auth.user.id).order("updated_at", { ascending: false }), supabase.from("materials").select("id, name, updated_at, status").eq("created_by", auth.user.id).order("updated_at", { ascending: false }), supabase.from("products").select("id, product_name, updated_at, status").eq("created_by", auth.user.id).order("updated_at", { ascending: false }), supabase.from("equipment").select("id, name, updated_at, status").eq("created_by", auth.user.id).order("updated_at", { ascending: false })]); setGroups([{ title: "Experiments", add: "/submit", items: ((experiments.data ?? []) as { id: string; title: string; created_at: string; status: string }[]).map((item) => ({ title: item.title, type: "Experiment", date: item.created_at, status: item.status, open: `/experiments/${item.id}`, edit: isEditableStatus(item.status) ? `/experiments/${item.id}/edit` : undefined })) }, { title: "Research", add: "/contribute/research/new", items: ((research.data ?? []) as { id: string; title: string; updated_at: string; status: string }[]).map((item) => ({ title: item.title, type: "Research", date: item.updated_at, status: item.status, open: `/research/${item.id}`, edit: isEditableStatus(item.status) ? `/contribute/research/${item.id}/edit` : undefined })) }, { title: "Atlas", add: "/contribute/atlas/new", items: ((atlas.data ?? []) as { id: string; title: string; updated_at: string; status: string }[]).map((item) => ({ title: item.title, type: "Atlas", date: item.updated_at, status: item.status, open: `/atlas/${item.id}`, edit: isEditableStatus(item.status) ? `/contribute/atlas/${item.id}/edit` : undefined })) }, { title: "Materials", add: "/contribute/materials/new", items: ((materials.data ?? []) as { id: string; name: string; updated_at: string; status: string }[]).map((item) => ({ title: item.name, type: "Material", date: item.updated_at, status: item.status, open: `/materials/${item.id}`, edit: isEditableStatus(item.status) ? `/contribute/materials/${item.id}/edit` : undefined })) }, { title: "Products", add: "/contribute/products/new", items: ((products.data ?? []) as { id: string; product_name: string; updated_at: string; status: string }[]).map((item) => ({ title: item.product_name, type: "Product", date: item.updated_at, status: item.status, open: `/resources/products/${item.id}`, edit: isEditableStatus(item.status) ? `/contribute/products/${item.id}/edit` : undefined })) }, { title: "Equipment", add: "/contribute/equipment/new", items: ((equipment.data ?? []) as { id: string; name: string; updated_at: string; status: string }[]).map((item) => ({ title: item.name, type: "Equipment", date: item.updated_at, status: item.status, open: `/resources/equipment/${item.id}`, edit: isEditableStatus(item.status) ? `/contribute/equipment/${item.id}/edit` : undefined })) }]); setMessage(""); } load(); }, []);
  if (!userId) return <section className="page-shell narrow-shell"><div className="notice">{message}</div></section>;
  return <section className="page-shell"><div className="page-heading split-heading"><div><p className="eyebrow">Research Portal</p><h1>My Work</h1><p>Your experiments, research, Atlas entries, materials, products, and equipment contributions.</p></div><Link className="button primary" href="/contribute">+ Add</Link></div>{groups.map((group) => <section className="detail-section" key={group.title}><div className="section-heading-row"><p className="section-index">{group.title}</p><Link href={group.add}>+ Add</Link></div><div className="admin-table">{group.items.map((item) => <div className="my-experiment-row" key={`${group.title}-${item.open}`}><span>{item.type}</span><span>{item.title}</span><span>{item.date ? new Date(item.date).toLocaleDateString() : "-"}</span><span><StatusPill status={item.status || "draft"} /></span><span className="inline-actions"><Link href={item.open}>Open</Link>{item.edit ? <Link href={item.edit}>Edit</Link> : <small>This record is part of the reviewed research archive. Contact an administrator to revise it.</small>}</span></div>)}</div></section>)}</section>;
}
