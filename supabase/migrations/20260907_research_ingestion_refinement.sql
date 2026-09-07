-- Research ingestion refinements.
-- Additive migration for review. Do not run until manually approved.

alter table public.research_sources
  add column if not exists rights_notes text,
  add column if not exists license text,
  add column if not exists source_archive text,
  add column if not exists accessed_date date,
  add column if not exists short_note text,
  add column if not exists why_it_matters text;

alter table public.library_media
  add column if not exists rights_notes text,
  add column if not exists license text,
  add column if not exists creator text,
  add column if not exists original_date text,
  add column if not exists is_primary boolean not null default false;

create table if not exists public.research_source_tags (
  source_id uuid not null references public.research_sources(id) on delete cascade,
  taxonomy_term_id uuid not null references public.taxonomy_terms(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  primary key (source_id, taxonomy_term_id)
);

create table if not exists public.product_alternatives (
  product_id uuid not null references public.products(id) on delete cascade,
  alternative_product_id uuid not null references public.products(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  primary key (product_id, alternative_product_id),
  constraint product_alternatives_not_self check (product_id <> alternative_product_id)
);

alter table public.research_source_tags enable row level security;
alter table public.product_alternatives enable row level security;

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.full_name is distinct from old.full_name
    or new.affiliation is distinct from old.affiliation
    or new.access_request_note is distinct from old.access_request_note then
    if new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.approval_status is distinct from old.approval_status
      or new.approval_requested_at is distinct from old.approval_requested_at
      or new.approved_at is distinct from old.approved_at
      or new.approved_by is distinct from old.approved_by
      or new.rejected_at is distinct from old.rejected_at
      or new.rejection_reason is distinct from old.rejection_reason
      or new.created_at is distinct from old.created_at then
      raise exception 'Only administrators can change protected profile fields';
    end if;
    return new;
  end if;

  raise exception 'Only full name, affiliation, and access request note may be self-edited';
end;
$$;

drop trigger if exists trg_protect_profile_admin_fields on public.profiles;
create trigger trg_protect_profile_admin_fields
before update on public.profiles
for each row execute function public.protect_profile_admin_fields();

drop policy if exists "research source tags visible" on public.research_source_tags;
create policy "research source tags visible"
on public.research_source_tags for select
to anon, authenticated
using (
  public.can_select_research_source(source_id)
  and exists (select 1 from public.taxonomy_terms t where t.id = taxonomy_term_id and t.is_active = true)
);

drop policy if exists "research source tags contributors create" on public.research_source_tags;
create policy "research source tags contributors create"
on public.research_source_tags for insert
to authenticated
with check (
  public.is_admin()
  or (
    public.is_approved_user()
    and created_by = auth.uid()
    and exists (
      select 1 from public.research_sources rs
      where rs.id = source_id
        and rs.added_by = auth.uid()
        and rs.status in ('draft', 'submitted')
    )
    and exists (select 1 from public.taxonomy_terms t where t.id = taxonomy_term_id and t.is_active = true)
  )
);

drop policy if exists "research source tags contributors delete" on public.research_source_tags;
create policy "research source tags contributors delete"
on public.research_source_tags for delete
to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_user()
    and exists (
      select 1 from public.research_sources rs
      where rs.id = source_id
        and rs.added_by = auth.uid()
        and rs.status in ('draft', 'submitted')
    )
  )
);

drop policy if exists "product alternatives visible" on public.product_alternatives;
create policy "product alternatives visible"
on public.product_alternatives for select
to anon, authenticated
using (
  public.can_select_product(product_id)
  and public.can_select_product(alternative_product_id)
);

drop policy if exists "product alternatives contributors create" on public.product_alternatives;
create policy "product alternatives contributors create"
on public.product_alternatives for insert
to authenticated
with check (
  public.is_admin()
  or (
    public.is_approved_user()
    and created_by = auth.uid()
    and public.can_select_product(alternative_product_id)
    and exists (
      select 1 from public.products p
      where p.id = product_id
        and p.created_by = auth.uid()
        and p.status in ('draft', 'submitted')
    )
  )
);

drop policy if exists "product alternatives contributors update" on public.product_alternatives;
create policy "product alternatives contributors update"
on public.product_alternatives for update
to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_user()
    and created_by = auth.uid()
    and exists (
      select 1 from public.products p
      where p.id = product_id
        and p.created_by = auth.uid()
        and p.status in ('draft', 'submitted')
    )
  )
)
with check (
  public.is_admin()
  or (
    public.is_approved_user()
    and created_by = auth.uid()
    and public.can_select_product(alternative_product_id)
    and exists (
      select 1 from public.products p
      where p.id = product_id
        and p.created_by = auth.uid()
        and p.status in ('draft', 'submitted')
    )
  )
);

drop policy if exists "product alternatives contributors delete" on public.product_alternatives;
create policy "product alternatives contributors delete"
on public.product_alternatives for delete
to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_user()
    and created_by = auth.uid()
    and exists (
      select 1 from public.products p
      where p.id = product_id
        and p.created_by = auth.uid()
        and p.status in ('draft', 'submitted')
    )
  )
);

create index if not exists idx_research_source_tags_term on public.research_source_tags (taxonomy_term_id);
create index if not exists idx_product_alternatives_alt on public.product_alternatives (alternative_product_id);
create index if not exists idx_library_media_primary on public.library_media (entity_type, entity_id, is_primary);
