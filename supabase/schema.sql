-- Forming Material / Press-Forming v1 schema
-- Run this entire file in Supabase SQL Editor on a NEW project.

create extension if not exists pgcrypto;

create type public.user_role as enum ('student', 'research_assistant', 'admin');
create type public.experiment_status as enum ('draft', 'submitted', 'reviewed', 'published');
create type public.experiment_outcome as enum ('successful', 'partial', 'failed', 'unexpected');

create sequence if not exists public.experiment_code_seq start 1;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  affiliation text,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);

create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  researcher_id uuid not null references auth.users(id) on delete cascade,
  researcher_name text,
  title text not null,
  summary text,
  research_question text,
  material_name text,
  material_condition text,
  thickness_mm numeric check (thickness_mm is null or thickness_mm >= 0),
  outcome public.experiment_outcome,
  undercut_depth_mm numeric check (undercut_depth_mm is null or undercut_depth_mm >= 0),
  springback_deg numeric check (springback_deg is null or springback_deg >= 0),
  observations text,
  failure_notes text,
  status public.experiment_status not null default 'draft',
  parent_experiment_id uuid references public.experiments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.experiment_stages (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  stage_number integer not null check (stage_number > 0),
  title text not null,
  forming_operation text,
  tool_material text,
  tool_process text,
  tool_hardness text,
  tool_infill text,
  wall_count integer,
  print_orientation text,
  press_force_tons numeric check (press_force_tons is null or press_force_tons >= 0),
  constraint_type text,
  observations text,
  created_at timestamptz not null default now(),
  unique (experiment_id, stage_number)
);

create table public.experiment_media (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null default 'result',
  caption text,
  display_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null,
  url text,
  citation text,
  principle text,
  research_translation text,
  notes text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.set_experiment_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'FM-' || lpad(nextval('public.experiment_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger trg_experiment_code
before insert on public.experiments
for each row execute function public.set_experiment_code();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_experiment_updated
before update on public.experiments
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only administrators can change user roles';
  end if;
  return new;
end;
$$;

create trigger trg_protect_profile_role
before update on public.profiles
for each row execute function public.protect_profile_role();

alter table public.profiles enable row level security;
alter table public.experiments enable row level security;
alter table public.experiment_stages enable row level security;
alter table public.experiment_media enable row level security;
alter table public.research_sources enable row level security;

-- Profiles: signed-in users can read basic profile data; users edit their own; admins edit any.
create policy "profiles read authenticated"
on public.profiles for select
to authenticated
using (true);

create policy "profiles update own"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Experiments: published records are public; researchers see their own; admins see all.
create policy "published experiments are public"
on public.experiments for select
to anon, authenticated
using (status = 'published' or researcher_id = auth.uid() or public.is_admin());

create policy "researchers create experiments"
on public.experiments for insert
to authenticated
with check (
  researcher_id = auth.uid()
  and (status in ('draft', 'submitted') or public.is_admin())
);

create policy "researchers update own experiments"
on public.experiments for update
to authenticated
using (researcher_id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (researcher_id = auth.uid() and status in ('draft', 'submitted'))
);

create policy "researchers delete own drafts"
on public.experiments for delete
to authenticated
using ((researcher_id = auth.uid() and status = 'draft') or public.is_admin());

-- Stage access follows the parent experiment.
create policy "stages visible with experiment"
on public.experiment_stages for select
to anon, authenticated
using (exists (
  select 1 from public.experiments e
  where e.id = experiment_id
  and (e.status = 'published' or e.researcher_id = auth.uid() or public.is_admin())
));

create policy "researchers create stages"
on public.experiment_stages for insert
to authenticated
with check (exists (
  select 1 from public.experiments e
  where e.id = experiment_id and (e.researcher_id = auth.uid() or public.is_admin())
));

create policy "researchers update stages"
on public.experiment_stages for update
to authenticated
using (exists (
  select 1 from public.experiments e
  where e.id = experiment_id and (e.researcher_id = auth.uid() or public.is_admin())
))
with check (exists (
  select 1 from public.experiments e
  where e.id = experiment_id and (e.researcher_id = auth.uid() or public.is_admin())
));

create policy "researchers delete stages"
on public.experiment_stages for delete
to authenticated
using (exists (
  select 1 from public.experiments e
  where e.id = experiment_id and (e.researcher_id = auth.uid() or public.is_admin())
));

-- Media metadata follows the experiment.
create policy "media visible with experiment"
on public.experiment_media for select
to anon, authenticated
using (exists (
  select 1 from public.experiments e
  where e.id = experiment_id
  and (e.status = 'published' or e.researcher_id = auth.uid() or public.is_admin())
));

create policy "researchers create media metadata"
on public.experiment_media for insert
to authenticated
with check (created_by = auth.uid() and exists (
  select 1 from public.experiments e
  where e.id = experiment_id and (e.researcher_id = auth.uid() or public.is_admin())
));

create policy "researchers edit media metadata"
on public.experiment_media for update
to authenticated
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

create policy "researchers delete media metadata"
on public.experiment_media for delete
to authenticated
using (created_by = auth.uid() or public.is_admin());

-- Source atlas is public to read; admins manage.
create policy "published research sources public"
on public.research_sources for select
to anon, authenticated
using (is_published = true or public.is_admin());

create policy "admins manage sources"
on public.research_sources for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Storage bucket. Files use the path {experiment_uuid}/{filename}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'experiment-media',
  'experiment-media',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic']
)
on conflict (id) do nothing;

create policy "media objects visible with experiment"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'experiment-media'
  and exists (
    select 1 from public.experiments e
    where e.id::text = (storage.foldername(name))[1]
    and (e.status = 'published' or e.researcher_id = auth.uid() or public.is_admin())
  )
);

create policy "researchers upload experiment media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'experiment-media'
  and exists (
    select 1 from public.experiments e
    where e.id::text = (storage.foldername(name))[1]
    and (e.researcher_id = auth.uid() or public.is_admin())
  )
);

create policy "researchers delete experiment media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'experiment-media'
  and exists (
    select 1 from public.experiments e
    where e.id::text = (storage.foldername(name))[1]
    and (e.researcher_id = auth.uid() or public.is_admin())
  )
);
