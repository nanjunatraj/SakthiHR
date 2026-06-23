-- 20260617161044_loan_module_approval_config
-- (exported from the live Supabase migration history)

-- Per-loan-type approval workflow (limits already exist: max_amount, max_tenure_months, eligibility_months, max_amount_multiplier)
alter table public.loan_types
  add column if not exists approval_workflow text not null default 'SingleHR';  -- SingleHR | TwoStage | AutoWithinLimits

-- Two-stage approval bookkeeping on loans (mirrors loan_emi_skip_requests)
alter table public.loans
  add column if not exists manager_status text not null default 'Pending',  -- Pending | Approved | Rejected | NA
  add column if not exists manager_id uuid references public.employees(id),
  add column if not exists manager_acted_on timestamptz,
  add column if not exists manager_remarks text,
  add column if not exists hr_status text not null default 'Pending',
  add column if not exists hr_id uuid references public.employees(id),
  add column if not exists hr_acted_on timestamptz,
  add column if not exists hr_remarks text,
  add column if not exists auto_approved boolean not null default false;

-- Realtime for the loan tables that the UI lists (idempotent)
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.loans'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.loan_types'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.loan_emi_schedule'; exception when duplicate_object then null; end;
end $$;
