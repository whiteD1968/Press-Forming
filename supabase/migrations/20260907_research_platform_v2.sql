-- Research Platform V2: experiment protocol, library architecture, and atlas data model.
-- This migration is additive. Do not run it until it has been reviewed.

-- Research model:
-- Precedent -> Principle -> Tool Translation -> Experiment -> Next Test.
-- The archive intentionally uses flexible cross-link tables rather than one rigid lineage table.

alter table public.experiments
  add column if not exists research_objective text,
  add column if not exists hypothesis text,
  add column if not exists sheet_width_mm numeric,
  add column if not exists sheet_length_mm numeric,
  add column if not exists initial_geometry text,
  add column if not exists final_geometry text,
  add column if not exists forming_method text,
  add column if not exists geometry_type text,
  add column if not exists undercut_type text,
  add column if not exists undercut_width_mm numeric,
  add column if not exists undercut_height_mm numeric,
  add column if not exists lateral_displacement_mm numeric,
  add column if not exists max_thinning_percent numeric,
  add column if not exists measured_thickness_min_mm numeric,
  add column if not exists wrinkling_severity text,
  add column if not exists surface_condition text,
  add column if not exists tool_damage text,
  add column if not exists measurement_method text,
  add column if not exists ambient_temperature_c numeric,
  add column if not exists conclusion text,
  add column if not exists next_test text;

alter table public.experiment_stages
  add column if not exists tool_geometry text,
  add column if not exists tool_process text,
  add column if not exists tool_hardness text,
  add column if not exists print_material text,
  add column if not exists print_layer_height_mm numeric,
  add column if not exists print_infill_percent numeric,
  add column if not exists print_infill_pattern text,
  add column if not exists print_wall_count integer,
  add column if not exists print_orientation text,
  add column if not exists tool_temperature_c numeric,
  add column if not exists tool_constraint text,
  add column if not exists sheet_restraint text,
  add column if not exists target_press_force_tons numeric,
  add column if not exists measured_press_force_tons numeric,
  add column if not exists dwell_time_seconds numeric,
  add column if not exists press_direction text,
  add column if not exists material_flow_direction text,
  add column if not exists stage_result text,
  add column if not exists springback_after_stage_deg numeric,
  add column if not exists tool_deformation_mm numeric,
  add column if not exists stage_image_notes text;

create table if not exists public.taxonomy_terms (
  id uuid primary key default gen_random_uuid(),
  taxonomy_type text not null,
  name text not null,
  slug text,
  description text,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (taxonomy_type, name)
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  material_family text,
  alloy_grade text,
  temper_condition text,
  description text,
  thickness_min_mm numeric,
  thickness_max_mm numeric,
  hardness text,
  shore_hardness text,
  elastic_modulus_notes text,
  forming_notes text,
  annealing_notes text,
  surface_notes text,
  safety_notes text,
  research_notes text,
  status text not null default 'draft',
  is_published boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint materials_status_check check (status in ('draft', 'submitted', 'reviewed', 'published', 'archived'))
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website_url text,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  is_active boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.materials(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  manufacturer text,
  product_name text not null,
  manufacturer_product_code text,
  vendor_sku text,
  product_url text,
  manufacturer_url text,
  package_description text,
  nominal_thickness_mm numeric,
  nominal_width_mm numeric,
  nominal_length_mm numeric,
  filament_diameter_mm numeric,
  shore_hardness text,
  color text,
  price numeric,
  currency text default 'USD',
  price_checked_at timestamptz,
  quantity_in_lab numeric,
  reorder_level numeric,
  inventory_notes text,
  purchase_notes text,
  status text not null default 'draft',
  is_active boolean default true,
  is_published boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint products_status_check check (status in ('draft', 'submitted', 'reviewed', 'published', 'archived'))
);

create table if not exists public.product_purchases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  purchase_date date,
  quantity numeric,
  unit_price numeric,
  total_price numeric,
  currency text default 'USD',
  order_reference text,
  notes text,
  purchased_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  equipment_type text,
  manufacturer text,
  model text,
  description text,
  capacity text,
  working_envelope text,
  power_requirements text,
  location text,
  manual_url text,
  manufacturer_url text,
  purchase_url text,
  operating_notes text,
  maintenance_notes text,
  safety_notes text,
  status text not null default 'draft',
  is_active boolean default true,
  is_published boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint equipment_status_check check (status in ('draft', 'submitted', 'reviewed', 'published', 'archived'))
);

alter table public.research_sources
  add column if not exists author text,
  add column if not exists publication_year integer,
  add column if not exists publisher text,
  add column if not exists doi text,
  add column if not exists source_date date,
  add column if not exists abstract text,
  add column if not exists summary text,
  add column if not exists historical_context text,
  add column if not exists forming_method text,
  add column if not exists material_relevance text,
  add column if not exists tool_relevance text,
  add column if not exists undercut_relevance text,
  add column if not exists image_url text,
  add column if not exists image_credit text,
  add column if not exists file_url text,
  add column if not exists added_by uuid references auth.users(id),
  add column if not exists status text not null default 'draft',
  add column if not exists updated_at timestamptz default now();

update public.research_sources
set status = case
  when is_published = true then 'published'
  else 'draft'
end
where status is null
  or status = 'draft'
  or status = 'published';

alter table public.research_sources
  alter column status set default 'draft';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'research_sources_status_check'
      and conrelid = 'public.research_sources'::regclass
  ) then
    alter table public.research_sources
      add constraint research_sources_status_check
      check (status in ('draft', 'submitted', 'reviewed', 'published', 'archived'));
  end if;
