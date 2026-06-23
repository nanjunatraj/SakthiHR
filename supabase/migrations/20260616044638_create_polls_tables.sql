-- 20260616044638_create_polls_tables
-- (exported from the live Supabase migration history)

-- Polls authored by HR, votable by employees in the Self-Service portal.
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type text not null default 'single' check (type in ('single','multiple','rating','text')),
  status text not null default 'Active' check (status in ('Active','Closed','Scheduled','Draft')),
  is_anonymous boolean not null default false,
  start_date date,
  end_date date,
  end_time text,
  total_recipients integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.polls is 'Employee engagement polls authored by HR and answered in the Self-Service portal.';

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.poll_options is 'Selectable options for a poll (single/multiple choice).';
create index if not exists poll_options_poll_id_idx on public.poll_options(poll_id);

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid references public.poll_options(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  rating integer,
  text_response text,
  created_at timestamptz not null default now()
);
comment on table public.poll_votes is 'One row per option chosen by an employee (or per rating/text response).';
create index if not exists poll_votes_poll_id_idx on public.poll_votes(poll_id);
create index if not exists poll_votes_employee_id_idx on public.poll_votes(employee_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create policy polls_authenticated_all on public.polls for all to authenticated using (true) with check (true);
create policy poll_options_authenticated_all on public.poll_options for all to authenticated using (true) with check (true);
create policy poll_votes_authenticated_all on public.poll_votes for all to authenticated using (true) with check (true);
