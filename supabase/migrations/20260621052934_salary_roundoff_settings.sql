-- 20260621052934_salary_roundoff_settings
-- Per-component round-off (Salary Component definition) and net-take-home round-off
-- (Establishment Master). Codes: none | nearest_1 | nearest_10 | nearest_100.
-- Defaults preserve current behaviour (components nearest ₹1, net nearest ₹100).

alter table salary_components add column if not exists round_off text not null default 'nearest_1';
alter table establishment add column if not exists net_roundoff text not null default 'nearest_100';