end;
$$;

create table if not exists public.atlas_categories (
  id uuid primary key default gen_random_uuid(),
  code text,
  title text not null,
  slug text unique,
  description text,
  sort_order integer default 0,
  is_published boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.atlas_entries (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.atlas_categories(id) on delete cascade,
  title text not null,
  slug text,
  short_description text,
  description text,
  principle text,
  research_relevance text,
  image_url text,
  image_credit text,
  sort_order integer default 0,
  status text not null default 'draft',
  is_published boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (category_id, title),
  constraint atlas_entries_status_check check (status in ('draft', 'submitted', 'reviewed', 'published', 'archived'))
);

create table if not exists public.experiment_materials (
  experiment_id uuid references public.experiments(id) on delete cascade,
  material_id uuid references public.materials(id) on delete cascade,
  role text not null default 'sheet',
  primary key (experiment_id, material_id, role)
);

create table if not exists public.experiment_products (
  experiment_id uuid references public.experiments(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  role text not null default 'material',
  primary key (experiment_id, product_id, role)
);

create table if not exists public.experiment_equipment (
  experiment_id uuid references public.experiments(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete cascade,
  role text not null default 'equipment',
  primary key (experiment_id, equipment_id, role)
);

create table if not exists public.experiment_sources (
  experiment_id uuid references public.experiments(id) on delete cascade,
  source_id uuid references public.research_sources(id) on delete cascade,
  relationship text not null default 'precedent',
  primary key (experiment_id, source_id, relationship)
);

create table if not exists public.atlas_entry_sources (
  atlas_entry_id uuid references public.atlas_entries(id) on delete cascade,
  source_id uuid references public.research_sources(id) on delete cascade,
  primary key (atlas_entry_id, source_id)
);

create table if not exists public.atlas_entry_materials (
  atlas_entry_id uuid references public.atlas_entries(id) on delete cascade,
  material_id uuid references public.materials(id) on delete cascade,
  primary key (atlas_entry_id, material_id)
);

create table if not exists public.atlas_entry_experiments (
  atlas_entry_id uuid references public.atlas_entries(id) on delete cascade,
  experiment_id uuid references public.experiments(id) on delete cascade,
  primary key (atlas_entry_id, experiment_id)
);

create table if not exists public.atlas_entry_equipment (
  atlas_entry_id uuid references public.atlas_entries(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete cascade,
  primary key (atlas_entry_id, equipment_id)
);

-- General library media uses entity_type/entity_id instead of polymorphic foreign keys.
-- PostgreSQL cannot enforce one foreign key across multiple target tables cleanly, so RLS
-- and application code must validate supported entity types.
create table if not exists public.library_media (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  storage_path text,
  external_url text,
  media_type text,
  caption text,
  credit text,
  source_url text,
  display_order integer default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Public vendor access is intentionally exposed through a narrow view instead of
-- granting anonymous SELECT on vendors, which contains private contact fields.
create or replace view public.published_product_vendor_links as
select
  p.id as product_id,
  p.product_name,
  p.product_url,
  p.vendor_id,
  v.name as vendor_name,
  v.website_url as vendor_website_url
from public.products p
join public.vendors v on v.id = p.vendor_id
where p.is_active = true
  and v.is_active = true
  and (p.status = 'published' or p.is_published = true);

grant select on public.published_product_vendor_links to anon, authenticated;

drop trigger if exists trg_materials_updated on public.materials;
create trigger trg_materials_updated
before update on public.materials
for each row execute function public.set_updated_at();

drop trigger if exists trg_vendors_updated on public.vendors;
create trigger trg_vendors_updated
before update on public.vendors
for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists trg_equipment_updated on public.equipment;
create trigger trg_equipment_updated
before update on public.equipment
for each row execute function public.set_updated_at();

drop trigger if exists trg_research_sources_updated on public.research_sources;
create trigger trg_research_sources_updated
before update on public.research_sources
for each row execute function public.set_updated_at();

drop trigger if exists trg_atlas_categories_updated on public.atlas_categories;
create trigger trg_atlas_categories_updated
before update on public.atlas_categories
for each row execute function public.set_updated_at();

drop trigger if exists trg_atlas_entries_updated on public.atlas_entries;
create trigger trg_atlas_entries_updated
before update on public.atlas_entries
for each row execute function public.set_updated_at();

alter table public.taxonomy_terms enable row level security;
alter table public.materials enable row level security;
alter table public.vendors enable row level security;
alter table public.products enable row level security;
alter table public.product_purchases enable row level security;
alter table public.equipment enable row level security;
alter table public.atlas_categories enable row level security;
alter table public.atlas_entries enable row level security;
alter table public.experiment_materials enable row level security;
alter table public.experiment_products enable row level security;
alter table public.experiment_equipment enable row level security;
alter table public.experiment_sources enable row level security;
alter table public.atlas_entry_sources enable row level security;
alter table public.atlas_entry_materials enable row level security;
alter table public.atlas_entry_experiments enable row level security;
alter table public.atlas_entry_equipment enable row level security;
alter table public.library_media enable row level security;

drop policy if exists "taxonomy terms published read" on public.taxonomy_terms;
create policy "taxonomy terms published read"
on public.taxonomy_terms for select
to anon, authenticated
using (is_active = true);

drop policy if exists "admins manage taxonomy terms" on public.taxonomy_terms;
create policy "admins manage taxonomy terms"
on public.taxonomy_terms for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "materials public read published" on public.materials;
create policy "materials public read published"
on public.materials for select
to anon, authenticated
using (status = 'published' or is_published = true or public.is_admin() or (created_by = auth.uid() and public.is_active_user()));

drop policy if exists "materials contributors create" on public.materials;
create policy "materials contributors create"
on public.materials for insert
to authenticated
with check (public.is_active_user() and created_by = auth.uid() and status in ('draft', 'submitted') and is_published = false);

drop policy if exists "materials contributors update own" on public.materials;
create policy "materials contributors update own"
on public.materials for update
to authenticated
using (public.is_admin() or (created_by = auth.uid() and public.is_active_user() and status in ('draft', 'submitted')))
with check (public.is_admin() or (created_by = auth.uid() and public.is_active_user() and status in ('draft', 'submitted') and is_published = false));

drop policy if exists "materials admins manage" on public.materials;
create policy "materials admins manage"
on public.materials for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "vendors authenticated read" on public.vendors;
create policy "vendors authenticated read"
on public.vendors for select
to authenticated
using (public.is_admin() or created_by = auth.uid() or public.is_active_user());

drop policy if exists "vendors contributors create" on public.vendors;
create policy "vendors contributors create"
on public.vendors for insert
to authenticated
with check (public.is_active_user() and created_by = auth.uid());

drop policy if exists "vendors contributors update own" on public.vendors;
create policy "vendors contributors update own"
on public.vendors for update
to authenticated
using (public.is_admin() or (created_by = auth.uid() and public.is_active_user()))
with check (public.is_admin() or (created_by = auth.uid() and public.is_active_user()));

drop policy if exists "vendors admins manage" on public.vendors;
create policy "vendors admins manage"
on public.vendors for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "products public read published" on public.products;
create policy "products public read published"
on public.products for select
to anon, authenticated
using (status = 'published' or is_published = true or public.is_admin() or (created_by = auth.uid() and public.is_active_user()));

drop policy if exists "products contributors create" on public.products;
create policy "products contributors create"
on public.products for insert
to authenticated
with check (public.is_active_user() and created_by = auth.uid() and status in ('draft', 'submitted') and is_published = false);

drop policy if exists "products contributors update own" on public.products;
create policy "products contributors update own"
on public.products for update
to authenticated
using (public.is_admin() or (created_by = auth.uid() and public.is_active_user() and status in ('draft', 'submitted')))
with check (public.is_admin() or (created_by = auth.uid() and public.is_active_user() and status in ('draft', 'submitted') and is_published = false));

drop policy if exists "products admins manage" on public.products;
create policy "products admins manage"
on public.products for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "product purchases authenticated read" on public.product_purchases;
create policy "product purchases authenticated read"
on public.product_purchases for select
to authenticated
using (public.is_admin() or purchased_by = auth.uid() or public.is_active_user());

drop policy if exists "product purchases contributors create" on public.product_purchases;
create policy "product purchases contributors create"
on public.product_purchases for insert
to authenticated
with check (public.is_active_user() and purchased_by = auth.uid());

drop policy if exists "product purchases admins manage" on public.product_purchases;
create policy "product purchases admins manage"
on public.product_purchases for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "equipment public read published" on public.equipment;
create policy "equipment public read published"
on public.equipment for select
to anon, authenticated
using (status = 'published' or is_published = true or public.is_admin() or (created_by = auth.uid() and public.is_active_user()));

drop policy if exists "equipment contributors create" on public.equipment;
create policy "equipment contributors create"
on public.equipment for insert
to authenticated
with check (public.is_active_user() and created_by = auth.uid() and status in ('draft', 'submitted') and is_published = false);

drop policy if exists "equipment contributors update own" on public.equipment;
create policy "equipment contributors update own"
on public.equipment for update
to authenticated
using (public.is_admin() or (created_by = auth.uid() and public.is_active_user() and status in ('draft', 'submitted')))
with check (public.is_admin() or (created_by = auth.uid() and public.is_active_user() and status in ('draft', 'submitted') and is_published = false));

drop policy if exists "equipment admins manage" on public.equipment;
create policy "equipment admins manage"
on public.equipment for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "published research sources public" on public.research_sources;
create policy "published research sources public"
on public.research_sources for select
to anon, authenticated
using (
  public.is_admin()
  or status = 'published'
  or (is_published = true and status <> 'archived')
);

drop policy if exists "research sources contributors read own" on public.research_sources;
create policy "research sources contributors read own"
on public.research_sources for select
to authenticated
using (public.is_admin() or (added_by = auth.uid() and public.is_active_user()));

drop policy if exists "research sources contributors create" on public.research_sources;
create policy "research sources contributors create"
on public.research_sources for insert
to authenticated
with check (public.is_active_user() and added_by = auth.uid() and status in ('draft', 'submitted') and is_published = false);

drop policy if exists "research sources contributors update own" on public.research_sources;
create policy "research sources contributors update own"
on public.research_sources for update
to authenticated
using (public.is_admin() or (added_by = auth.uid() and public.is_active_user() and status in ('draft', 'submitted')))
with check (public.is_admin() or (added_by = auth.uid() and public.is_active_user() and status in ('draft', 'submitted') and is_published = false));

drop policy if exists "atlas categories public read published" on public.atlas_categories;
create policy "atlas categories public read published"
on public.atlas_categories for select
to anon, authenticated
using (is_published = true or public.is_admin() or (created_by = auth.uid() and public.is_active_user()));

drop policy if exists "atlas categories admins manage" on public.atlas_categories;
create policy "atlas categories admins manage"
on public.atlas_categories for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "atlas entries public read published" on public.atlas_entries;
create policy "atlas entries public read published"
on public.atlas_entries for select
to anon, authenticated
using (status = 'published' or is_published = true or public.is_admin() or (created_by = auth.uid() and public.is_active_user()));

drop policy if exists "atlas entries contributors create" on public.atlas_entries;
create policy "atlas entries contributors create"
on public.atlas_entries for insert
to authenticated
with check (public.is_active_user() and created_by = auth.uid() and status in ('draft', 'submitted') and is_published = false);

drop policy if exists "atlas entries contributors update own" on public.atlas_entries;
create policy "atlas entries contributors update own"
on public.atlas_entries for update
to authenticated
using (public.is_admin() or (created_by = auth.uid() and public.is_active_user() and status in ('draft', 'submitted')))
with check (public.is_admin() or (created_by = auth.uid() and public.is_active_user() and status in ('draft', 'submitted') and is_published = false));

drop policy if exists "atlas entries admins manage" on public.atlas_entries;
create policy "atlas entries admins manage"
on public.atlas_entries for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "library media authenticated read own" on public.library_media;
drop policy if exists "library media public read parent published" on public.library_media;
create policy "library media public read parent published"
on public.library_media for select
to anon, authenticated
using (
  public.is_admin()
  or (
    entity_type = 'research_source'
    and exists (
      select 1 from public.research_sources rs
      where rs.id = entity_id
        and (rs.status = 'published' or (rs.is_published = true and rs.status <> 'archived'))
    )
  )
  or (
    entity_type = 'material'
    and exists (
      select 1 from public.materials m
      where m.id = entity_id
        and (m.status = 'published' or m.is_published = true)
    )
  )
  or (
    entity_type = 'product'
    and exists (
      select 1 from public.products p
      where p.id = entity_id
        and (p.status = 'published' or p.is_published = true)
    )
  )
  or (
    entity_type = 'equipment'
    and exists (
      select 1 from public.equipment e
      where e.id = entity_id
        and (e.status = 'published' or e.is_published = true)
    )
  )
  or (
    entity_type = 'atlas_entry'
    and exists (
      select 1 from public.atlas_entries ae
      where ae.id = entity_id
        and (ae.status = 'published' or ae.is_published = true)
    )
  )
);

drop policy if exists "library media contributors read own parent" on public.library_media;
create policy "library media contributors read own parent"
on public.library_media for select
to authenticated
using (
  public.is_admin()
  or (
    created_by = auth.uid()
    and public.is_active_user()
    and (
      (
        entity_type = 'research_source'
        and exists (select 1 from public.research_sources rs where rs.id = entity_id and rs.added_by = auth.uid())
      )
      or (
        entity_type = 'material'
        and exists (select 1 from public.materials m where m.id = entity_id and m.created_by = auth.uid())
      )
      or (
        entity_type = 'product'
        and exists (select 1 from public.products p where p.id = entity_id and p.created_by = auth.uid())
      )
      or (
        entity_type = 'equipment'
        and exists (select 1 from public.equipment e where e.id = entity_id and e.created_by = auth.uid())
      )
      or (
        entity_type = 'atlas_entry'
        and exists (select 1 from public.atlas_entries ae where ae.id = entity_id and ae.created_by = auth.uid())
      )
    )
  )
);

drop policy if exists "library media contributors create" on public.library_media;
create policy "library media contributors create"
on public.library_media for insert
to authenticated
with check (
  public.is_admin()
  or (
    created_by = auth.uid()
    and public.is_active_user()
    and (
      (
        entity_type = 'research_source'
        and exists (
          select 1 from public.research_sources rs
          where rs.id = entity_id
            and rs.added_by = auth.uid()
            and rs.status in ('draft', 'submitted')
        )
      )
      or (
        entity_type = 'material'
        and exists (
          select 1 from public.materials m
          where m.id = entity_id
            and m.created_by = auth.uid()
            and m.status in ('draft', 'submitted')
        )
      )
      or (
        entity_type = 'product'
        and exists (
          select 1 from public.products p
          where p.id = entity_id
            and p.created_by = auth.uid()
            and p.status in ('draft', 'submitted')
        )
      )
      or (
        entity_type = 'equipment'
        and exists (
          select 1 from public.equipment e
          where e.id = entity_id
            and e.created_by = auth.uid()
            and e.status in ('draft', 'submitted')
        )
      )
      or (
        entity_type = 'atlas_entry'
        and exists (
          select 1 from public.atlas_entries ae
          where ae.id = entity_id
            and ae.created_by = auth.uid()
            and ae.status in ('draft', 'submitted')
        )
      )
    )
  )
);

drop policy if exists "library media contributors update own" on public.library_media;
create policy "library media contributors update own"
on public.library_media for update
to authenticated
using (
  public.is_admin()
  or (
    created_by = auth.uid()
    and public.is_active_user()
    and (
      (
        entity_type = 'research_source'
        and exists (select 1 from public.research_sources rs where rs.id = entity_id and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted'))
      )
      or (
        entity_type = 'material'
        and exists (select 1 from public.materials m where m.id = entity_id and m.created_by = auth.uid() and m.status in ('draft', 'submitted'))
      )
      or (
        entity_type = 'product'
        and exists (select 1 from public.products p where p.id = entity_id and p.created_by = auth.uid() and p.status in ('draft', 'submitted'))
      )
      or (
        entity_type = 'equipment'
        and exists (select 1 from public.equipment e where e.id = entity_id and e.created_by = auth.uid() and e.status in ('draft', 'submitted'))
      )
      or (
        entity_type = 'atlas_entry'
        and exists (select 1 from public.atlas_entries ae where ae.id = entity_id and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted'))
      )
    )
  )
)
with check (
  public.is_admin()
  or (
    created_by = auth.uid()
    and public.is_active_user()
    and (
      (
        entity_type = 'research_source'
        and exists (select 1 from public.research_sources rs where rs.id = entity_id and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted'))
      )
      or (
        entity_type = 'material'
        and exists (select 1 from public.materials m where m.id = entity_id and m.created_by = auth.uid() and m.status in ('draft', 'submitted'))
      )
      or (
        entity_type = 'product'
        and exists (select 1 from public.products p where p.id = entity_id and p.created_by = auth.uid() and p.status in ('draft', 'submitted'))
      )
      or (
        entity_type = 'equipment'
        and exists (select 1 from public.equipment e where e.id = entity_id and e.created_by = auth.uid() and e.status in ('draft', 'submitted'))
      )
      or (
        entity_type = 'atlas_entry'
        and exists (select 1 from public.atlas_entries ae where ae.id = entity_id and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted'))
      )
    )
  )
);

drop policy if exists "library media contributors delete own" on public.library_media;
create policy "library media contributors delete own"
on public.library_media for delete
to authenticated
using (
  public.is_admin()
  or (
    created_by = auth.uid()
    and public.is_active_user()
    and (
      (
        entity_type = 'research_source'
        and exists (select 1 from public.research_sources rs where rs.id = entity_id and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted'))
      )
      or (
        entity_type = 'material'
        and exists (select 1 from public.materials m where m.id = entity_id and m.created_by = auth.uid() and m.status in ('draft', 'submitted'))
      )
      or (
        entity_type = 'product'
        and exists (select 1 from public.products p where p.id = entity_id and p.created_by = auth.uid() and p.status in ('draft', 'submitted'))
      )
      or (
        entity_type = 'equipment'
        and exists (select 1 from public.equipment e where e.id = entity_id and e.created_by = auth.uid() and e.status in ('draft', 'submitted'))
      )
      or (
        entity_type = 'atlas_entry'
        and exists (select 1 from public.atlas_entries ae where ae.id = entity_id and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted'))
      )
    )
  )
);

drop policy if exists "library media admins manage" on public.library_media;
create policy "library media admins manage"
on public.library_media for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "experiment material links visible" on public.experiment_materials;
create policy "experiment material links visible"
on public.experiment_materials for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.experiments e
    where e.id = experiment_id
      and e.researcher_id = auth.uid()
  )
  or (
    exists (select 1 from public.experiments e where e.id = experiment_id and e.status = 'published')
    and exists (select 1 from public.materials m where m.id = material_id and (m.status = 'published' or m.is_published = true))
  )
);

drop policy if exists "experiment material links manage" on public.experiment_materials;
create policy "experiment material links manage"
on public.experiment_materials for all
to authenticated
using (public.is_admin() or exists (
  select 1 from public.experiments e
  where e.id = experiment_id
    and e.researcher_id = auth.uid()
    and public.is_active_user()
    and e.status in ('draft', 'submitted')
))
with check (public.is_admin() or exists (
  select 1 from public.experiments e
  where e.id = experiment_id
    and e.researcher_id = auth.uid()
    and public.is_active_user()
    and e.status in ('draft', 'submitted')
));

drop policy if exists "experiment product links visible" on public.experiment_products;
create policy "experiment product links visible"
on public.experiment_products for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.experiments e
    where e.id = experiment_id
      and e.researcher_id = auth.uid()
  )
  or (
    exists (select 1 from public.experiments e where e.id = experiment_id and e.status = 'published')
    and exists (select 1 from public.products p where p.id = product_id and (p.status = 'published' or p.is_published = true))
  )
);

drop policy if exists "experiment product links manage" on public.experiment_products;
create policy "experiment product links manage"
on public.experiment_products for all
to authenticated
using (public.is_admin() or exists (
  select 1 from public.experiments e
  where e.id = experiment_id
    and e.researcher_id = auth.uid()
    and public.is_active_user()
    and e.status in ('draft', 'submitted')
))
with check (public.is_admin() or exists (
  select 1 from public.experiments e
  where e.id = experiment_id
    and e.researcher_id = auth.uid()
    and public.is_active_user()
    and e.status in ('draft', 'submitted')
));

drop policy if exists "experiment equipment links visible" on public.experiment_equipment;
create policy "experiment equipment links visible"
on public.experiment_equipment for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.experiments e
    where e.id = experiment_id
      and e.researcher_id = auth.uid()
  )
  or (
    exists (select 1 from public.experiments e where e.id = experiment_id and e.status = 'published')
    and exists (select 1 from public.equipment eq where eq.id = equipment_id and (eq.status = 'published' or eq.is_published = true))
  )
);

drop policy if exists "experiment equipment links manage" on public.experiment_equipment;
create policy "experiment equipment links manage"
on public.experiment_equipment for all
to authenticated
using (public.is_admin() or exists (
  select 1 from public.experiments e
  where e.id = experiment_id
    and e.researcher_id = auth.uid()
    and public.is_active_user()
    and e.status in ('draft', 'submitted')
))
with check (public.is_admin() or exists (
  select 1 from public.experiments e
  where e.id = experiment_id
    and e.researcher_id = auth.uid()
    and public.is_active_user()
    and e.status in ('draft', 'submitted')
));

drop policy if exists "experiment source links visible" on public.experiment_sources;
create policy "experiment source links visible"
on public.experiment_sources for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.experiments e
    where e.id = experiment_id
      and e.researcher_id = auth.uid()
  )
  or (
    exists (select 1 from public.experiments e where e.id = experiment_id and e.status = 'published')
    and exists (
      select 1 from public.research_sources rs
      where rs.id = source_id
        and (rs.status = 'published' or (rs.is_published = true and rs.status <> 'archived'))
    )
  )
);

drop policy if exists "experiment source links manage" on public.experiment_sources;
create policy "experiment source links manage"
on public.experiment_sources for all
to authenticated
using (public.is_admin() or exists (
  select 1 from public.experiments e
  where e.id = experiment_id
    and e.researcher_id = auth.uid()
    and public.is_active_user()
    and e.status in ('draft', 'submitted')
))
with check (public.is_admin() or exists (
  select 1 from public.experiments e
  where e.id = experiment_id
    and e.researcher_id = auth.uid()
    and public.is_active_user()
    and e.status in ('draft', 'submitted')
));

drop policy if exists "atlas source links visible" on public.atlas_entry_sources;
create policy "atlas source links visible"
on public.atlas_entry_sources for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.atlas_entries ae
    where ae.id = atlas_entry_id
      and ae.created_by = auth.uid()
      and public.is_active_user()
  )
  or (
    exists (select 1 from public.atlas_entries ae where ae.id = atlas_entry_id and (ae.status = 'published' or ae.is_published = true))
    and exists (
      select 1 from public.research_sources rs
      where rs.id = source_id
        and (rs.status = 'published' or (rs.is_published = true and rs.status <> 'archived'))
    )
  )
);

drop policy if exists "atlas material links visible" on public.atlas_entry_materials;
create policy "atlas material links visible"
on public.atlas_entry_materials for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.atlas_entries ae
    where ae.id = atlas_entry_id
      and ae.created_by = auth.uid()
      and public.is_active_user()
  )
  or (
    exists (select 1 from public.atlas_entries ae where ae.id = atlas_entry_id and (ae.status = 'published' or ae.is_published = true))
    and exists (select 1 from public.materials m where m.id = material_id and (m.status = 'published' or m.is_published = true))
  )
);

