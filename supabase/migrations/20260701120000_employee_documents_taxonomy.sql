-- Employee Documents Repository: categorize into Employment vs Personal Details,
-- add an approval workflow (for employee-portal uploads) and keep the existing
-- signed/signature columns for Aadhaar eSign.
--
--   doc_group        'employment' | 'personal'
--   doc_type         subtype slug (see src/lib/employeeDocuments.ts)
--   approval_status  'approved' | 'pending' | 'rejected'  (portal uploads start 'pending')
--   uploaded_via     'admin' | 'portal'
--   approved_by/at   who cleared a pending personal doc; rejection_reason on reject

alter table public.documents
  add column if not exists doc_group text,
  add column if not exists doc_type text,
  add column if not exists approval_status text not null default 'approved',
  add column if not exists uploaded_via text not null default 'admin',
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text;

do $$ begin
  alter table public.documents add constraint documents_doc_group_check
    check (doc_group is null or doc_group in ('employment','personal'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.documents add constraint documents_approval_status_check
    check (approval_status in ('approved','pending','rejected'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.documents add constraint documents_uploaded_via_check
    check (uploaded_via in ('admin','portal'));
exception when duplicate_object then null; end $$;

-- Best-effort backfill for existing employee documents (all legacy rows are personal).
update public.documents
   set doc_group = 'personal',
       doc_type = case
         when category ilike '%aadhaar%' or category ilike '%pan%' or category ilike '%passport%'
              or category ilike '%voter%' or category ilike '%licence%' or category ilike '%license%' then 'id_proof'
         when category ilike '%educat%' or category ilike '%degree%' or category ilike '%marksheet%' or category ilike '%certificate%' then 'education_certificate'
         when category ilike '%address%' then 'address_proof'
         when category ilike '%medical%' then 'medical_certificate'
         else 'other'
       end,
       approval_status = coalesce(approval_status, 'approved'),
       uploaded_via = coalesce(uploaded_via, 'admin')
 where entity_type = 'employee' and doc_group is null;

create index if not exists documents_group_status_idx on public.documents (entity_type, entity_ref, doc_group, approval_status);

-- RLS: an authenticated owner (an employee with a Supabase Auth account) may still
-- read/manage their own docs, but must NOT be able to create Employment documents —
-- those are HR-only. Admins keep full access via documents_admin_all (is_doc_admin()).
drop policy if exists documents_owner_insert on public.documents;
create policy documents_owner_insert on public.documents
  for insert to authenticated
  with check (
    owns_employee_doc(entity_type, entity_ref)
    and coalesce(doc_group, 'personal') <> 'employment'
  );
