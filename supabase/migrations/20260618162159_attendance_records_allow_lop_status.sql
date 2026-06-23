-- 20260618162159_attendance_records_allow_lop_status
-- (exported from the live Supabase migration history)

alter table attendance_records drop constraint if exists attendance_records_status_check;
alter table attendance_records add constraint attendance_records_status_check
  check (status = any (array['Present','Absent','Late','Half Day','On Leave','Holiday','Weekend','LOP']));
