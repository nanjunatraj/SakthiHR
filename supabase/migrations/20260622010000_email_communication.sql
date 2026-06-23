-- 20260622010000_email_communication
-- Email Communication module. Establishment holds the SMTP config (host/port/secure/
-- username/from + the password, per project decision — read server-side by the Edge
-- Function via service role). email_deliveries logs one row per recipient per document
-- with a tracking token + status that advances Sent -> Opened -> Viewed -> Confirmed
-- as the employee opens the mail (pixel), opens the attachment (tracked link) and
-- confirms receipt (tracked link). Mirrors the whatsapp_notifications conventions.

-- ── Establishment SMTP / email config ───────────────────────────────────────────
alter table establishment add column if not exists email_enabled boolean not null default false;
alter table establishment add column if not exists email_provider text not null default 'smtp'; -- 'smtp' | 'off'
alter table establishment add column if not exists email_host text;
alter table establishment add column if not exists email_port integer;
alter table establishment add column if not exists email_secure boolean not null default true;   -- TLS/SSL
alter table establishment add column if not exists email_username text;
alter table establishment add column if not exists email_password text;                          -- stored per decision; read server-side only
alter table establishment add column if not exists email_from_name text;
alter table establishment add column if not exists email_from_address text;
alter table establishment add column if not exists email_reply_to text;

-- ── Per-recipient per-document delivery log + tracking ──────────────────────────
create table if not exists email_deliveries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete set null,
  to_email text,
  category text not null default 'general',     -- payslip | letter | report | notification
  document_title text,
  subject text,
  body_html text,
  doc_path text,                                -- path in the 'documents' storage bucket (nullable)
  token text not null unique,                   -- tracking key used by the open/doc/confirm links
  status text not null default 'Queued',        -- Queued|Sent|Opened|Viewed|Confirmed|Failed|Bounced|Simulated|No Email
  provider text not null default 'sim',         -- 'sim' | 'smtp'
  sent_at timestamptz,
  opened_at timestamptz,
  doc_opened_at timestamptz,
  confirmed_at timestamptz,
  message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_deliveries_token on email_deliveries(token);
create index if not exists idx_email_deliveries_employee on email_deliveries(employee_id, created_at desc);
create index if not exists idx_email_deliveries_category on email_deliveries(category, created_at desc);

alter table email_deliveries enable row level security;

do $$ begin
  create policy email_deliveries_all on email_deliveries for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table email_deliveries;
exception when duplicate_object then null; end $$;

-- Allow the print-ready HTML document to be stored in the 'documents' bucket (for the
-- email attachment + the tracked view/download link).
update storage.buckets
set allowed_mime_types = array(select distinct unnest(allowed_mime_types || array['text/html','text/plain']))
where id = 'documents';
