-- 20260618172419_payroll_entries_add_ack
-- (exported from the live Supabase migration history)

alter table payroll_entries add column if not exists employee_acknowledged boolean not null default false;
alter table payroll_entries add column if not exists employee_acknowledged_at timestamptz;
