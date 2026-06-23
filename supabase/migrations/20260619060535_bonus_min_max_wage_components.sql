-- 20260619060535_bonus_min_max_wage_components
-- (exported from the live Supabase migration history)

alter table pf_esi_config add column if not exists bonus_min_percentage numeric not null default 8.33;
alter table pf_esi_config add column if not exists bonus_max_percentage numeric not null default 20;
alter table pf_esi_config add column if not exists bonus_wage_components jsonb not null default '[]'::jsonb;
