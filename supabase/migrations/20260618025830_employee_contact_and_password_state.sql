-- 20260618025830_employee_contact_and_password_state
-- (exported from the live Supabase migration history)

-- Employee contact fields (needed for WhatsApp notifications)
alter table public.employees add column if not exists mobile_number text;
alter table public.employees add column if not exists email text;

-- Password lifecycle state on the User Master record
alter table public.system_users add column if not exists must_change_password boolean not null default false;
alter table public.system_users add column if not exists password_changed_at timestamptz;

-- WhatsApp notification audit log (simulated send is recorded here)
create table if not exists public.whatsapp_notifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  to_phone text,
  category text not null default 'general',
  message text not null,
  status text not null default 'Sent',
  created_at timestamptz not null default now()
);
alter table public.whatsapp_notifications enable row level security;
drop policy if exists "authenticated all whatsapp_notifications" on public.whatsapp_notifications;
create policy "authenticated all whatsapp_notifications" on public.whatsapp_notifications
  for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.whatsapp_notifications;
