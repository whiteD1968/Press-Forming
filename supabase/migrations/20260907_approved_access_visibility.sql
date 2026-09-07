-- Approved access and deliberate public visibility.
-- Additive migration for review. Do not run until manually approved.

alter table public.profiles
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approval_requested_at timestamptz not null default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists access_request_note text,
  add column if not exists affiliation text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_approval_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_approval_status_check
      check (approval_status in ('pending', 'approved', 'rejected'));
  end if;
end;
$$;

update public.profiles
set approval_status = 'approved',
    approved_at = coalesce(approved_at, now())
where approval_status = 'pending';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    affiliation,
    role,
    approval_status,
    approval_requested_at,
    access_request_note,
    is_active
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'affiliation', ''),
    'student',
    'pending',
    now(),
    coalesce(new.raw_user_meta_data->>'access_request_note', ''),
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
        affiliation = coalesce(nullif(public.profiles.affiliation, ''), excluded.affiliation),
        updated_at = now();
  return new;
end;
$$;

create or replace function public.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and approval_status = 'approved'
      and is_active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and approval_status = 'approved'
      and is_active = true
  );
$$;

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
    or new.is_active is distinct from old.is_active
    or new.approval_status is distinct from old.approval_status
    or new.approved_at is distinct from old.approved_at
    or new.approved_by is distinct from old.approved_by
    or new.rejected_at is distinct from old.rejected_at
    or new.rejection_reason is distinct from old.rejection_reason then
    if not public.is_admin() then
      raise exception 'Only administrators can change access approval fields';
    end if;

    if auth.uid() = old.id and (
      new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.approval_status is distinct from old.approval_status
    ) then
      raise exception 'Administrators cannot change their own role or approval status here';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_role on public.profiles;
drop trigger if exists trg_protect_profile_admin_fields on public.profiles;
create trigger trg_protect_profile_admin_fields
before update on public.profiles
for each row execute function public.protect_profile_admin_fields();

drop policy if exists "profiles read authenticated" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles update own permitted fields" on public.profiles;
create policy "profiles update own permitted fields"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

alter table public.experiments add column if not exists visibility text not null default 'internal';
alter table public.research_sources add column if not exists visibility text not null default 'internal';
alter table public.materials add column if not exists visibility text not null default 'internal';
alter table public.products add column if not exists visibility text not null default 'internal';
alter table public.equipment add column if not exists visibility text not null default 'internal';
alter table public.atlas_entries add column if not exists visibility text not null default 'internal';
alter table public.atlas_categories add column if not exists visibility text not null default 'internal';

do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('experiments', 'experiments_visibility_check'),
      ('research_sources', 'research_sources_visibility_check'),
      ('materials', 'materials_visibility_check'),
      ('products', 'products_visibility_check'),
      ('equipment', 'equipment_visibility_check'),
      ('atlas_entries', 'atlas_entries_visibility_check'),
      ('atlas_categories', 'atlas_categories_visibility_check')
    ) as v(table_name, constraint_name)
  loop
    if not exists (
      select 1 from pg_constraint
      where conname = item.constraint_name
        and conrelid = ('public.' || item.table_name)::regclass
    ) then
      execute format('alter table public.%I add constraint %I check (visibility in (''internal'', ''public''))', item.table_name, item.constraint_name);
    end if;
  end loop;
end;
$$;

update public.experiments set visibility = 'internal';
update public.research_sources set visibility = 'internal';
update public.materials set visibility = 'internal';
update public.products set visibility = 'internal';
update public.equipment set visibility = 'internal';
update public.atlas_entries set visibility = 'internal';
update public.atlas_categories set visibility = 'internal';

create or replace function public.protect_visibility_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.visibility = 'public' and not public.is_admin() then
    raise exception 'Only administrators can create public records';
  end if;

  if tg_op = 'UPDATE' and new.visibility is distinct from old.visibility and not public.is_admin() then
    raise exception 'Only administrators can change visibility';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_experiments_visibility_admin on public.experiments;
