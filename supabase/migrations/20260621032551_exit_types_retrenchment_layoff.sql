-- 20260621032551_exit_types_retrenchment_layoff
-- Allow Retrenchment and Layoff as employee separation (exit) types.

alter table employee_exits drop constraint if exists employee_exits_exit_type_check;
alter table employee_exits add constraint employee_exits_exit_type_check
  check (exit_type = any (array['Resignation','Termination','Retirement','Absconding','End of Contract','Death','Retrenchment','Layoff']));
