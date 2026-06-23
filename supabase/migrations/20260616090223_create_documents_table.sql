-- 20260616090223_create_documents_table
-- (exported from the live Supabase migration history)

-- Secure metadata for every uploaded document. Files live in the private
-- `documents` storage bucket; this row holds the path + signing state.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,            -- 'employee' | 'work_location' | 'establishment'
  entity_ref text not null,             -- employee code / location id / 'establishment'
  category text,                        -- the upload label (e.g. 'Aadhaar', 'PAN Card Copy')
  file_name text not null,
  file_path text not null,              -- object path inside the bucket
  bucket text not null default 'documents',
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  signed boolean not null default false,
  signature jsonb,                      -- SignatureData snapshot once signed
  created_at timestamptz not null default now()
);
comment on table public.documents is 'Metadata + signing state for files stored in the private documents bucket.';
create index if not exists documents_entity_idx on public.documents(entity_type, entity_ref);
create index if not exists documents_category_idx on public.documents(entity_type, entity_ref, category);

alter table public.documents enable row level security;
create policy documents_authenticated_all on public.documents
  for all to authenticated using (true) with check (true);