create trigger trg_experiments_visibility_admin before insert or update on public.experiments for each row execute function public.protect_visibility_admin();
drop trigger if exists trg_research_sources_visibility_admin on public.research_sources;
create trigger trg_research_sources_visibility_admin before insert or update on public.research_sources for each row execute function public.protect_visibility_admin();
drop trigger if exists trg_materials_visibility_admin on public.materials;
create trigger trg_materials_visibility_admin before insert or update on public.materials for each row execute function public.protect_visibility_admin();
drop trigger if exists trg_products_visibility_admin on public.products;
create trigger trg_products_visibility_admin before insert or update on public.products for each row execute function public.protect_visibility_admin();
drop trigger if exists trg_equipment_visibility_admin on public.equipment;
create trigger trg_equipment_visibility_admin before insert or update on public.equipment for each row execute function public.protect_visibility_admin();
drop trigger if exists trg_atlas_entries_visibility_admin on public.atlas_entries;
create trigger trg_atlas_entries_visibility_admin before insert or update on public.atlas_entries for each row execute function public.protect_visibility_admin();
drop trigger if exists trg_atlas_categories_visibility_admin on public.atlas_categories;
create trigger trg_atlas_categories_visibility_admin before insert or update on public.atlas_categories for each row execute function public.protect_visibility_admin();

create or replace function public.can_select_experiment(target_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.experiments e
    where e.id = target_id
      and (
        (e.status = 'published' and (e.visibility = 'public' or public.is_approved_user()))
        or (public.is_approved_user() and e.researcher_id = auth.uid())
      )
  );
$$;

create or replace function public.can_select_research_source(target_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.research_sources rs
    where rs.id = target_id
      and (
        (rs.status = 'published' and rs.visibility = 'public')
        or (public.is_approved_user() and rs.status = 'published')
        or (public.is_approved_user() and rs.added_by = auth.uid())
      )
  );
$$;

create or replace function public.can_select_material(target_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.materials m
    where m.id = target_id
      and (
        (m.status = 'published' and m.visibility = 'public')
        or (public.is_approved_user() and m.status = 'published')
        or (public.is_approved_user() and m.created_by = auth.uid())
      )
  );
$$;

create or replace function public.can_select_product(target_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.products p
    where p.id = target_id
      and (
        (p.is_active = true and p.status = 'published' and p.visibility = 'public')
        or (p.is_active = true and public.is_approved_user() and p.status = 'published')
        or (public.is_approved_user() and p.created_by = auth.uid())
      )
  );
$$;

create or replace function public.can_select_equipment(target_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.equipment e
    where e.id = target_id
      and (
        (e.is_active = true and e.status = 'published' and e.visibility = 'public')
        or (e.is_active = true and public.is_approved_user() and e.status = 'published')
        or (public.is_approved_user() and e.created_by = auth.uid())
      )
  );
$$;

create or replace function public.can_select_atlas_entry(target_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.atlas_entries ae
    where ae.id = target_id
      and (
        (ae.status = 'published' and ae.visibility = 'public')
        or (public.is_approved_user() and ae.status = 'published')
        or (public.is_approved_user() and ae.created_by = auth.uid())
      )
  );
$$;

create or replace function public.can_select_atlas_category(target_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.atlas_categories ac
    where ac.id = target_id
      and ac.is_published = true
      and (ac.visibility = 'public' or public.is_approved_user())
  );
$$;

drop policy if exists "published experiments are public" on public.experiments;
drop policy if exists "experiments select by approved visibility" on public.experiments;
create policy "experiments select by approved visibility"
on public.experiments for select
to anon, authenticated
using (public.can_select_experiment(id));

drop policy if exists "researchers create experiments" on public.experiments;
create policy "researchers create experiments"
on public.experiments for insert
to authenticated
with check (
  public.is_approved_user()
  and researcher_id = auth.uid()
  and status in ('draft', 'submitted')
  and visibility = 'internal'
);

drop policy if exists "researchers update own experiments" on public.experiments;
create policy "researchers update own experiments"
on public.experiments for update
to authenticated
using (
  public.is_admin()
  or (researcher_id = auth.uid() and public.is_approved_user() and status in ('draft', 'submitted'))
)
with check (
  public.is_admin()
  or (researcher_id = auth.uid() and public.is_approved_user() and status in ('draft', 'submitted') and visibility = 'internal')
);