drop policy if exists "atlas experiment links visible" on public.atlas_entry_experiments;
create policy "atlas experiment links visible"
on public.atlas_entry_experiments for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.atlas_entries ae
    where ae.id = atlas_entry_id
      and ae.created_by = auth.uid()
      and public.is_active_user()
  )
  or (
    exists (select 1 from public.atlas_entries ae where ae.id = atlas_entry_id and (ae.status = 'published' or ae.is_published = true))
    and exists (select 1 from public.experiments e where e.id = experiment_id and e.status = 'published')
  )
);

drop policy if exists "atlas equipment links visible" on public.atlas_entry_equipment;
create policy "atlas equipment links visible"
on public.atlas_entry_equipment for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.atlas_entries ae
    where ae.id = atlas_entry_id
      and ae.created_by = auth.uid()
      and public.is_active_user()
  )
  or (
    exists (select 1 from public.atlas_entries ae where ae.id = atlas_entry_id and (ae.status = 'published' or ae.is_published = true))
    and exists (select 1 from public.equipment eq where eq.id = equipment_id and (eq.status = 'published' or eq.is_published = true))
  )
);

drop policy if exists "atlas source links manage" on public.atlas_entry_sources;
create policy "atlas source links manage"
on public.atlas_entry_sources for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "atlas source links contributors create" on public.atlas_entry_sources;
create policy "atlas source links contributors create"
on public.atlas_entry_sources for insert
to authenticated
with check (exists (
  select 1 from public.atlas_entries ae
  where ae.id = atlas_entry_id
    and ae.created_by = auth.uid()
    and public.is_active_user()
    and ae.status in ('draft', 'submitted')
));

