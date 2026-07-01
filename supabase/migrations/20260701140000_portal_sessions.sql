-- Durable Employee Self-Service portal sessions. ESS employees have no Supabase
-- session (they authenticate via verify_login), so we issue an opaque token on
-- login, stored client-side, and validated server-side by the employee-portal
-- edge function. Lets the portal survive a page refresh without holding the
-- employee's password.
create table if not exists public.portal_sessions (
  token text primary key,
  system_user_id uuid not null,
  login_id text not null,
  employee_id uuid,
  employee_code text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create index if not exists portal_sessions_expires_idx on public.portal_sessions (expires_at);

-- RLS on, no policies: only the service role (edge function) may read/write. anon
-- and authenticated get nothing directly.
alter table public.portal_sessions enable row level security;
grant all on public.portal_sessions to service_role;
