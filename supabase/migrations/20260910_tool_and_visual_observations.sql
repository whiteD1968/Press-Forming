-- Printed forming tools and visual experiment observations.
-- Additive migration for review. Do not run until manually approved.

create table if not exists public.forming_tools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tool_code text,
  description text,
  tool_type text,
  geometry_description text,
  geometry_file_url text,
  tool_material_id uuid references public.materials(id) on delete set null,
  tool_product_id uuid references public.products(id) on delete set null,
  fabrication_method text,
  printer_equipment_id uuid references public.equipment(id) on delete set null,
  created_by uuid references auth.users(id),
  status text not null default 'draft',
  visibility text not null default 'internal',
  is_published boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint forming_tools_status_check check (status in ('draft', 'submitted', 'reviewed', 'published', 'archived')),
  constraint forming_tools_visibility_check check (visibility in ('internal', 'public'))
);

create table if not exists public.forming_tool_print_settings (
  id uuid primary key default gen_random_uuid(),
  forming_tool_id uuid not null references public.forming_tools(id) on delete cascade,
  print_material_text text,
  material_id uuid references public.materials(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  printer_equipment_id uuid references public.equipment(id) on delete set null,
  slicer text,
  print_profile_name text,
  nozzle_diameter_mm numeric,
  nozzle_type text,
  layer_height_mm numeric,
  wall_count integer,
  top_shell_layers integer,
  bottom_shell_layers integer,
  infill_percent numeric,
  infill_pattern text,
  print_orientation text,
  support_enabled boolean,
  support_type text,
  support_interface_notes text,
  nozzle_temperature_c numeric,
  bed_temperature_c numeric,
  plate_type text,
  part_cooling_percent numeric,
  aux_fan_percent numeric,
  print_speed_notes text,
  estimated_print_time_minutes numeric,
  actual_print_time_minutes numeric,
  filament_used_g numeric,
  additional_settings text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.experiment_stage_tools (
  stage_id uuid not null references public.experiment_stages(id) on delete cascade,
  forming_tool_id uuid not null references public.forming_tools(id) on delete restrict,
  role text,
  created_at timestamptz default now(),
  primary key (stage_id, forming_tool_id, role)
);

create table if not exists public.experiment_observations (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  stage_id uuid references public.experiment_stages(id) on delete set null,
  observation_type text not null,
  severity text,
  location text,
  geometry_relationship text,
  description text,
  measurement_value numeric,
  measurement_unit text,
  cause_notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.experiment_observation_media (
  observation_id uuid not null references public.experiment_observations(id) on delete cascade,
  media_id uuid not null references public.experiment_media(id) on delete cascade,
  caption text,
  created_at timestamptz default now(),
  primary key (observation_id, media_id)
);

insert into public.taxonomy_terms (taxonomy_type, name, slug, sort_order)
values
  ('observation_type', 'Wrinkling', 'wrinkling', 10),
  ('observation_type', 'Creasing', 'creasing', 20),
  ('observation_type', 'Folding', 'folding', 30),
  ('observation_type', 'Buckling', 'buckling', 40),
  ('observation_type', 'Tearing', 'tearing', 50),
  ('observation_type', 'Cracking', 'cracking', 60),
  ('observation_type', 'Thinning', 'thinning', 70),
  ('observation_type', 'Necking', 'necking', 80),
  ('observation_type', 'Springback', 'springback', 90),
  ('observation_type', 'Surface Marking', 'surface-marking', 100),
  ('observation_type', 'Tool Imprint', 'tool-imprint', 110),
  ('observation_type', 'Material Slip', 'material-slip', 120),
  ('observation_type', 'Material Flow', 'material-flow', 130),
  ('observation_type', 'Local Stretching', 'local-stretching', 140),
  ('observation_type', 'Local Compression', 'local-compression', 150),
  ('observation_type', 'Undercut Formation', 'undercut-formation', 160),
  ('observation_type', 'Re-entrant Formation', 're-entrant-formation', 170),
  ('observation_type', 'Tool Deformation', 'tool-deformation', 180),
  ('observation_type', 'Tool Failure', 'tool-failure', 190),
  ('observation_type', 'Unexpected Behavior', 'unexpected-behavior', 200),
  ('observation_type', 'Other', 'other', 210)
on conflict (taxonomy_type, name) do nothing;

create index if not exists idx_forming_tools_status_visibility on public.forming_tools (status, visibility);
create index if not exists idx_forming_tools_created_by on public.forming_tools (created_by);
create index if not exists idx_forming_tool_print_settings_tool on public.forming_tool_print_settings (forming_tool_id);
create index if not exists idx_experiment_stage_tools_tool on public.experiment_stage_tools (forming_tool_id);
create index if not exists idx_experiment_observations_experiment on public.experiment_observations (experiment_id);
create index if not exists idx_experiment_observations_stage on public.experiment_observations (stage_id);
create index if not exists idx_experiment_observations_type on public.experiment_observations (observation_type);

drop trigger if exists trg_forming_tools_updated on public.forming_tools;
create trigger trg_forming_tools_updated
before update on public.forming_tools
for each row execute function public.set_updated_at();

drop trigger if exists trg_forming_tool_print_settings_updated on public.forming_tool_print_settings;
create trigger trg_forming_tool_print_settings_updated
before update on public.forming_tool_print_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_experiment_observations_updated on public.experiment_observations;
create trigger trg_experiment_observations_updated
before update on public.experiment_observations
for each row execute function public.set_updated_at();

drop trigger if exists trg_forming_tools_visibility_admin on public.forming_tools;
create trigger trg_forming_tools_visibility_admin
before insert or update on public.forming_tools
for each row execute function public.protect_visibility_admin();

create or replace function public.can_select_forming_tool(target_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.forming_tools ft
    where ft.id = target_id
      and (
        (ft.status = 'published' and ft.visibility = 'public')
        or (public.is_approved_user() and ft.status = 'published')
        or (public.is_approved_user() and ft.created_by = auth.uid())
      )
  );
$$;

create or replace function public.can_manage_experiment(target_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.experiments e
    where e.id = target_id
      and e.researcher_id = auth.uid()
      and public.is_approved_user()
      and e.status in ('draft', 'submitted')
  );
$$;

create or replace function public.can_manage_stage(target_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.experiment_stages s
    where s.id = target_id
      and public.can_manage_experiment(s.experiment_id)
  );
$$;

alter table public.forming_tools enable row level security;
alter table public.forming_tool_print_settings enable row level security;
alter table public.experiment_stage_tools enable row level security;
alter table public.experiment_observations enable row level security;
alter table public.experiment_observation_media enable row level security;

drop policy if exists "forming tools select by approved visibility" on public.forming_tools;
create policy "forming tools select by approved visibility"
on public.forming_tools for select
to anon, authenticated
using (public.can_select_forming_tool(id));

drop policy if exists "forming tools contributors create" on public.forming_tools;
create policy "forming tools contributors create"
on public.forming_tools for insert
to authenticated
with check (public.is_approved_user() and created_by = auth.uid() and status in ('draft', 'submitted') and is_published = false and visibility = 'internal');

drop policy if exists "forming tools contributors update own" on public.forming_tools;
create policy "forming tools contributors update own"
on public.forming_tools for update
to authenticated
using (public.is_admin() or (created_by = auth.uid() and public.is_approved_user() and status in ('draft', 'submitted')))
with check (public.is_admin() or (created_by = auth.uid() and public.is_approved_user() and status in ('draft', 'submitted') and is_published = false and visibility = 'internal'));

drop policy if exists "forming tool print settings visible with tool" on public.forming_tool_print_settings;
create policy "forming tool print settings visible with tool"
on public.forming_tool_print_settings for select
to anon, authenticated
using (public.can_select_forming_tool(forming_tool_id));

drop policy if exists "forming tool print settings manage with tool" on public.forming_tool_print_settings;
create policy "forming tool print settings manage with tool"
on public.forming_tool_print_settings for all
to authenticated
using (public.is_admin() or exists (select 1 from public.forming_tools ft where ft.id = forming_tool_id and ft.created_by = auth.uid() and public.is_approved_user() and ft.status in ('draft', 'submitted')))
with check (public.is_admin() or exists (select 1 from public.forming_tools ft where ft.id = forming_tool_id and ft.created_by = auth.uid() and public.is_approved_user() and ft.status in ('draft', 'submitted')));

drop policy if exists "stage tool links visible" on public.experiment_stage_tools;
create policy "stage tool links visible"
on public.experiment_stage_tools for select
to anon, authenticated
using (
  exists (
    select 1
    from public.experiment_stages s
    where s.id = stage_id
      and public.can_select_experiment(s.experiment_id)
  )
  and public.can_select_forming_tool(forming_tool_id)
);

drop policy if exists "stage tool links manage" on public.experiment_stage_tools;
create policy "stage tool links manage"
on public.experiment_stage_tools for all
to authenticated
using (public.can_manage_stage(stage_id))
with check (public.can_manage_stage(stage_id) and public.can_select_forming_tool(forming_tool_id));

drop policy if exists "experiment observations visible with experiment" on public.experiment_observations;
create policy "experiment observations visible with experiment"
on public.experiment_observations for select
to anon, authenticated
using (public.can_select_experiment(experiment_id));

drop policy if exists "experiment observations contributors create" on public.experiment_observations;
create policy "experiment observations contributors create"
on public.experiment_observations for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.can_manage_experiment(experiment_id)
  and (stage_id is null or exists (select 1 from public.experiment_stages s where s.id = stage_id and s.experiment_id = experiment_id))
);

drop policy if exists "experiment observations contributors update" on public.experiment_observations;
create policy "experiment observations contributors update"
on public.experiment_observations for update
to authenticated
using (public.can_manage_experiment(experiment_id))
with check (
  public.can_manage_experiment(experiment_id)
  and (stage_id is null or exists (select 1 from public.experiment_stages s where s.id = stage_id and s.experiment_id = experiment_id))
);

drop policy if exists "experiment observations contributors delete" on public.experiment_observations;
create policy "experiment observations contributors delete"
on public.experiment_observations for delete
to authenticated
using (public.can_manage_experiment(experiment_id));

drop policy if exists "observation media visible with observation" on public.experiment_observation_media;
create policy "observation media visible with observation"
on public.experiment_observation_media for select
to anon, authenticated
using (
  exists (
    select 1
    from public.experiment_observations o
    where o.id = observation_id
      and public.can_select_experiment(o.experiment_id)
  )
);

drop policy if exists "observation media manage with observation" on public.experiment_observation_media;
create policy "observation media manage with observation"
on public.experiment_observation_media for all
to authenticated
using (
  exists (
    select 1
    from public.experiment_observations o
    where o.id = observation_id
      and public.can_manage_experiment(o.experiment_id)
  )
)
with check (
  exists (
    select 1
    from public.experiment_observations o
    join public.experiment_media m on m.id = media_id and m.experiment_id = o.experiment_id
    where o.id = observation_id
      and public.can_manage_experiment(o.experiment_id)
  )
);

create or replace function public.can_select_library_media_parent(target_entity_type text, target_entity_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    (target_entity_type = 'research_source' and public.can_select_research_source(target_entity_id))
    or (target_entity_type = 'material' and public.can_select_material(target_entity_id))
    or (target_entity_type = 'product' and public.can_select_product(target_entity_id))
    or (target_entity_type = 'equipment' and public.can_select_equipment(target_entity_id))
    or (target_entity_type = 'atlas_entry' and public.can_select_atlas_entry(target_entity_id))
    or (target_entity_type = 'forming_tool' and public.can_select_forming_tool(target_entity_id));
$$;

create or replace function public.can_manage_library_media_parent(target_entity_type text, target_entity_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or (
      public.is_approved_user()
      and (
        (target_entity_type = 'research_source' and exists (select 1 from public.research_sources rs where rs.id = target_entity_id and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted')))
        or (target_entity_type = 'material' and exists (select 1 from public.materials m where m.id = target_entity_id and m.created_by = auth.uid() and m.status in ('draft', 'submitted')))
        or (target_entity_type = 'product' and exists (select 1 from public.products p where p.id = target_entity_id and p.created_by = auth.uid() and p.status in ('draft', 'submitted')))
        or (target_entity_type = 'equipment' and exists (select 1 from public.equipment e where e.id = target_entity_id and e.created_by = auth.uid() and e.status in ('draft', 'submitted')))
        or (target_entity_type = 'atlas_entry' and exists (select 1 from public.atlas_entries ae where ae.id = target_entity_id and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted')))
        or (target_entity_type = 'forming_tool' and exists (select 1 from public.forming_tools ft where ft.id = target_entity_id and ft.created_by = auth.uid() and ft.status in ('draft', 'submitted')))
      )
    );
$$;

drop policy if exists "library media select by approved visibility" on public.library_media;
create policy "library media select by approved visibility"
on public.library_media for select
to anon, authenticated
using (public.can_select_library_media_parent(entity_type, entity_id));

drop policy if exists "library media contributors create" on public.library_media;
create policy "library media contributors create"
on public.library_media for insert
to authenticated
with check (created_by = auth.uid() and public.can_manage_library_media_parent(entity_type, entity_id));

drop policy if exists "library media contributors update own" on public.library_media;
create policy "library media contributors update own"
on public.library_media for update
to authenticated
using (public.is_admin() or (created_by = auth.uid() and public.can_manage_library_media_parent(entity_type, entity_id)))
with check (public.is_admin() or (created_by = auth.uid() and public.can_manage_library_media_parent(entity_type, entity_id)));

drop policy if exists "library media contributors delete own" on public.library_media;
create policy "library media contributors delete own"
on public.library_media for delete
to authenticated
using (public.is_admin() or (created_by = auth.uid() and public.can_manage_library_media_parent(entity_type, entity_id)));

drop policy if exists "library media objects public read parent published" on storage.objects;
create policy "library media objects public read parent published"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'library-media'
  and (
    ((storage.foldername(name))[1] = 'research_source' and public.can_select_research_source(((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'material' and public.can_select_material(((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'product' and public.can_select_product(((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'equipment' and public.can_select_equipment(((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'atlas_entry' and public.can_select_atlas_entry(((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'forming_tool' and public.can_select_forming_tool(((storage.foldername(name))[2])::uuid))
  )
);

drop policy if exists "library media objects contributors upload" on storage.objects;
create policy "library media objects contributors upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'library-media'
  and (
    public.is_admin()
    or (
      public.is_approved_user()
      and (
        ((storage.foldername(name))[1] = 'research_source' and exists (select 1 from public.research_sources rs where rs.id::text = (storage.foldername(name))[2] and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'material' and exists (select 1 from public.materials m where m.id::text = (storage.foldername(name))[2] and m.created_by = auth.uid() and m.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'product' and exists (select 1 from public.products p where p.id::text = (storage.foldername(name))[2] and p.created_by = auth.uid() and p.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'equipment' and exists (select 1 from public.equipment e where e.id::text = (storage.foldername(name))[2] and e.created_by = auth.uid() and e.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'atlas_entry' and exists (select 1 from public.atlas_entries ae where ae.id::text = (storage.foldername(name))[2] and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'forming_tool' and exists (select 1 from public.forming_tools ft where ft.id::text = (storage.foldername(name))[2] and ft.created_by = auth.uid() and ft.status in ('draft', 'submitted')))
      )
    )
  )
);

drop policy if exists "library media objects contributors update" on storage.objects;
create policy "library media objects contributors update"
on storage.objects for update
to authenticated
using (bucket_id = 'library-media' and (
  public.is_admin()
  or (public.is_approved_user() and (
    ((storage.foldername(name))[1] = 'research_source' and exists (select 1 from public.research_sources rs where rs.id::text = (storage.foldername(name))[2] and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'material' and exists (select 1 from public.materials m where m.id::text = (storage.foldername(name))[2] and m.created_by = auth.uid() and m.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'product' and exists (select 1 from public.products p where p.id::text = (storage.foldername(name))[2] and p.created_by = auth.uid() and p.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'equipment' and exists (select 1 from public.equipment e where e.id::text = (storage.foldername(name))[2] and e.created_by = auth.uid() and e.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'atlas_entry' and exists (select 1 from public.atlas_entries ae where ae.id::text = (storage.foldername(name))[2] and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'forming_tool' and exists (select 1 from public.forming_tools ft where ft.id::text = (storage.foldername(name))[2] and ft.created_by = auth.uid() and ft.status in ('draft', 'submitted')))
  ))
))
with check (bucket_id = 'library-media');

drop policy if exists "library media objects contributors delete" on storage.objects;
create policy "library media objects contributors delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'library-media' and (
  public.is_admin()
  or (public.is_approved_user() and (
    ((storage.foldername(name))[1] = 'research_source' and exists (select 1 from public.research_sources rs where rs.id::text = (storage.foldername(name))[2] and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'material' and exists (select 1 from public.materials m where m.id::text = (storage.foldername(name))[2] and m.created_by = auth.uid() and m.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'product' and exists (select 1 from public.products p where p.id::text = (storage.foldername(name))[2] and p.created_by = auth.uid() and p.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'equipment' and exists (select 1 from public.equipment e where e.id::text = (storage.foldername(name))[2] and e.created_by = auth.uid() and e.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'atlas_entry' and exists (select 1 from public.atlas_entries ae where ae.id::text = (storage.foldername(name))[2] and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'forming_tool' and exists (select 1 from public.forming_tools ft where ft.id::text = (storage.foldername(name))[2] and ft.created_by = auth.uid() and ft.status in ('draft', 'submitted')))
  ))
));
