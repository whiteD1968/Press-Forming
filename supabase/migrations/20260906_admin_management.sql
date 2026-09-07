-- Admin management and active-account enforcement.
-- Run after the original schema.sql. This migration is additive.

alter table public.profiles
  add column if not exists email text,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'student',
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
        updated_at = now();
  return new;
end;
$$;

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profile_updated on public.profiles;
create trigger trg_profile_updated
before update on public.profiles
for each row execute function public.set_profile_updated_at();

create or replace function public.is_active_user()
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
    or new.is_active is distinct from old.is_active then
    if not public.is_admin() then
      raise exception 'Only administrators can change roles or account status';
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

drop policy if exists "researchers create experiments" on public.experiments;
create policy "researchers create experiments"
on public.experiments for insert
to authenticated
with check (
  public.is_active_user()
  and researcher_id = auth.uid()
  and (status in ('draft', 'submitted') or public.is_admin())
);

drop policy if exists "researchers update own experiments" on public.experiments;
create policy "researchers update own experiments"
on public.experiments for update
to authenticated
using (
  public.is_admin()
  or (researcher_id = auth.uid() and public.is_active_user() and status in ('draft', 'submitted'))
)
with check (
  public.is_admin()
  or (researcher_id = auth.uid() and public.is_active_user() and status in ('draft', 'submitted'))
);

drop policy if exists "researchers delete own drafts" on public.experiments;
create policy "researchers delete own drafts"
on public.experiments for delete
to authenticated
using (
  public.is_admin()
  or (researcher_id = auth.uid() and public.is_active_user() and status = 'draft')
);

drop policy if exists "researchers create stages" on public.experiment_stages;
create policy "researchers create stages"
on public.experiment_stages for insert
to authenticated
with check (exists (
  select 1 from public.experiments e
  where e.id = experiment_id
    and (
      public.is_admin()
      or (e.researcher_id = auth.uid() and public.is_active_user() and e.status in ('draft', 'submitted'))
    )
));

drop policy if exists "researchers update stages" on public.experiment_stages;
create policy "researchers update stages"
on public.experiment_stages for update
to authenticated
using (exists (
  select 1 from public.experiments e
  where e.id = experiment_id
    and (
      public.is_admin()
      or (e.researcher_id = auth.uid() and public.is_active_user() and e.status in ('draft', 'submitted'))
    )
))
with check (exists (
  select 1 from public.experiments e
  where e.id = experiment_id
    and (
      public.is_admin()
      or (e.researcher_id = auth.uid() and public.is_active_user() and e.status in ('draft', 'submitted'))
    )
));

drop policy if exists "researchers delete stages" on public.experiment_stages;
create policy "researchers delete stages"
on public.experiment_stages for delete
to authenticated
using (exists (
  select 1 from public.experiments e
  where e.id = experiment_id
    and (
      public.is_admin()
      or (e.researcher_id = auth.uid() and public.is_active_user() and e.status in ('draft', 'submitted'))
    )
));

drop policy if exists "researchers create media metadata" on public.experiment_media;
create policy "researchers create media metadata"
on public.experiment_media for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.experiments e
    where e.id = experiment_id
      and (
        public.is_admin()
        or (e.researcher_id = auth.uid() and public.is_active_user() and e.status in ('draft', 'submitted'))
      )
  )
);

drop policy if exists "researchers edit media metadata" on public.experiment_media;
create policy "researchers edit media metadata"
on public.experiment_media for update
to authenticated
using (
  public.is_admin()
  or (
    created_by = auth.uid()
    and exists (
      select 1 from public.experiments e
      where e.id = experiment_id
        and e.researcher_id = auth.uid()
        and public.is_active_user()
        and e.status in ('draft', 'submitted')
    )
  )
)
with check (
  public.is_admin()
  or (
    created_by = auth.uid()
    and exists (
      select 1 from public.experiments e
      where e.id = experiment_id
        and e.researcher_id = auth.uid()
        and public.is_active_user()
        and e.status in ('draft', 'submitted')
    )
  )
);

drop policy if exists "researchers delete media metadata" on public.experiment_media;
create policy "researchers delete media metadata"
on public.experiment_media for delete
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.experiments e
    where e.id = experiment_id
      and e.researcher_id = auth.uid()
      and public.is_active_user()
      and e.status in ('draft', 'submitted')
  )
);

drop policy if exists "researchers upload experiment media" on storage.objects;
create policy "researchers upload experiment media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'experiment-media'
  and exists (
    select 1 from public.experiments e
    where e.id::text = (storage.foldername(name))[1]
      and (
        public.is_admin()
        or (e.researcher_id = auth.uid() and public.is_active_user() and e.status in ('draft', 'submitted'))
      )
  )
);

drop policy if exists "researchers delete experiment media" on storage.objects;
create policy "researchers delete experiment media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'experiment-media'
  and exists (
    select 1 from public.experiments e
    where e.id::text = (storage.foldername(name))[1]
      and (
        public.is_admin()
        or (e.researcher_id = auth.uid() and public.is_active_user() and e.status in ('draft', 'submitted'))
      )
  )
);