drop policy if exists "atlas source links contributors delete" on public.atlas_entry_sources;
create policy "atlas source links contributors delete"
on public.atlas_entry_sources for delete
to authenticated
using (exists (
  select 1 from public.atlas_entries ae
  where ae.id = atlas_entry_id
    and ae.created_by = auth.uid()
    and public.is_active_user()
    and ae.status in ('draft', 'submitted')
));

drop policy if exists "atlas material links manage" on public.atlas_entry_materials;
create policy "atlas material links manage"
on public.atlas_entry_materials for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "atlas material links contributors create" on public.atlas_entry_materials;
create policy "atlas material links contributors create"
on public.atlas_entry_materials for insert
to authenticated
with check (exists (
  select 1 from public.atlas_entries ae
  where ae.id = atlas_entry_id
    and ae.created_by = auth.uid()
    and public.is_active_user()
    and ae.status in ('draft', 'submitted')
));

drop policy if exists "atlas material links contributors delete" on public.atlas_entry_materials;
create policy "atlas material links contributors delete"
on public.atlas_entry_materials for delete
to authenticated
using (exists (
  select 1 from public.atlas_entries ae
  where ae.id = atlas_entry_id
    and ae.created_by = auth.uid()
    and public.is_active_user()
    and ae.status in ('draft', 'submitted')
));