drop policy if exists "researchers delete own drafts" on public.experiments;
create policy "researchers delete own drafts"
on public.experiments for delete
to authenticated
using (public.is_admin() or (researcher_id = auth.uid() and public.is_approved_user() and status = 'draft'));

drop policy if exists "materials public read published" on public.materials;
drop policy if exists "materials select by approved visibility" on public.materials;
create policy "materials select by approved visibility" on public.materials for select to anon, authenticated using (public.can_select_material(id));
drop policy if exists "products public read published" on public.products;
drop policy if exists "products select by approved visibility" on public.products;
create policy "products select by approved visibility" on public.products for select to anon, authenticated using (public.can_select_product(id));
drop policy if exists "equipment public read published" on public.equipment;
drop policy if exists "equipment select by approved visibility" on public.equipment;
create policy "equipment select by approved visibility" on public.equipment for select to anon, authenticated using (public.can_select_equipment(id));
drop policy if exists "published research sources public" on public.research_sources;
drop policy if exists "research sources contributors read own" on public.research_sources;
drop policy if exists "research sources select by approved visibility" on public.research_sources;
create policy "research sources select by approved visibility" on public.research_sources for select to anon, authenticated using (public.can_select_research_source(id));
drop policy if exists "atlas categories public read published" on public.atlas_categories;
drop policy if exists "atlas categories select by approved visibility" on public.atlas_categories;
create policy "atlas categories select by approved visibility" on public.atlas_categories for select to anon, authenticated using (public.can_select_atlas_category(id));
drop policy if exists "atlas entries public read published" on public.atlas_entries;
drop policy if exists "atlas entries select by approved visibility" on public.atlas_entries;
create policy "atlas entries select by approved visibility" on public.atlas_entries for select to anon, authenticated using (public.can_select_atlas_entry(id));

drop policy if exists "materials contributors create" on public.materials;
create policy "materials contributors create" on public.materials for insert to authenticated with check (public.is_approved_user() and created_by = auth.uid() and status in ('draft', 'submitted') and is_published = false and visibility = 'internal');
drop policy if exists "materials contributors update own" on public.materials;
create policy "materials contributors update own" on public.materials for update to authenticated using (public.is_admin() or (created_by = auth.uid() and public.is_approved_user() and status in ('draft', 'submitted'))) with check (public.is_admin() or (created_by = auth.uid() and public.is_approved_user() and status in ('draft', 'submitted') and is_published = false and visibility = 'internal'));
drop policy if exists "products contributors create" on public.products;
create policy "products contributors create" on public.products for insert to authenticated with check (public.is_approved_user() and created_by = auth.uid() and status in ('draft', 'submitted') and is_published = false and visibility = 'internal');
drop policy if exists "products contributors update own" on public.products;
create policy "products contributors update own" on public.products for update to authenticated using (public.is_admin() or (created_by = auth.uid() and public.is_approved_user() and status in ('draft', 'submitted'))) with check (public.is_admin() or (created_by = auth.uid() and public.is_approved_user() and status in ('draft', 'submitted') and is_published = false and visibility = 'internal'));
drop policy if exists "equipment contributors create" on public.equipment;
create policy "equipment contributors create" on public.equipment for insert to authenticated with check (public.is_approved_user() and created_by = auth.uid() and status in ('draft', 'submitted') and is_published = false and visibility = 'internal');
drop policy if exists "equipment contributors update own" on public.equipment;
create policy "equipment contributors update own" on public.equipment for update to authenticated using (public.is_admin() or (created_by = auth.uid() and public.is_approved_user() and status in ('draft', 'submitted'))) with check (public.is_admin() or (created_by = auth.uid() and public.is_approved_user() and status in ('draft', 'submitted') and is_published = false and visibility = 'internal'));
drop policy if exists "research sources contributors create" on public.research_sources;
create policy "research sources contributors create" on public.research_sources for insert to authenticated with check (public.is_approved_user() and added_by = auth.uid() and status in ('draft', 'submitted') and is_published = false and visibility = 'internal');
drop policy if exists "research sources contributors update own" on public.research_sources;
create policy "research sources contributors update own" on public.research_sources for update to authenticated using (public.is_admin() or (added_by = auth.uid() and public.is_approved_user() and status in ('draft', 'submitted'))) with check (public.is_admin() or (added_by = auth.uid() and public.is_approved_user() and status in ('draft', 'submitted') and is_published = false and visibility = 'internal'));
drop policy if exists "atlas entries contributors create" on public.atlas_entries;
create policy "atlas entries contributors create" on public.atlas_entries for insert to authenticated with check (public.is_approved_user() and created_by = auth.uid() and status in ('draft', 'submitted') and is_published = false and visibility = 'internal');
drop policy if exists "atlas entries contributors update own" on public.atlas_entries;
create policy "atlas entries contributors update own" on public.atlas_entries for update to authenticated using (public.is_admin() or (created_by = auth.uid() and public.is_approved_user() and status in ('draft', 'submitted'))) with check (public.is_admin() or (created_by = auth.uid() and public.is_approved_user() and status in ('draft', 'submitted') and is_published = false and visibility = 'internal'));

