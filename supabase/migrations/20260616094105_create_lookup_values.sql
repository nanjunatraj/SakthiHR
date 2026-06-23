-- 20260616094105_create_lookup_values
-- (exported from the live Supabase migration history)

-- Generic lookup/reference table: every former hardcoded enum lives here, keyed
-- by category. metadata holds any extra per-option attributes (colors, etc.).
create table if not exists public.lookup_values (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  code text,
  label text not null,
  sort_order integer not null default 0,
  metadata jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.lookup_values is 'Centralised lookup/enumeration values (replaces hardcoded option arrays). Filter by category.';
create index if not exists lookup_values_category_idx on public.lookup_values(category, sort_order);

alter table public.lookup_values enable row level security;
create policy lookup_values_authenticated_all on public.lookup_values
  for all to authenticated using (true) with check (true);

-- Seed: shift-master enums (more categories seeded as each form is migrated).
insert into public.lookup_values (category, code, label, sort_order, metadata)
select 'shift_category', v, v, ord, null
from unnest(array['General','Morning','Afternoon','Night','Rotational','Flexible']) with ordinality as t(v, ord);

insert into public.lookup_values (category, code, label, sort_order)
select 'overtime_policy', v, v, ord
from unnest(array['None','After Shift Hours','After Daily Limit','After Weekly Limit']) with ordinality as t(v, ord);

insert into public.lookup_values (category, code, label, sort_order, metadata) values
  ('weekday','1','Monday',1,'{"short":"Mon"}'),
  ('weekday','2','Tuesday',2,'{"short":"Tue"}'),
  ('weekday','3','Wednesday',3,'{"short":"Wed"}'),
  ('weekday','4','Thursday',4,'{"short":"Thu"}'),
  ('weekday','5','Friday',5,'{"short":"Fri"}'),
  ('weekday','6','Saturday',6,'{"short":"Sat"}'),
  ('weekday','0','Sunday',7,'{"short":"Sun"}');

insert into public.lookup_values (category, code, label, sort_order, metadata) values
  ('ui_color','blue','Blue',1,'{"bg":"bg-blue-100","text":"text-blue-700","border":"border-blue-200","dot":"bg-blue-500"}'),
  ('ui_color','emerald','Green',2,'{"bg":"bg-emerald-100","text":"text-emerald-700","border":"border-emerald-200","dot":"bg-emerald-500"}'),
  ('ui_color','violet','Purple',3,'{"bg":"bg-violet-100","text":"text-violet-700","border":"border-violet-200","dot":"bg-violet-500"}'),
  ('ui_color','amber','Amber',4,'{"bg":"bg-amber-100","text":"text-amber-700","border":"border-amber-200","dot":"bg-amber-500"}'),
  ('ui_color','rose','Rose',5,'{"bg":"bg-rose-100","text":"text-rose-700","border":"border-rose-200","dot":"bg-rose-500"}'),
  ('ui_color','cyan','Cyan',6,'{"bg":"bg-cyan-100","text":"text-cyan-700","border":"border-cyan-200","dot":"bg-cyan-500"}'),
  ('ui_color','orange','Orange',7,'{"bg":"bg-orange-100","text":"text-orange-700","border":"border-orange-200","dot":"bg-orange-500"}'),
  ('ui_color','indigo','Indigo',8,'{"bg":"bg-indigo-100","text":"text-indigo-700","border":"border-indigo-200","dot":"bg-indigo-500"}');