drop policy if exists "atlas experiment links manage" on public.atlas_entry_experiments;
create policy "atlas experiment links manage"
on public.atlas_entry_experiments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "atlas experiment links contributors create" on public.atlas_entry_experiments;
create policy "atlas experiment links contributors create"
on public.atlas_entry_experiments for insert
to authenticated
with check (exists (
  select 1 from public.atlas_entries ae
  where ae.id = atlas_entry_id
    and ae.created_by = auth.uid()
    and public.is_active_user()
    and ae.status in ('draft', 'submitted')
));

drop policy if exists "atlas experiment links contributors delete" on public.atlas_entry_experiments;
create policy "atlas experiment links contributors delete"
on public.atlas_entry_experiments for delete
to authenticated
using (exists (
  select 1 from public.atlas_entries ae
  where ae.id = atlas_entry_id
    and ae.created_by = auth.uid()
    and public.is_active_user()
    and ae.status in ('draft', 'submitted')
));

drop policy if exists "atlas equipment links manage" on public.atlas_entry_equipment;
create policy "atlas equipment links manage"
on public.atlas_entry_equipment for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "atlas equipment links contributors create" on public.atlas_entry_equipment;
create policy "atlas equipment links contributors create"
on public.atlas_entry_equipment for insert
to authenticated
with check (exists (
  select 1 from public.atlas_entries ae
  where ae.id = atlas_entry_id
    and ae.created_by = auth.uid()
    and public.is_active_user()
    and ae.status in ('draft', 'submitted')
));

