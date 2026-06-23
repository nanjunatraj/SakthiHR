-- 20260622140000_payroll_linked_deduction_breakdown
-- Payroll run now recovers approved Deductions-module entries (Damages & Loss, Fines,
-- Canteen, Society, Donations/Campaign, Other Deductions) through the salary component
-- linked to each category (salary_components.deduction_source). The per-head amounts are
-- stored as a jsonb map on the payroll entry so the payslip can show each as its own line.

alter table payroll_entries add column if not exists deduction_breakdown jsonb;
