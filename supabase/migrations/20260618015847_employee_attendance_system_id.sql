-- 20260618015847_employee_attendance_system_id
-- (exported from the live Supabase migration history)

alter table public.employees add column if not exists attendance_system_id text;

create unique index if not exists employees_attendance_system_id_unique
  on public.employees (attendance_system_id)
  where attendance_system_id is not null;

comment on column public.employees.attendance_system_id is
  'Device/biometric enrollment ID used to map attendance-system punch logs to this employee.';