drop policy if exists "atlas equipment links contributors delete" on public.atlas_entry_equipment;
create policy "atlas equipment links contributors delete"
on public.atlas_entry_equipment for delete
to authenticated
using (exists (
  select 1 from public.atlas_entries ae
  where ae.id = atlas_entry_id
    and ae.created_by = auth.uid()
    and public.is_active_user()
    and ae.status in ('draft', 'submitted')
));

insert into public.taxonomy_terms (taxonomy_type, name, slug, sort_order)
values
  ('forming_method', 'Rigid tooling', 'rigid-tooling', 10),
  ('forming_method', 'Compliant tooling', 'compliant-tooling', 20),
  ('forming_method', 'Sequential / multi-stage forming', 'sequential-multi-stage-forming', 30),
  ('forming_operation', 'Pre-form', 'pre-form', 10),
  ('forming_operation', 'Draw', 'draw', 20),
  ('forming_operation', 'Emboss', 'emboss', 30),
  ('forming_operation', 'Return', 'return', 40),
  ('forming_operation', 'Undercut', 'undercut', 50),
  ('geometry_type', 'Re-entrant form', 're-entrant-form', 10),
  ('undercut_type', 'Undercut', 'undercut', 10),
  ('observed_behavior', 'Material flow', 'material-flow', 10),
  ('observed_behavior', 'Springback', 'springback', 20),
  ('observed_behavior', 'Wrinkling', 'wrinkling', 30),
  ('observed_behavior', 'Thinning', 'thinning', 40),
  ('observed_behavior', 'Tearing', 'tearing', 50),
  ('observed_behavior', 'Tool deformation', 'tool-deformation', 60),
  ('tool_system', 'PLA rigid tools', 'pla-rigid-tools', 10),
  ('tool_system', 'TPU compliant tools', 'tpu-compliant-tools', 20),
  ('tool_system', 'Hybrid rigid + soft tools', 'hybrid-rigid-soft-tools', 30),
  ('constraint_type', 'Confinement / side restraint', 'confinement-side-restraint', 10),
  ('measurement_method', 'Manual measurement', 'manual-measurement', 10),
  ('material_family', 'Thin metal', 'thin-metal', 10),
  ('material_family', 'Aluminum', 'aluminum', 20),
  ('material_family', 'Paper / sheet fiber', 'paper-sheet-fiber', 30)