drop policy if exists "taxonomy terms published read" on public.taxonomy_terms;
drop policy if exists "taxonomy terms approved read" on public.taxonomy_terms;
create policy "taxonomy terms approved read"
on public.taxonomy_terms for select
to authenticated
using (is_active = true and (public.is_approved_user() or public.is_admin()));

drop policy if exists "vendors authenticated read" on public.vendors;
drop policy if exists "vendors approved read" on public.vendors;
create policy "vendors approved read" on public.vendors for select to authenticated using (public.is_approved_user() or public.is_admin());
drop policy if exists "vendors contributors create" on public.vendors;
create policy "vendors contributors create" on public.vendors for insert to authenticated with check (public.is_approved_user() and created_by = auth.uid());
drop policy if exists "vendors contributors update own" on public.vendors;
create policy "vendors contributors update own" on public.vendors for update to authenticated using (public.is_admin() or (created_by = auth.uid() and public.is_approved_user())) with check (public.is_admin() or (created_by = auth.uid() and public.is_approved_user()));

create or replace view public.published_product_vendor_links as
select
  p.id as product_id,
  p.product_name,
  p.product_url,
  p.vendor_id,
  v.name as vendor_name,
  v.website_url as vendor_website_url,
  p.manufacturer,
  p.manufacturer_url,
  p.price,
  p.currency,
  p.price_checked_at
from public.products p
join public.vendors v on v.id = p.vendor_id
where p.status = 'published'
  and p.visibility = 'public'
  and p.is_active = true
  and v.is_active = true;

grant select on public.published_product_vendor_links to anon, authenticated;

drop policy if exists "product purchases authenticated read" on public.product_purchases;
drop policy if exists "product purchases approved read" on public.product_purchases;
create policy "product purchases approved read" on public.product_purchases for select to authenticated using (public.is_approved_user() or public.is_admin());
drop policy if exists "product purchases contributors create" on public.product_purchases;
create policy "product purchases contributors create" on public.product_purchases for insert to authenticated with check (public.is_approved_user() and purchased_by = auth.uid());

drop policy if exists "media visible with experiment" on public.experiment_media;
drop policy if exists "experiment media select by approved visibility" on public.experiment_media;
create policy "experiment media select by approved visibility" on public.experiment_media for select to anon, authenticated using (public.can_select_experiment(experiment_id));

drop policy if exists "library media public read parent published" on public.library_media;
drop policy if exists "library media contributors read own parent" on public.library_media;
drop policy if exists "library media select by approved visibility" on public.library_media;
create policy "library media select by approved visibility"
on public.library_media for select
to anon, authenticated
using (
  public.is_admin()
  or (entity_type = 'research_source' and public.can_select_research_source(entity_id))
  or (entity_type = 'material' and public.can_select_material(entity_id))
  or (entity_type = 'product' and public.can_select_product(entity_id))
  or (entity_type = 'equipment' and public.can_select_equipment(entity_id))
  or (entity_type = 'atlas_entry' and public.can_select_atlas_entry(entity_id))
);

