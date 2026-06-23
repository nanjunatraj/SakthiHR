-- 20260618000725_leave_type_negative_override
-- (exported from the live Supabase migration history)

-- Allow a leave type to go into negative balance (overdraft) and/or be overridden
-- beyond its configured annual limit when applying leave.
alter table public.leave_types
  add column if not exists allow_negative_balance boolean not null default false,
  add column if not exists max_negative_balance numeric not null default 0,
  add column if not exists allow_override boolean not null default false;
