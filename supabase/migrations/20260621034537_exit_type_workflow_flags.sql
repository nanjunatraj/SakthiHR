-- 20260621034537_exit_type_workflow_flags
-- Per-type separation workflow state: issued-letter flags (show-cause, abandonment,
-- retirement notice, condolence) and the absconding report-back deadline.

alter table employee_exits add column if not exists step_flags jsonb not null default '{}'::jsonb;
alter table employee_exits add column if not exists report_deadline date;
