-- 20260618164429_attendance_records_add_approval_status
-- (exported from the live Supabase migration history)

alter table attendance_records add column if not exists approval_status text not null default 'Draft';
alter table attendance_records drop constraint if exists attendance_records_approval_status_check;
alter table attendance_records add constraint attendance_records_approval_status_check
  check (approval_status = any (array['Draft','Submitted','Approved']));
