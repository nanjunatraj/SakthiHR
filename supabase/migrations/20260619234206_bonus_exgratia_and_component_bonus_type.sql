alter table pf_esi_config add column if not exists bonus_exgratia_enabled boolean not null default false;

alter table pf_esi_config add column if not exists bonus_exgratia_percentage numeric not null default 8.33;

alter table salary_components add column if not exists bonus_type text not null default 'none';

alter table salary_components drop constraint if exists salary_components_bonus_type_check;

alter table salary_components add constraint salary_components_bonus_type_check check (bonus_type = any (array['none','bonus','exgratia']));
