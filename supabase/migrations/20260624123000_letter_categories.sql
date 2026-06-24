-- 20260624123000_letter_categories
-- Custom (user-defined) letter/template CATEGORIES, grouped under an HR activity.
-- Built-in categories stay in code (LETTER_CATEGORIES + CATEGORY_GROUPS); this table
-- only holds the extra categories HR adds against any activity. Templates and model
-- formats reference categories by their `key`, so custom keys work everywhere.

create table if not exists public.letter_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  activity text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.letter_categories enable row level security;
drop policy if exists "authenticated all letter_categories" on public.letter_categories;
create policy "authenticated all letter_categories" on public.letter_categories
  for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.letter_categories;