on conflict (taxonomy_type, name) do update
set slug = excluded.slug,
    sort_order = excluded.sort_order,
    is_active = true;

insert into public.atlas_categories (code, title, slug, sort_order, is_published)
values
  ('01', 'Forming Methods', 'forming-methods', 10, true),
  ('02', 'Materials', 'materials', 20, true),
  ('03', 'Tool Systems', 'tool-systems', 30, true),
  ('04', 'Geometric Operations', 'geometric-operations', 40, true),
  ('05', 'Observed Behaviors', 'observed-behaviors', 50, true),
  ('06', 'Research Sources', 'research-sources', 60, true)
on conflict (slug) do update
set code = excluded.code,
    title = excluded.title,
    sort_order = excluded.sort_order,
    is_published = true,
    updated_at = now();

with seed_entries(category_slug, title, slug, sort_order) as (
  values
    ('forming-methods', 'Rigid tooling', 'rigid-tooling', 10),
    ('forming-methods', 'Compliant tooling', 'compliant-tooling', 20),
    ('forming-methods', 'Sequential / multi-stage forming', 'sequential-multi-stage-forming', 30),
    ('forming-methods', 'Localized deformation', 'localized-deformation', 40),
    ('forming-methods', 'Calibration / restrike', 'calibration-restrike', 50),
    ('materials', 'Thin metal', 'thin-metal', 10),
    ('materials', 'Aluminum', 'aluminum', 20),
    ('materials', 'Paper / sheet fiber', 'paper-sheet-fiber', 30),
    ('materials', 'Other test sheets', 'other-test-sheets', 40),
    ('tool-systems', 'PLA rigid tools', 'pla-rigid-tools', 10),
    ('tool-systems', 'TPU compliant tools', 'tpu-compliant-tools', 20),
    ('tool-systems', 'Hybrid rigid + soft tools', 'hybrid-rigid-soft-tools', 30),
    ('tool-systems', 'Printed internal compliance', 'printed-internal-compliance', 40),
    ('tool-systems', 'Confinement / side restraint', 'confinement-side-restraint', 50),
    ('geometric-operations', 'Pre-form', 'pre-form', 10),
    ('geometric-operations', 'Draw', 'draw', 20),
    ('geometric-operations', 'Emboss', 'emboss', 30),
    ('geometric-operations', 'Return', 'return', 40),
    ('geometric-operations', 'Re-entrant form', 're-entrant-form', 50),
    ('geometric-operations', 'Undercut', 'undercut', 60),
    ('geometric-operations', 'Calibration', 'calibration', 70),
    ('observed-behaviors', 'Material flow', 'material-flow', 10),
    ('observed-behaviors', 'Springback', 'springback', 20),
    ('observed-behaviors', 'Wrinkling', 'wrinkling', 30),
    ('observed-behaviors', 'Thinning', 'thinning', 40),
    ('observed-behaviors', 'Tearing', 'tearing', 50),
    ('observed-behaviors', 'Tool deformation', 'tool-deformation', 60),
    ('observed-behaviors', 'Surface marking', 'surface-marking', 70),
    ('research-sources', 'Historical forming precedents', 'historical-forming-precedents', 10),
    ('research-sources', 'Contemporary rapid tooling', 'contemporary-rapid-tooling', 20),
    ('research-sources', '3D-printed press tooling', '3d-printed-press-tooling', 30),
    ('research-sources', 'Material suppliers', 'material-suppliers', 40),
    ('research-sources', 'Videos / process demonstrations', 'videos-process-demonstrations', 50)
)
insert into public.atlas_entries (category_id, title, slug, sort_order, status, is_published)
select c.id, s.title, s.slug, s.sort_order, 'published', true
from seed_entries s
join public.atlas_categories c on c.slug = s.category_slug
on conflict (category_id, title) do update
set slug = excluded.slug,
    sort_order = excluded.sort_order,
    status = 'published',
    is_published = true,
    updated_at = now();

