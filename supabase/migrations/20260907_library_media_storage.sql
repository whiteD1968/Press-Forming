-- Library media storage bucket and RLS.
-- Create this migration file only. Do not run until reviewed.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-media',
  'library-media',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic']
)
on conflict (id) do nothing;

-- Current anonymous access to media follows parent publication state.
-- A future access-control migration will separate editorial publication status,
-- internal approved-researcher visibility, and deliberately public visibility.
drop policy if exists "library media objects public read parent published" on storage.objects;
create policy "library media objects public read parent published"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'library-media'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] = 'research_source'
      and exists (
        select 1 from public.research_sources rs
        where rs.id::text = (storage.foldername(name))[2]
          and (rs.status = 'published' or (rs.is_published = true and rs.status <> 'archived'))
      )
    )
    or (
      (storage.foldername(name))[1] = 'research_source'
      and public.is_active_user()
      and exists (
        select 1 from public.research_sources rs
        where rs.id::text = (storage.foldername(name))[2]
          and rs.added_by = auth.uid()
      )
    )
    or (
      (storage.foldername(name))[1] = 'material'
      and exists (
        select 1 from public.materials m
        where m.id::text = (storage.foldername(name))[2]
          and (m.status = 'published' or m.is_published = true)
      )
    )
    or (
      (storage.foldername(name))[1] = 'material'
      and public.is_active_user()
      and exists (
        select 1 from public.materials m
        where m.id::text = (storage.foldername(name))[2]
          and m.created_by = auth.uid()
      )
    )
    or (
      (storage.foldername(name))[1] = 'product'
      and exists (
        select 1 from public.products p
        where p.id::text = (storage.foldername(name))[2]
          and (p.status = 'published' or p.is_published = true)
      )
    )
    or (
      (storage.foldername(name))[1] = 'product'
      and public.is_active_user()
      and exists (
        select 1 from public.products p
        where p.id::text = (storage.foldername(name))[2]
          and p.created_by = auth.uid()
      )
    )
    or (
      (storage.foldername(name))[1] = 'equipment'
      and exists (
        select 1 from public.equipment e
        where e.id::text = (storage.foldername(name))[2]
          and (e.status = 'published' or e.is_published = true)
      )
    )
    or (
      (storage.foldername(name))[1] = 'equipment'
      and public.is_active_user()
      and exists (
        select 1 from public.equipment e
        where e.id::text = (storage.foldername(name))[2]
          and e.created_by = auth.uid()
      )
    )
    or (
      (storage.foldername(name))[1] = 'atlas_entry'
      and exists (
        select 1 from public.atlas_entries ae
        where ae.id::text = (storage.foldername(name))[2]
          and (ae.status = 'published' or ae.is_published = true)
      )
    )
    or (
      (storage.foldername(name))[1] = 'atlas_entry'
      and public.is_active_user()
      and exists (
        select 1 from public.atlas_entries ae
        where ae.id::text = (storage.foldername(name))[2]
          and ae.created_by = auth.uid()
      )
    )
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
      public.is_active_user()
      and (
        (
          (storage.foldername(name))[1] = 'research_source'
          and exists (select 1 from public.research_sources rs where rs.id::text = (storage.foldername(name))[2] and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted'))
        )
        or (
          (storage.foldername(name))[1] = 'material'
          and exists (select 1 from public.materials m where m.id::text = (storage.foldername(name))[2] and m.created_by = auth.uid() and m.status in ('draft', 'submitted'))
        )
        or (
          (storage.foldername(name))[1] = 'product'
          and exists (select 1 from public.products p where p.id::text = (storage.foldername(name))[2] and p.created_by = auth.uid() and p.status in ('draft', 'submitted'))
        )
        or (
          (storage.foldername(name))[1] = 'equipment'
          and exists (select 1 from public.equipment e where e.id::text = (storage.foldername(name))[2] and e.created_by = auth.uid() and e.status in ('draft', 'submitted'))
        )
        or (
          (storage.foldername(name))[1] = 'atlas_entry'
          and exists (select 1 from public.atlas_entries ae where ae.id::text = (storage.foldername(name))[2] and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted'))
        )
      )
    )
  )
);

drop policy if exists "library media objects contributors update" on storage.objects;
create policy "library media objects contributors update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'library-media'
  and (
    public.is_admin()
    or (
      public.is_active_user()
      and (
        ((storage.foldername(name))[1] = 'research_source' and exists (select 1 from public.research_sources rs where rs.id::text = (storage.foldername(name))[2] and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'material' and exists (select 1 from public.materials m where m.id::text = (storage.foldername(name))[2] and m.created_by = auth.uid() and m.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'product' and exists (select 1 from public.products p where p.id::text = (storage.foldername(name))[2] and p.created_by = auth.uid() and p.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'equipment' and exists (select 1 from public.equipment e where e.id::text = (storage.foldername(name))[2] and e.created_by = auth.uid() and e.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'atlas_entry' and exists (select 1 from public.atlas_entries ae where ae.id::text = (storage.foldername(name))[2] and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted')))
      )
    )
  )
)
with check (
  bucket_id = 'library-media'
  and (
    public.is_admin()
    or (
      public.is_active_user()
      and (
        ((storage.foldername(name))[1] = 'research_source' and exists (select 1 from public.research_sources rs where rs.id::text = (storage.foldername(name))[2] and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'material' and exists (select 1 from public.materials m where m.id::text = (storage.foldername(name))[2] and m.created_by = auth.uid() and m.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'product' and exists (select 1 from public.products p where p.id::text = (storage.foldername(name))[2] and p.created_by = auth.uid() and p.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'equipment' and exists (select 1 from public.equipment e where e.id::text = (storage.foldername(name))[2] and e.created_by = auth.uid() and e.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'atlas_entry' and exists (select 1 from public.atlas_entries ae where ae.id::text = (storage.foldername(name))[2] and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted')))
      )
    )
  )
);

drop policy if exists "library media objects contributors delete" on storage.objects;
create policy "library media objects contributors delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'library-media'
  and (
    public.is_admin()
    or (
      public.is_active_user()
      and (
        ((storage.foldername(name))[1] = 'research_source' and exists (select 1 from public.research_sources rs where rs.id::text = (storage.foldername(name))[2] and rs.added_by = auth.uid() and rs.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'material' and exists (select 1 from public.materials m where m.id::text = (storage.foldername(name))[2] and m.created_by = auth.uid() and m.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'product' and exists (select 1 from public.products p where p.id::text = (storage.foldername(name))[2] and p.created_by = auth.uid() and p.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'equipment' and exists (select 1 from public.equipment e where e.id::text = (storage.foldername(name))[2] and e.created_by = auth.uid() and e.status in ('draft', 'submitted')))
        or ((storage.foldername(name))[1] = 'atlas_entry' and exists (select 1 from public.atlas_entries ae where ae.id::text = (storage.foldername(name))[2] and ae.created_by = auth.uid() and ae.status in ('draft', 'submitted')))
      )
    )
  )
);
