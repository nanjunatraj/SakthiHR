-- 20260617081905_create_user_dashboard_preferences
-- (exported from the live Supabase migration history)

create table if not exists public.user_dashboard_preferences (
  user_id uuid primary key default auth.uid(),
  hidden_widgets text[] not null default '{}',
  updated_at timestamptz not null default now()
);
comment on table public.user_dashboard_preferences is 'Per-user dashboard widget visibility preferences (HRMS Dashboard customization).';

alter table public.user_dashboard_preferences enable row level security;

drop policy if exists "own_dashboard_prefs" on public.user_dashboard_preferences;
create policy "own_dashboard_prefs" on public.user_dashboard_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
