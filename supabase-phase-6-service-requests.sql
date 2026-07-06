
-- Tom's Garage Phase 6 Service Requests + Media Uploads
-- Run this in Supabase SQL Editor before uploading the Phase 6 files.

-- Service request table
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  request_type text not null,
  urgency text not null default 'Normal',
  title text not null,
  details text not null,
  status text not null default 'New' check (status in ('New', 'Reviewing', 'Scheduled', 'Complete', 'Denied')),
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_requests enable row level security;

drop policy if exists "service_requests_select_own_or_admin" on public.service_requests;
create policy "service_requests_select_own_or_admin"
on public.service_requests
for select
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "service_requests_insert_own_or_admin" on public.service_requests;
create policy "service_requests_insert_own_or_admin"
on public.service_requests
for insert
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "service_requests_update_own_or_admin" on public.service_requests;
create policy "service_requests_update_own_or_admin"
on public.service_requests
for update
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "service_requests_delete_owner_only" on public.service_requests;
create policy "service_requests_delete_owner_only"
on public.service_requests
for delete
using (public.is_owner());

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_service_requests_updated_at on public.service_requests;
create trigger set_service_requests_updated_at
before update on public.service_requests
for each row execute procedure public.set_updated_at();

-- Storage bucket for service request media.
-- Private bucket. Links are created as signed URLs from the portal/admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-media',
  'service-media',
  false,
  104857600,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 104857600,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']::text[];

-- Storage RLS policies.
-- File path convention: user_id/request_id/file-name
-- Customers can manage files inside their own user_id folder.
-- Admin/owner/tech can view all service media.

drop policy if exists "service_media_select_own_or_admin" on storage.objects;
create policy "service_media_select_own_or_admin"
on storage.objects
for select
using (
  bucket_id = 'service-media'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists "service_media_insert_own_folder" on storage.objects;
create policy "service_media_insert_own_folder"
on storage.objects
for insert
with check (
  bucket_id = 'service-media'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "service_media_update_own_or_admin" on storage.objects;
create policy "service_media_update_own_or_admin"
on storage.objects
for update
using (
  bucket_id = 'service-media'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.is_admin()
  )
)
with check (
  bucket_id = 'service-media'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists "service_media_delete_own_or_admin" on storage.objects;
create policy "service_media_delete_own_or_admin"
on storage.objects
for delete
using (
  bucket_id = 'service-media'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.is_admin()
  )
);