create index if not exists idx_taxonomy_terms_type_sort on public.taxonomy_terms (taxonomy_type, sort_order);
create index if not exists idx_taxonomy_terms_active on public.taxonomy_terms (is_active);
create index if not exists idx_materials_status on public.materials (status);
create index if not exists idx_materials_published on public.materials (is_published);
create index if not exists idx_materials_created_by on public.materials (created_by);
create index if not exists idx_vendors_active on public.vendors (is_active);
create index if not exists idx_vendors_created_by on public.vendors (created_by);
create index if not exists idx_products_material_id on public.products (material_id);
create index if not exists idx_products_vendor_id on public.products (vendor_id);
create index if not exists idx_products_status on public.products (status);
create index if not exists idx_products_published on public.products (is_published);
create index if not exists idx_products_created_by on public.products (created_by);
create index if not exists idx_product_purchases_product_id on public.product_purchases (product_id);
create index if not exists idx_product_purchases_purchased_by on public.product_purchases (purchased_by);
create index if not exists idx_equipment_status on public.equipment (status);
create index if not exists idx_equipment_published on public.equipment (is_published);
create index if not exists idx_equipment_created_by on public.equipment (created_by);
create index if not exists idx_research_sources_status on public.research_sources (status);
create index if not exists idx_research_sources_published on public.research_sources (is_published);
create index if not exists idx_research_sources_added_by on public.research_sources (added_by);
create index if not exists idx_atlas_categories_sort on public.atlas_categories (sort_order);
create index if not exists idx_atlas_categories_published on public.atlas_categories (is_published);
create index if not exists idx_atlas_entries_category_sort on public.atlas_entries (category_id, sort_order);
create index if not exists idx_atlas_entries_status on public.atlas_entries (status);
create index if not exists idx_atlas_entries_published on public.atlas_entries (is_published);
create index if not exists idx_atlas_entries_created_by on public.atlas_entries (created_by);
create index if not exists idx_experiment_materials_experiment on public.experiment_materials (experiment_id);
create index if not exists idx_experiment_materials_material on public.experiment_materials (material_id);
create index if not exists idx_experiment_products_experiment on public.experiment_products (experiment_id);
create index if not exists idx_experiment_products_product on public.experiment_products (product_id);
create index if not exists idx_experiment_equipment_experiment on public.experiment_equipment (experiment_id);
create index if not exists idx_experiment_equipment_equipment on public.experiment_equipment (equipment_id);
create index if not exists idx_experiment_sources_experiment on public.experiment_sources (experiment_id);
create index if not exists idx_experiment_sources_source on public.experiment_sources (source_id);
create index if not exists idx_atlas_entry_sources_entry on public.atlas_entry_sources (atlas_entry_id);
create index if not exists idx_atlas_entry_sources_source on public.atlas_entry_sources (source_id);
create index if not exists idx_atlas_entry_materials_entry on public.atlas_entry_materials (atlas_entry_id);
create index if not exists idx_atlas_entry_materials_material on public.atlas_entry_materials (material_id);
create index if not exists idx_atlas_entry_experiments_entry on public.atlas_entry_experiments (atlas_entry_id);
create index if not exists idx_atlas_entry_experiments_experiment on public.atlas_entry_experiments (experiment_id);
create index if not exists idx_atlas_entry_equipment_entry on public.atlas_entry_equipment (atlas_entry_id);
create index if not exists idx_atlas_entry_equipment_equipment on public.atlas_entry_equipment (equipment_id);
create index if not exists idx_library_media_entity on public.library_media (entity_type, entity_id, display_order);
create index if not exists idx_library_media_created_by on public.library_media (created_by);