drop policy if exists "library media contributors create" on public.library_media;
create policy "library media contributors create" on public.library_media for insert to authenticated with check (created_by = auth.uid() and (
  public.is_admin()
  or (entity_type = 'research_source' and exists (select 1 from public.research_sources rs where rs.id = entity_id and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted') and public.is_approved_user()))
  or (entity_type = 'material' and exists (select 1 from public.materials m where m.id = entity_id and m.created_by = auth.uid() and m.status in ('draft', 'submitted') and public.is_approved_user()))
  or (entity_type = 'product' and exists (select 1 from public.products p where p.id = entity_id and p.created_by = auth.uid() and p.status in ('draft', 'submitted') and public.is_approved_user()))
  or (entity_type = 'equipment' and exists (select 1 from public.equipment e where e.id = entity_id and e.created_by = auth.uid() and e.status in ('draft', 'submitted') and public.is_approved_user()))
  or (entity_type = 'atlas_entry' and exists (select 1 from public.atlas_entries ae where ae.id = entity_id and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted') and public.is_approved_user()))
));

create or replace function public.can_manage_library_media_parent(target_entity_type text, target_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_approved_user() and (
    (target_entity_type = 'research_source' and exists (select 1 from public.research_sources rs where rs.id = target_entity_id and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted')))
    or (target_entity_type = 'material' and exists (select 1 from public.materials m where m.id = target_entity_id and m.created_by = auth.uid() and m.status in ('draft', 'submitted')))
    or (target_entity_type = 'product' and exists (select 1 from public.products p where p.id = target_entity_id and p.created_by = auth.uid() and p.status in ('draft', 'submitted')))
    or (target_entity_type = 'equipment' and exists (select 1 from public.equipment e where e.id = target_entity_id and e.created_by = auth.uid() and e.status in ('draft', 'submitted')))
    or (target_entity_type = 'atlas_entry' and exists (select 1 from public.atlas_entries ae where ae.id = target_entity_id and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted')))
  );
$$;

drop policy if exists "library media contributors update own" on public.library_media;
create policy "library media contributors update own" on public.library_media for update to authenticated
using (
  public.is_admin()
  or (created_by = auth.uid() and public.can_manage_library_media_parent(entity_type, entity_id))
)
with check (
  public.is_admin()
  or (created_by = auth.uid() and public.can_manage_library_media_parent(entity_type, entity_id))
);
drop policy if exists "library media contributors delete own" on public.library_media;
create policy "library media contributors delete own" on public.library_media for delete to authenticated
using (
  public.is_admin()
  or (created_by = auth.uid() and public.can_manage_library_media_parent(entity_type, entity_id))
);

drop policy if exists "stages visible with experiment" on public.experiment_stages;
create policy "stages visible with experiment" on public.experiment_stages for select to anon, authenticated using (public.can_select_experiment(experiment_id));

drop policy if exists "researchers create stages" on public.experiment_stages;
create policy "researchers create stages" on public.experiment_stages for insert to authenticated with check (exists (select 1 from public.experiments e where e.id = experiment_id and (public.is_admin() or (e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted')))));
drop policy if exists "researchers update stages" on public.experiment_stages;
create policy "researchers update stages" on public.experiment_stages for update to authenticated using (exists (select 1 from public.experiments e where e.id = experiment_id and (public.is_admin() or (e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted'))))) with check (exists (select 1 from public.experiments e where e.id = experiment_id and (public.is_admin() or (e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted')))));
drop policy if exists "researchers delete stages" on public.experiment_stages;
create policy "researchers delete stages" on public.experiment_stages for delete to authenticated using (exists (select 1 from public.experiments e where e.id = experiment_id and (public.is_admin() or (e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted')))));

drop policy if exists "researchers create media metadata" on public.experiment_media;
create policy "researchers create media metadata" on public.experiment_media for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.experiments e where e.id = experiment_id and (public.is_admin() or (e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted')))));
drop policy if exists "researchers edit media metadata" on public.experiment_media;
create policy "researchers edit media metadata" on public.experiment_media for update to authenticated using (public.is_admin() or (created_by = auth.uid() and exists (select 1 from public.experiments e where e.id = experiment_id and e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted')))) with check (public.is_admin() or (created_by = auth.uid() and exists (select 1 from public.experiments e where e.id = experiment_id and e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted'))));
drop policy if exists "researchers delete media metadata" on public.experiment_media;
create policy "researchers delete media metadata" on public.experiment_media for delete to authenticated using (public.is_admin() or exists (select 1 from public.experiments e where e.id = experiment_id and e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted')));

drop policy if exists "experiment material links visible" on public.experiment_materials;
create policy "experiment material links visible" on public.experiment_materials for select to anon, authenticated using (public.can_select_experiment(experiment_id) and public.can_select_material(material_id));
drop policy if exists "experiment product links visible" on public.experiment_products;
create policy "experiment product links visible" on public.experiment_products for select to anon, authenticated using (public.can_select_experiment(experiment_id) and public.can_select_product(product_id));
drop policy if exists "experiment equipment links visible" on public.experiment_equipment;
create policy "experiment equipment links visible" on public.experiment_equipment for select to anon, authenticated using (public.can_select_experiment(experiment_id) and public.can_select_equipment(equipment_id));
drop policy if exists "experiment source links visible" on public.experiment_sources;
create policy "experiment source links visible" on public.experiment_sources for select to anon, authenticated using (public.can_select_experiment(experiment_id) and public.can_select_research_source(source_id));

drop policy if exists "experiment material links manage" on public.experiment_materials;
create policy "experiment material links manage" on public.experiment_materials for all to authenticated
using (public.is_admin() or exists (select 1 from public.experiments e where e.id = experiment_id and e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted')))
with check (public.is_admin() or (public.can_select_material(material_id) and exists (select 1 from public.experiments e where e.id = experiment_id and e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted'))));
drop policy if exists "experiment product links manage" on public.experiment_products;
create policy "experiment product links manage" on public.experiment_products for all to authenticated
using (public.is_admin() or exists (select 1 from public.experiments e where e.id = experiment_id and e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted')))
with check (public.is_admin() or (public.can_select_product(product_id) and exists (select 1 from public.experiments e where e.id = experiment_id and e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted'))));
drop policy if exists "experiment equipment links manage" on public.experiment_equipment;
create policy "experiment equipment links manage" on public.experiment_equipment for all to authenticated
using (public.is_admin() or exists (select 1 from public.experiments e where e.id = experiment_id and e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted')))
with check (public.is_admin() or (public.can_select_equipment(equipment_id) and exists (select 1 from public.experiments e where e.id = experiment_id and e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted'))));
drop policy if exists "experiment source links manage" on public.experiment_sources;
create policy "experiment source links manage" on public.experiment_sources for all to authenticated
using (public.is_admin() or exists (select 1 from public.experiments e where e.id = experiment_id and e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted')))
with check (public.is_admin() or (public.can_select_research_source(source_id) and exists (select 1 from public.experiments e where e.id = experiment_id and e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted'))));

drop policy if exists "atlas source links visible" on public.atlas_entry_sources;
create policy "atlas source links visible" on public.atlas_entry_sources for select to anon, authenticated using (public.can_select_atlas_entry(atlas_entry_id) and public.can_select_research_source(source_id));
drop policy if exists "atlas material links visible" on public.atlas_entry_materials;
create policy "atlas material links visible" on public.atlas_entry_materials for select to anon, authenticated using (public.can_select_atlas_entry(atlas_entry_id) and public.can_select_material(material_id));
drop policy if exists "atlas experiment links visible" on public.atlas_entry_experiments;
create policy "atlas experiment links visible" on public.atlas_entry_experiments for select to anon, authenticated using (public.can_select_atlas_entry(atlas_entry_id) and public.can_select_experiment(experiment_id));
drop policy if exists "atlas equipment links visible" on public.atlas_entry_equipment;
create policy "atlas equipment links visible" on public.atlas_entry_equipment for select to anon, authenticated using (public.can_select_atlas_entry(atlas_entry_id) and public.can_select_equipment(equipment_id));

drop policy if exists "atlas source links contributors create" on public.atlas_entry_sources;
create policy "atlas source links contributors create" on public.atlas_entry_sources for insert to authenticated with check (public.can_select_research_source(source_id) and exists (select 1 from public.atlas_entries ae where ae.id = atlas_entry_id and ae.created_by = auth.uid() and public.is_approved_user() and ae.status in ('draft', 'submitted')));
drop policy if exists "atlas source links contributors delete" on public.atlas_entry_sources;
create policy "atlas source links contributors delete" on public.atlas_entry_sources for delete to authenticated using (exists (select 1 from public.atlas_entries ae where ae.id = atlas_entry_id and ae.created_by = auth.uid() and public.is_approved_user() and ae.status in ('draft', 'submitted')));
drop policy if exists "atlas material links contributors create" on public.atlas_entry_materials;
create policy "atlas material links contributors create" on public.atlas_entry_materials for insert to authenticated with check (public.can_select_material(material_id) and exists (select 1 from public.atlas_entries ae where ae.id = atlas_entry_id and ae.created_by = auth.uid() and public.is_approved_user() and ae.status in ('draft', 'submitted')));
drop policy if exists "atlas material links contributors delete" on public.atlas_entry_materials;
create policy "atlas material links contributors delete" on public.atlas_entry_materials for delete to authenticated using (exists (select 1 from public.atlas_entries ae where ae.id = atlas_entry_id and ae.created_by = auth.uid() and public.is_approved_user() and ae.status in ('draft', 'submitted')));
drop policy if exists "atlas experiment links contributors create" on public.atlas_entry_experiments;
create policy "atlas experiment links contributors create" on public.atlas_entry_experiments for insert to authenticated with check (public.can_select_experiment(experiment_id) and exists (select 1 from public.atlas_entries ae where ae.id = atlas_entry_id and ae.created_by = auth.uid() and public.is_approved_user() and ae.status in ('draft', 'submitted')));
drop policy if exists "atlas experiment links contributors delete" on public.atlas_entry_experiments;
create policy "atlas experiment links contributors delete" on public.atlas_entry_experiments for delete to authenticated using (exists (select 1 from public.atlas_entries ae where ae.id = atlas_entry_id and ae.created_by = auth.uid() and public.is_approved_user() and ae.status in ('draft', 'submitted')));
drop policy if exists "atlas equipment links contributors create" on public.atlas_entry_equipment;
create policy "atlas equipment links contributors create" on public.atlas_entry_equipment for insert to authenticated with check (public.can_select_equipment(equipment_id) and exists (select 1 from public.atlas_entries ae where ae.id = atlas_entry_id and ae.created_by = auth.uid() and public.is_approved_user() and ae.status in ('draft', 'submitted')));
drop policy if exists "atlas equipment links contributors delete" on public.atlas_entry_equipment;
create policy "atlas equipment links contributors delete" on public.atlas_entry_equipment for delete to authenticated using (exists (select 1 from public.atlas_entries ae where ae.id = atlas_entry_id and ae.created_by = auth.uid() and public.is_approved_user() and ae.status in ('draft', 'submitted')));

drop policy if exists "media objects visible with experiment" on storage.objects;
create policy "media objects visible with experiment"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'experiment-media'
  and public.can_select_experiment(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "researchers upload experiment media" on storage.objects;
create policy "researchers upload experiment media" on storage.objects for insert to authenticated with check (bucket_id = 'experiment-media' and exists (select 1 from public.experiments e where e.id::text = (storage.foldername(name))[1] and (public.is_admin() or (e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted')))));
drop policy if exists "researchers delete experiment media" on storage.objects;
create policy "researchers delete experiment media" on storage.objects for delete to authenticated using (bucket_id = 'experiment-media' and exists (select 1 from public.experiments e where e.id::text = (storage.foldername(name))[1] and (public.is_admin() or (e.researcher_id = auth.uid() and public.is_approved_user() and e.status in ('draft', 'submitted')))));

drop policy if exists "library media objects public read parent published" on storage.objects;
create policy "library media objects public read parent published"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'library-media'
  and (
    public.is_admin()
    or ((storage.foldername(name))[1] = 'research_source' and public.can_select_research_source(((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'material' and public.can_select_material(((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'product' and public.can_select_product(((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'equipment' and public.can_select_equipment(((storage.foldername(name))[2])::uuid))
    or ((storage.foldername(name))[1] = 'atlas_entry' and public.can_select_atlas_entry(((storage.foldername(name))[2])::uuid))
  )
);

drop policy if exists "library media objects contributors upload" on storage.objects;
create policy "library media objects contributors upload" on storage.objects for insert to authenticated with check (bucket_id = 'library-media' and (
  public.is_admin()
  or (public.is_approved_user() and (
    ((storage.foldername(name))[1] = 'research_source' and exists (select 1 from public.research_sources rs where rs.id::text = (storage.foldername(name))[2] and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'material' and exists (select 1 from public.materials m where m.id::text = (storage.foldername(name))[2] and m.created_by = auth.uid() and m.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'product' and exists (select 1 from public.products p where p.id::text = (storage.foldername(name))[2] and p.created_by = auth.uid() and p.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'equipment' and exists (select 1 from public.equipment e where e.id::text = (storage.foldername(name))[2] and e.created_by = auth.uid() and e.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'atlas_entry' and exists (select 1 from public.atlas_entries ae where ae.id::text = (storage.foldername(name))[2] and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted')))
  ))
));
drop policy if exists "library media objects contributors update" on storage.objects;
create policy "library media objects contributors update" on storage.objects for update to authenticated using (bucket_id = 'library-media' and (
  public.is_admin()
  or (public.is_approved_user() and (
    ((storage.foldername(name))[1] = 'research_source' and exists (select 1 from public.research_sources rs where rs.id::text = (storage.foldername(name))[2] and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'material' and exists (select 1 from public.materials m where m.id::text = (storage.foldername(name))[2] and m.created_by = auth.uid() and m.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'product' and exists (select 1 from public.products p where p.id::text = (storage.foldername(name))[2] and p.created_by = auth.uid() and p.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'equipment' and exists (select 1 from public.equipment e where e.id::text = (storage.foldername(name))[2] and e.created_by = auth.uid() and e.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'atlas_entry' and exists (select 1 from public.atlas_entries ae where ae.id::text = (storage.foldername(name))[2] and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted')))
  ))
)) with check (bucket_id = 'library-media' and (
  public.is_admin()
  or (public.is_approved_user() and (
    ((storage.foldername(name))[1] = 'research_source' and exists (select 1 from public.research_sources rs where rs.id::text = (storage.foldername(name))[2] and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'material' and exists (select 1 from public.materials m where m.id::text = (storage.foldername(name))[2] and m.created_by = auth.uid() and m.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'product' and exists (select 1 from public.products p where p.id::text = (storage.foldername(name))[2] and p.created_by = auth.uid() and p.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'equipment' and exists (select 1 from public.equipment e where e.id::text = (storage.foldername(name))[2] and e.created_by = auth.uid() and e.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'atlas_entry' and exists (select 1 from public.atlas_entries ae where ae.id::text = (storage.foldername(name))[2] and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted')))
  ))
));
drop policy if exists "library media objects contributors delete" on storage.objects;
create policy "library media objects contributors delete" on storage.objects for delete to authenticated using (bucket_id = 'library-media' and (
  public.is_admin()
  or (public.is_approved_user() and (
    ((storage.foldername(name))[1] = 'research_source' and exists (select 1 from public.research_sources rs where rs.id::text = (storage.foldername(name))[2] and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'material' and exists (select 1 from public.materials m where m.id::text = (storage.foldername(name))[2] and m.created_by = auth.uid() and m.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'product' and exists (select 1 from public.products p where p.id::text = (storage.foldername(name))[2] and p.created_by = auth.uid() and p.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'equipment' and exists (select 1 from public.equipment e where e.id::text = (storage.foldername(name))[2] and e.created_by = auth.uid() and e.status in ('draft', 'submitted')))
    or ((storage.foldername(name))[1] = 'atlas_entry' and exists (select 1 from public.atlas_entries ae where ae.id::text = (storage.foldername(name))[2] and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted')))
  ))
));
