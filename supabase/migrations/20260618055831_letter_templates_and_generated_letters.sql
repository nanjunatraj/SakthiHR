-- 20260618055831_letter_templates_and_generated_letters
-- (exported from the live Supabase migration history)

create table if not exists public.letter_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  subject text,
  body text not null default '',
  use_letterhead boolean not null default true,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.letter_templates enable row level security;
drop policy if exists "authenticated all letter_templates" on public.letter_templates;
create policy "authenticated all letter_templates" on public.letter_templates
  for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.letter_templates;

create table if not exists public.generated_letters (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.letter_templates(id) on delete set null,
  employee_id uuid references public.employees(id) on delete cascade,
  category text not null,
  title text not null default '',
  body_html text not null default '',
  use_letterhead boolean not null default true,
  ref_no text,
  status text not null default 'Draft',
  sent_at timestamptz,
  acknowledged_at timestamptz,
  signature jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.generated_letters enable row level security;
drop policy if exists "authenticated all generated_letters" on public.generated_letters;
create policy "authenticated all generated_letters" on public.generated_letters
  for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.generated_letters;
