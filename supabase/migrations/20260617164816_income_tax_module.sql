-- 20260617164816_income_tax_module
-- (exported from the live Supabase migration history)

-- Per-employee tax regime (statutory default is the New regime)
alter table public.employees
  add column if not exists tax_regime text not null default 'New';   -- New | Old

-- Flag the salary component that carries the auto-computed income tax / TDS
alter table public.salary_components
  add column if not exists is_income_tax boolean not null default false;

-- tds_slabs realtime (idempotent) so the slab CRUD list refreshes everywhere
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.tds_slabs'; exception when duplicate_object then null; end;
end $$;
