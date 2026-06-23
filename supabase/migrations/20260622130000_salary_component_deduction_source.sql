-- 20260622130000_salary_component_deduction_source
-- Salary Component Master: link a deduction component to a Deductions-module category
-- (loan-advances | damages-loss | fines | canteen | society | donations | other-deductions)
-- so entries of that category are recovered through the linked component head in payroll.
-- NULL = not linked.

alter table salary_components add column if not exists deduction_source text;
