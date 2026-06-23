-- 20260619051921_pf_esi_wage_components
-- (exported from the live Supabase migration history)

alter table pf_esi_config add column if not exists pf_wage_components jsonb not null default '[]'::jsonb;
alter table pf_esi_config add column if not exists esi_wage_components jsonb not null default '[]'::jsonb;
