-- 20260617153422_add_professional_tax_module
-- (exported from the live Supabase migration history)

-- 1. Enable/disable Professional Tax deduction, configured in PF/ESI/NPS settings
alter table public.pf_esi_config
  add column if not exists professional_tax_enabled boolean not null default true;

-- 2. State-wise Professional Tax slabs
create table if not exists public.professional_tax_slabs (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  gender text not null default 'All',          -- All | Male | Female
  from_amount numeric not null default 0,        -- monthly gross (inclusive)
  to_amount numeric not null default 0,          -- monthly gross (inclusive); large value = "and above"
  monthly_amount numeric not null default 0,     -- PT deducted per month for this slab
  special_note text,                             -- e.g. "₹300 levied only in February"
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.professional_tax_slabs enable row level security;

drop policy if exists professional_tax_slabs_authenticated_all on public.professional_tax_slabs;
create policy professional_tax_slabs_authenticated_all
  on public.professional_tax_slabs for all
  to authenticated
  using (true) with check (true);

alter publication supabase_realtime add table public.professional_tax_slabs;
