-- 20260616062401_create_document_signatures
-- (exported from the live Supabase migration history)

-- Audit log of Aadhaar-OTP eSign events. One row per signed document.
create table if not exists public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  document_ref text not null,
  document_name text,
  document_category text,
  source text,                       -- where the doc lives: employee, work_location, establishment, ...
  signer_name text,
  signer_employee_id text,
  signed_by uuid,                    -- auth.users id of the operator, when known
  aadhaar_last4 text,
  transaction_id text,
  signature_hash text,
  signed_at text,                    -- human-readable signing timestamp shown in the UI
  signed_timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.document_signatures is 'Audit trail of Aadhaar-OTP digital signatures applied to uploaded documents.';
create index if not exists document_signatures_document_ref_idx on public.document_signatures(document_ref);
create index if not exists document_signatures_source_idx on public.document_signatures(source);

alter table public.document_signatures enable row level security;
create policy document_signatures_authenticated_all
  on public.document_signatures for all to authenticated using (true) with check (true);
