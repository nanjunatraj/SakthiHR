-- 20260621123300_manager_first_level_approvals
-- Manager Dashboard: a manager (an employee with direct reports) acts as first-level
-- approver on their team's requests; HR still finalizes. Loans already carry manager_*
-- fields; add the same recommendation columns to leave_requests and reimbursement_claims.

alter table leave_requests add column if not exists manager_status text not null default 'Pending'; -- Pending | Approved | Rejected
alter table leave_requests add column if not exists manager_id uuid;
alter table leave_requests add column if not exists manager_acted_on timestamptz;
alter table leave_requests add column if not exists manager_remarks text;

alter table reimbursement_claims add column if not exists manager_status text not null default 'Pending';
alter table reimbursement_claims add column if not exists manager_id uuid;
alter table reimbursement_claims add column if not exists manager_acted_on timestamptz;
alter table reimbursement_claims add column if not exists manager_remarks text;

create index if not exists idx_leave_requests_mgr on leave_requests(manager_id, manager_status);
create index if not exists idx_reimbursement_claims_mgr on reimbursement_claims(manager_id, manager_status);
