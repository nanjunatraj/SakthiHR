-- ============================================================
-- SakthiHR HRMS & Payroll — Database DDL (public schema)
-- Generated from the live Supabase database
-- Tables: 72  |  Constraints: 243  |  Indexes: 122
-- (reimbursement_claims + salary_components.is_reimbursement/bonus_type added 2026-06-20)
-- (employee_exits + exit_clearances + exit_settlements + employees.relieving_date added 2026-06-20)
-- (2026-06-21: exit_approvals + employee_exits.submitted_by/notice_waived/acceptance_issued/step_flags/report_deadline;
--  exit_type CHECK extended (Retrenchment/Layoff); letter_templates.language;
--  salary_revisions + salary_revision_items; employee_salary_assignments.updated_at;
--  salary_components.round_off; establishment.net_roundoff)
-- (2026-06-21: WhatsApp Cloud API — establishment.wa_* config columns;
--  whatsapp_notifications.wamid/provider/status_at/error; `whatsapp` edge function)
-- (2026-06-21: WhatsApp Web provider — establishment.wa_provider/wa_web_service_url/
--  wa_web_api_key; companion service in server/whatsapp-web)
-- (2026-06-21: Salary Revision arrears — salary_components.is_arrears;
--  payroll_entries.arrears; salary_revision_arrears table)
-- (2026-06-21: Manager Dashboard — leave_requests + reimbursement_claims gained
--  manager_status/manager_id/manager_acted_on/manager_remarks (first-level approval))
-- ============================================================

-- =================== TABLES ===================

CREATE TABLE asset_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,
  employee_id uuid,
  action text NOT NULL,
  on_date date NOT NULL DEFAULT CURRENT_DATE,
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE asset_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  description text,
  status text NOT NULL DEFAULT 'Active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  category_id uuid,
  name text NOT NULL,
  make_model text,
  serial_number text,
  status text NOT NULL DEFAULT 'Available'::text,
  condition text,
  purchase_date date,
  purchase_cost numeric,
  mobile_number text,
  allocated_to uuid,
  allocated_on date,
  remarks text,
  specifications jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE attendance_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  attendance_date date NOT NULL,
  check_in time without time zone,
  check_out time without time zone,
  hours_worked numeric(5,2) NOT NULL DEFAULT 0,
  overtime_hours numeric(5,2) NOT NULL DEFAULT 0,
  status text NOT NULL,
  shift_id uuid,
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  approval_status text NOT NULL DEFAULT 'Draft'::text
);

CREATE TABLE deduction_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid,
  category text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  payroll_period_id uuid,
  reference_no text,
  remarks text,
  status text NOT NULL DEFAULT 'Draft'::text,
  approved_by text,
  approved_at timestamp with time zone,
  employee_approval_required boolean NOT NULL DEFAULT false,
  employee_approval_status text,
  employee_approval_at timestamp with time zone,
  employee_rejection_reason text,
  notification_sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  parent_id uuid,
  location_id uuid NOT NULL,
  head_name text,
  employee_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE designations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  description text,
  level integer NOT NULL DEFAULT 1,
  department text,
  status text NOT NULL DEFAULT 'Active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE document_signatures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_ref text NOT NULL,
  document_name text,
  document_category text,
  source text,
  signer_name text,
  signer_employee_id text,
  signed_by uuid,
  aadhaar_last4 text,
  transaction_id text,
  signature_hash text,
  signed_at text,
  signed_timestamp timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_ref text NOT NULL,
  category text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  bucket text NOT NULL DEFAULT 'documents'::text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  signed boolean NOT NULL DEFAULT false,
  signature jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employee_bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  ifsc_code text NOT NULL,
  branch_name text,
  branch_address text,
  account_type text NOT NULL DEFAULT 'Savings'::text,
  is_primary boolean NOT NULL DEFAULT false,
  swift_code text,
  micr_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employee_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'Active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employee_classifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  description text,
  status text NOT NULL DEFAULT 'Active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employee_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  document_category text NOT NULL,
  document_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  description text,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employee_education (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  qualification text NOT NULL,
  specialization text,
  institution text,
  university text,
  year_of_passing text,
  percentage text,
  grade text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employee_family (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  relationship text NOT NULL,
  name text NOT NULL,
  date_of_birth date,
  gender text,
  occupation text,
  phone text,
  is_dependent boolean NOT NULL DEFAULT false,
  is_nominee boolean NOT NULL DEFAULT false,
  nomination_percentage numeric(5,2) NOT NULL DEFAULT 0,
  nomination_purpose text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employee_grades (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  description text,
  grade_level integer NOT NULL DEFAULT 1,
  min_salary numeric(15,2) NOT NULL DEFAULT 0,
  max_salary numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employee_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  description text,
  group_type text NOT NULL DEFAULT 'Payroll'::text,
  status text NOT NULL DEFAULT 'Active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employee_languages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  language text NOT NULL,
  speak_level text NOT NULL DEFAULT 'None'::text,
  read_level text NOT NULL DEFAULT 'None'::text,
  write_level text NOT NULL DEFAULT 'None'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employee_salary_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  salary_structure_id uuid NOT NULL,
  ctc_annual numeric(15,2) NOT NULL DEFAULT 0,
  ctc_monthly numeric(15,2) NOT NULL DEFAULT 0,
  effective_from date NOT NULL,
  effective_to date,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  component_values jsonb,
  statutory_overrides jsonb,
  vpf_percentage numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employee_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  description text,
  parent_section text,
  status text NOT NULL DEFAULT 'Active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employee_statutory (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  pan_no text,
  aadhar_no text,
  uan_no text,
  pf_account_no text,
  esi_no text,
  passport_no text,
  passport_expiry date,
  driving_license_no text,
  driving_license_expiry date,
  voter_id_no text,
  ration_card_no text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employee_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  description text,
  is_contractual boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'Active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employee_work_experience (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  company_name text NOT NULL,
  designation text,
  department text,
  from_date date,
  to_date date,
  years_of_experience integer NOT NULL DEFAULT 0,
  months_of_experience integer NOT NULL DEFAULT 0,
  reason_for_leaving text,
  last_salary text,
  reference_name text,
  reference_designation text,
  reference_phone text,
  reference_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE employees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  current_employee_id text,
  service_book_no text,
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  father_name text,
  mother_name text,
  date_of_birth date,
  place_of_birth text,
  nationality text NOT NULL DEFAULT 'Indian'::text,
  identification_marks text,
  gender text,
  marital_status text,
  blood_group text,
  religion text,
  caste text,
  mother_tongue text,
  photo_url text,
  signature_url text,
  thumb_impression_url text,
  present_address_line1 text,
  present_address_line2 text,
  present_city text,
  present_district text,
  present_state text,
  present_pincode text,
  present_country text NOT NULL DEFAULT 'India'::text,
  permanent_address_line1 text,
  permanent_address_line2 text,
  permanent_city text,
  permanent_district text,
  permanent_state text,
  permanent_pincode text,
  permanent_country text NOT NULL DEFAULT 'India'::text,
  same_address boolean NOT NULL DEFAULT false,
  date_of_joining date,
  date_of_confirmation date,
  probation_period_months integer NOT NULL DEFAULT 6,
  designation_id uuid,
  department_id uuid,
  section text,
  grade_id uuid,
  employee_type_id uuid,
  employee_category_id uuid,
  employee_group_id uuid,
  work_location_id uuid,
  shift_id uuid,
  reporting_manager_id uuid,
  notice_period_days integer NOT NULL DEFAULT 30,
  offer_letter_validity_days integer NOT NULL DEFAULT 30,
  total_experience_years integer NOT NULL DEFAULT 0,
  total_experience_months integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  employee_classification text,
  tax_regime text NOT NULL DEFAULT 'New'::text,
  attendance_system_id text,
  mobile_number text,
  email text,
  anniversary_date date,
  relieving_date date
);

CREATE TABLE employee_exits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  exit_type text NOT NULL DEFAULT 'Resignation'::text,
  resignation_date date,
  last_working_day date,
  notice_days integer NOT NULL DEFAULT 0,
  notice_served boolean NOT NULL DEFAULT true,
  reason text,
  status text NOT NULL DEFAULT 'Initiated'::text,
  rehire_eligible boolean NOT NULL DEFAULT true,
  remarks text,
  submitted_by text NOT NULL DEFAULT 'hr'::text,
  notice_waived boolean NOT NULL DEFAULT false,
  acceptance_issued boolean NOT NULL DEFAULT false,
  step_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_deadline date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
  -- exit_type CHECK allows Resignation/Termination/Retirement/Absconding/End of Contract/Death/Retrenchment/Layoff
);

CREATE TABLE exit_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exit_id uuid NOT NULL,
  level integer NOT NULL DEFAULT 1,
  role text,
  approver_employee_id uuid,
  approver_name text,
  status text NOT NULL DEFAULT 'Pending'::text,
  remarks text,
  acted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE exit_clearances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exit_id uuid NOT NULL,
  department text NOT NULL,
  status text NOT NULL DEFAULT 'Pending'::text,
  remarks text,
  cleared_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE exit_settlements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exit_id uuid NOT NULL,
  pending_salary numeric NOT NULL DEFAULT 0,
  leave_encash_days numeric NOT NULL DEFAULT 0,
  leave_encash_amount numeric NOT NULL DEFAULT 0,
  gratuity_amount numeric NOT NULL DEFAULT 0,
  bonus_amount numeric NOT NULL DEFAULT 0,
  loan_recovery numeric NOT NULL DEFAULT 0,
  notice_recovery numeric NOT NULL DEFAULT 0,
  other_additions numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  net_settlement numeric NOT NULL DEFAULT 0,
  settled_on date,
  status text NOT NULL DEFAULT 'Draft'::text,
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE salary_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT ''::text,
  basis text NOT NULL DEFAULT 'CTC'::text,
  method text NOT NULL DEFAULT 'Percentage'::text,
  value numeric NOT NULL DEFAULT 0,
  payroll_period_id uuid,
  effective_from date,
  scope text NOT NULL DEFAULT 'all'::text,
  scope_ref jsonb,
  status text NOT NULL DEFAULT 'Proposed'::text,
  proposed_by text,
  approved_by text,
  approved_at timestamp with time zone,
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE salary_revision_arrears (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  period_id uuid,
  period_name text,
  paid_gross numeric NOT NULL DEFAULT 0,
  revised_gross numeric NOT NULL DEFAULT 0,
  arrears_amount numeric NOT NULL DEFAULT 0,
  target_period_id uuid,
  status text NOT NULL DEFAULT 'Pending'::text,
  paid_run_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE salary_revision_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  structure_id uuid,
  old_ctc_monthly numeric NOT NULL DEFAULT 0,
  old_gross numeric NOT NULL DEFAULT 0,
  old_net numeric NOT NULL DEFAULT 0,
  old_takehome numeric NOT NULL DEFAULT 0,
  new_ctc_monthly numeric NOT NULL DEFAULT 0,
  new_gross numeric NOT NULL DEFAULT 0,
  new_net numeric NOT NULL DEFAULT 0,
  new_takehome numeric NOT NULL DEFAULT 0,
  new_component_values jsonb,
  status text NOT NULL DEFAULT 'Pending'::text,
  applied_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE establishment (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text,
  incorporation_date date,
  industry_type text,
  entity_type text,
  website text,
  email text,
  phone text,
  currency_code text NOT NULL DEFAULT 'INR'::text,
  address_line1 text,
  address_line2 text,
  city text,
  district text,
  state text,
  pincode text,
  country text NOT NULL DEFAULT 'India'::text,
  logo_url text,
  occupier_name text,
  occupier_designation text,
  occupier_phone text,
  occupier_email text,
  occupier_address_line1 text,
  occupier_address_line2 text,
  occupier_city text,
  occupier_district text,
  occupier_state text,
  occupier_pincode text,
  manager_name text,
  manager_designation text,
  manager_phone text,
  manager_email text,
  manager_address_line1 text,
  manager_address_line2 text,
  manager_city text,
  manager_district text,
  manager_state text,
  manager_pincode text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  employee_id_pattern jsonb,
  net_roundoff text NOT NULL DEFAULT 'nearest_100'::text,
  wa_enabled boolean NOT NULL DEFAULT false,
  wa_phone_number_id text,
  wa_display_number text,
  wa_business_account_id text,
  wa_webhook_verify_token text,
  wa_provider text NOT NULL DEFAULT 'cloud'::text,
  wa_web_service_url text,
  wa_web_api_key text
);

CREATE TABLE generated_letters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  template_id uuid,
  employee_id uuid,
  category text NOT NULL,
  title text NOT NULL DEFAULT ''::text,
  body_html text NOT NULL DEFAULT ''::text,
  use_letterhead boolean NOT NULL DEFAULT true,
  ref_no text,
  status text NOT NULL DEFAULT 'Draft'::text,
  sent_at timestamp with time zone,
  acknowledged_at timestamp with time zone,
  signature jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE gratuity_settlements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  settlement_date date NOT NULL,
  years_of_service numeric NOT NULL DEFAULT 0,
  last_basic numeric NOT NULL DEFAULT 0,
  gratuity_amount numeric NOT NULL DEFAULT 0,
  formula text,
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE holiday_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  year integer NOT NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'Active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE holidays (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  holiday_list_id uuid NOT NULL,
  name text NOT NULL,
  holiday_date date NOT NULL,
  type text NOT NULL,
  description text,
  is_recurring boolean NOT NULL DEFAULT false,
  location text NOT NULL DEFAULT 'All'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_half_day boolean NOT NULL DEFAULT false,
  half_day_session text
);

CREATE TABLE leave_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  leave_type_id uuid NOT NULL,
  year integer NOT NULL,
  opening_balance numeric(6,2) NOT NULL DEFAULT 0,
  accrued numeric(6,2) NOT NULL DEFAULT 0,
  used numeric(6,2) NOT NULL DEFAULT 0,
  pending numeric(6,2) NOT NULL DEFAULT 0,
  encashed numeric(6,2) NOT NULL DEFAULT 0,
  lapsed numeric(6,2) NOT NULL DEFAULT 0,
  closing_balance numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE leave_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  description text,
  effective_from date,
  effective_to date,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE leave_policy_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  policy_id uuid,
  policy_name text NOT NULL,
  policy_code text,
  filter_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  allocated_employees jsonb NOT NULL DEFAULT '[]'::jsonb,
  effective_from date,
  effective_to date,
  status text NOT NULL DEFAULT 'Active'::text,
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE leave_policy_entitlements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL,
  leave_type_id uuid,
  leave_type_name text,
  leave_type_code text,
  leave_type_color text,
  days_per_year numeric NOT NULL DEFAULT 0,
  max_consecutive_days integer NOT NULL DEFAULT 0,
  min_days_per_application numeric NOT NULL DEFAULT 0,
  allow_half_day boolean NOT NULL DEFAULT true,
  advance_notice_days integer NOT NULL DEFAULT 0,
  accrual_frequency text NOT NULL DEFAULT 'Monthly'::text,
  accrual_days_per_cycle numeric NOT NULL DEFAULT 0,
  accrue_on_probation boolean NOT NULL DEFAULT true,
  waiting_period_days integer NOT NULL DEFAULT 0,
  carry_forward_policy text NOT NULL DEFAULT 'None'::text,
  max_carry_forward_days numeric NOT NULL DEFAULT 0,
  carry_forward_percentage numeric NOT NULL DEFAULT 0,
  carry_forward_expiry_months integer NOT NULL DEFAULT 0,
  encashment_policy text NOT NULL DEFAULT 'None'::text,
  max_encashment_days_per_year numeric NOT NULL DEFAULT 0,
  encashment_multiplier numeric NOT NULL DEFAULT 1,
  encashment_taxable boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE leave_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  leave_type_id uuid NOT NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  days numeric(5,2) NOT NULL,
  is_half_day boolean NOT NULL DEFAULT false,
  reason text,
  contact_during_leave text,
  handover_to text,
  status text NOT NULL DEFAULT 'Pending'::text,
  applied_on date NOT NULL DEFAULT CURRENT_DATE,
  approved_by uuid,
  approved_on timestamp with time zone,
  remarks text,
  manager_status text NOT NULL DEFAULT 'Pending'::text,
  manager_id uuid,
  manager_acted_on timestamp with time zone,
  manager_remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE leave_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  category text NOT NULL,
  color text NOT NULL DEFAULT 'blue'::text,
  description text,
  max_days_per_year numeric(5,2) NOT NULL DEFAULT 12,
  max_consecutive_days integer NOT NULL DEFAULT 3,
  min_days_per_application numeric(4,2) NOT NULL DEFAULT 0.5,
  allow_half_day boolean NOT NULL DEFAULT true,
  requires_documentation boolean NOT NULL DEFAULT false,
  documentation_after_days integer NOT NULL DEFAULT 0,
  advance_notice_days integer NOT NULL DEFAULT 1,
  is_paid boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  accrual_frequency text NOT NULL DEFAULT 'Monthly'::text,
  accrual_days_per_cycle numeric(5,2) NOT NULL DEFAULT 1,
  accrual_basis text NOT NULL DEFAULT 'Fixed'::text,
  max_accrual_per_year numeric(5,2) NOT NULL DEFAULT 12,
  accrual_start_month integer NOT NULL DEFAULT 1,
  accrual_waiting_period_days integer NOT NULL DEFAULT 0,
  accrue_on_probation boolean NOT NULL DEFAULT true,
  carry_forward_policy text NOT NULL DEFAULT 'None'::text,
  max_days_carry_forward numeric(5,2) NOT NULL DEFAULT 0,
  percentage_carry_forward numeric(5,2) NOT NULL DEFAULT 0,
  carry_forward_expiry_months integer NOT NULL DEFAULT 0,
  carry_forward_to_next_year boolean NOT NULL DEFAULT false,
  encashment_policy text NOT NULL DEFAULT 'None'::text,
  max_encashment_days_per_year numeric(5,2) NOT NULL DEFAULT 0,
  min_balance_after_encashment numeric(5,2) NOT NULL DEFAULT 0,
  encashment_multiplier numeric(4,2) NOT NULL DEFAULT 1,
  encashment_taxable boolean NOT NULL DEFAULT false,
  applicable_categories text[] NOT NULL DEFAULT ARRAY['All Employees'::text],
  gender_applicability text NOT NULL DEFAULT 'All'::text,
  min_service_months integer NOT NULL DEFAULT 0,
  applicable_to_contractors boolean NOT NULL DEFAULT false,
  applicable_to_part_time boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  allow_negative_balance boolean NOT NULL DEFAULT false,
  max_negative_balance numeric NOT NULL DEFAULT 0,
  allow_override boolean NOT NULL DEFAULT false
);

CREATE TABLE letter_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text NOT NULL,
  name text NOT NULL,
  subject text,
  body text NOT NULL DEFAULT ''::text,
  use_letterhead boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  language text NOT NULL DEFAULT 'English'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE letterheads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  paper_size text NOT NULL DEFAULT 'A4'::text,
  margin_top integer NOT NULL DEFAULT 20,
  margin_bottom integer NOT NULL DEFAULT 20,
  margin_left integer NOT NULL DEFAULT 25,
  margin_right integer NOT NULL DEFAULT 25,
  header_enabled boolean NOT NULL DEFAULT true,
  header_logo_url text,
  header_logo_position text NOT NULL DEFAULT 'left'::text,
  header_logo_size text NOT NULL DEFAULT 'md'::text,
  header_image_url text,
  header_image_height text NOT NULL DEFAULT 'md'::text,
  header_company_name text,
  header_company_name_size text NOT NULL DEFAULT 'xl'::text,
  header_company_name_align text NOT NULL DEFAULT 'center'::text,
  header_company_name_color text NOT NULL DEFAULT '#1e3a5f'::text,
  header_tagline text,
  header_tagline_alignment text NOT NULL DEFAULT 'center'::text,
  header_tagline_color text NOT NULL DEFAULT '#6b7280'::text,
  header_address_line text,
  header_address_alignment text NOT NULL DEFAULT 'center'::text,
  header_contact_line text,
  header_contact_alignment text NOT NULL DEFAULT 'center'::text,
  header_website_line text,
  header_website_alignment text NOT NULL DEFAULT 'center'::text,
  header_divider_enabled boolean NOT NULL DEFAULT true,
  header_divider_color text NOT NULL DEFAULT '#1e3a5f'::text,
  header_divider_thickness text NOT NULL DEFAULT 'medium'::text,
  header_bg_color text NOT NULL DEFAULT '#ffffff'::text,
  header_custom_html text,
  header_use_custom_html boolean NOT NULL DEFAULT false,
  footer_enabled boolean NOT NULL DEFAULT true,
  footer_image_url text,
  footer_image_height text NOT NULL DEFAULT 'sm'::text,
  footer_line1 text,
  footer_line1_alignment text NOT NULL DEFAULT 'center'::text,
  footer_line1_color text NOT NULL DEFAULT '#6b7280'::text,
  footer_line2 text,
  footer_line2_alignment text NOT NULL DEFAULT 'center'::text,
  footer_line2_color text NOT NULL DEFAULT '#6b7280'::text,
  footer_show_page_number boolean NOT NULL DEFAULT true,
  footer_page_number_align text NOT NULL DEFAULT 'right'::text,
  footer_divider_enabled boolean NOT NULL DEFAULT true,
  footer_divider_color text NOT NULL DEFAULT '#1e3a5f'::text,
  footer_divider_thickness text NOT NULL DEFAULT 'medium'::text,
  footer_bg_color text NOT NULL DEFAULT '#ffffff'::text,
  footer_custom_html text,
  footer_use_custom_html boolean NOT NULL DEFAULT false,
  use_for_payslip boolean NOT NULL DEFAULT true,
  use_for_offer_letter boolean NOT NULL DEFAULT true,
  use_for_memo boolean NOT NULL DEFAULT true,
  use_for_transfer_letter boolean NOT NULL DEFAULT true,
  use_for_experience_letter boolean NOT NULL DEFAULT true,
  use_for_relieving_letter boolean NOT NULL DEFAULT true,
  use_for_appointment_letter boolean NOT NULL DEFAULT true,
  use_for_warning_letter boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE loan_emi_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL,
  month_number integer NOT NULL,
  due_date date NOT NULL,
  emi_amount numeric(12,2) NOT NULL,
  principal_component numeric(12,2) NOT NULL DEFAULT 0,
  interest_component numeric(12,2) NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT false,
  paid_date date,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE loan_emi_skip_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL,
  employee_id uuid,
  payroll_period_id uuid,
  emi_month_number integer,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'Pending'::text,
  manager_status text NOT NULL DEFAULT 'Pending'::text,
  manager_id uuid,
  manager_acted_on timestamp with time zone,
  manager_remarks text,
  hr_status text NOT NULL DEFAULT 'Pending'::text,
  hr_id uuid,
  hr_acted_on timestamp with time zone,
  hr_remarks text,
  requested_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE loan_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  max_amount numeric(15,2) NOT NULL DEFAULT 0,
  max_tenure_months integer NOT NULL DEFAULT 12,
  interest_rate numeric(5,2) NOT NULL DEFAULT 0,
  is_interest_free boolean NOT NULL DEFAULT false,
  eligibility_months integer NOT NULL DEFAULT 6,
  max_amount_multiplier numeric(5,2) NOT NULL DEFAULT 2,
  deduction_head text NOT NULL DEFAULT 'Loan Recovery'::text,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  approval_workflow text NOT NULL DEFAULT 'SingleHR'::text
);

CREATE TABLE loans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  loan_type_id uuid NOT NULL,
  principal_amount numeric(15,2) NOT NULL,
  interest_rate numeric(5,2) NOT NULL DEFAULT 0,
  tenure_months integer NOT NULL,
  emi_amount numeric(12,2) NOT NULL DEFAULT 0,
  disbursed_date date,
  applied_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'Pending'::text,
  purpose text,
  paid_emis integer NOT NULL DEFAULT 0,
  outstanding_balance numeric(15,2) NOT NULL DEFAULT 0,
  approved_by uuid,
  approved_on timestamp with time zone,
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  manager_status text NOT NULL DEFAULT 'Pending'::text,
  manager_id uuid,
  manager_acted_on timestamp with time zone,
  manager_remarks text,
  hr_status text NOT NULL DEFAULT 'Pending'::text,
  hr_id uuid,
  hr_acted_on timestamp with time zone,
  hr_remarks text,
  auto_approved boolean NOT NULL DEFAULT false
);

CREATE TABLE location_bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  ifsc_code text NOT NULL,
  branch_name text,
  branch_address text,
  account_type text NOT NULL DEFAULT 'Current'::text,
  is_primary boolean NOT NULL DEFAULT false,
  swift_code text,
  micr_code text,
  status text NOT NULL DEFAULT 'Active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE location_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL,
  document_category text NOT NULL,
  document_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  description text,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE lookup_values (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text NOT NULL,
  code text,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE pay_heads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  type text NOT NULL,
  ledger_group text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE payroll_arrears (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payroll_period_id uuid NOT NULL,
  payroll_run_id uuid,
  employee_id uuid NOT NULL,
  previous_net numeric NOT NULL DEFAULT 0,
  revised_net numeric NOT NULL DEFAULT 0,
  arrears_amount numeric NOT NULL DEFAULT 0,
  breakdown jsonb,
  computed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE payroll_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  payroll_period_id uuid NOT NULL,
  basic_salary numeric(12,2) NOT NULL DEFAULT 0,
  hra numeric(12,2) NOT NULL DEFAULT 0,
  special_allowance numeric(12,2) NOT NULL DEFAULT 0,
  conveyance_allowance numeric(12,2) NOT NULL DEFAULT 0,
  medical_allowance numeric(12,2) NOT NULL DEFAULT 0,
  lta numeric(12,2) NOT NULL DEFAULT 0,
  other_earnings numeric(12,2) NOT NULL DEFAULT 0,
  arrears numeric(12,2) NOT NULL DEFAULT 0,
  gross_salary numeric(12,2) NOT NULL DEFAULT 0,
  pf_employee numeric(12,2) NOT NULL DEFAULT 0,
  esi_employee numeric(12,2) NOT NULL DEFAULT 0,
  professional_tax numeric(12,2) NOT NULL DEFAULT 0,
  tds numeric(12,2) NOT NULL DEFAULT 0,
  loan_emi numeric(12,2) NOT NULL DEFAULT 0,
  advance_recovery numeric(12,2) NOT NULL DEFAULT 0,
  other_deductions numeric(12,2) NOT NULL DEFAULT 0,
  total_deductions numeric(12,2) NOT NULL DEFAULT 0,
  net_salary numeric(12,2) NOT NULL DEFAULT 0,
  pf_employer numeric(12,2) NOT NULL DEFAULT 0,
  esi_employer numeric(12,2) NOT NULL DEFAULT 0,
  working_days integer NOT NULL DEFAULT 0,
  present_days numeric(5,2) NOT NULL DEFAULT 0,
  absent_days numeric(5,2) NOT NULL DEFAULT 0,
  leave_days numeric(5,2) NOT NULL DEFAULT 0,
  overtime_hours numeric(5,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Draft'::text,
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  employee_acknowledged boolean NOT NULL DEFAULT false,
  employee_acknowledged_at timestamp with time zone
);

CREATE TABLE payroll_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  financial_year text NOT NULL,
  frequency text NOT NULL DEFAULT 'Monthly'::text,
  from_date date NOT NULL,
  to_date date NOT NULL,
  payment_date date NOT NULL,
  status text NOT NULL DEFAULT 'Open'::text,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  closed_at timestamp with time zone,
  closed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE payroll_precheck_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payroll_period_id uuid NOT NULL,
  stage text NOT NULL,
  status text NOT NULL DEFAULT 'Open'::text,
  closed_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE payroll_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payroll_period_id uuid NOT NULL,
  run_date timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'Draft'::text,
  total_employees integer NOT NULL DEFAULT 0,
  total_gross numeric(15,2) NOT NULL DEFAULT 0,
  total_deductions numeric(15,2) NOT NULL DEFAULT 0,
  total_net numeric(15,2) NOT NULL DEFAULT 0,
  total_employer_pf numeric(15,2) NOT NULL DEFAULT 0,
  total_employer_esi numeric(15,2) NOT NULL DEFAULT 0,
  remarks text,
  processed_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  payment_status text NOT NULL DEFAULT 'Pending'::text,
  paid_at timestamp with time zone,
  payment_reference text,
  payment_mode text
);

CREATE TABLE pf_esi_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pf_enabled boolean NOT NULL DEFAULT true,
  pf_employee_rate numeric(5,2) NOT NULL DEFAULT 12,
  pf_employer_rate numeric(5,2) NOT NULL DEFAULT 12,
  pf_admin_charges numeric(5,2) NOT NULL DEFAULT 0.5,
  pf_edli_charges numeric(5,2) NOT NULL DEFAULT 0.5,
  pf_wage_ceiling numeric(10,2) NOT NULL DEFAULT 15000,
  pf_apply_on text NOT NULL DEFAULT 'Ceiling'::text,
  vpf_enabled boolean NOT NULL DEFAULT false,
  vpf_max_percentage numeric(5,2) NOT NULL DEFAULT 100,
  esi_enabled boolean NOT NULL DEFAULT true,
  esi_employee_rate numeric(5,2) NOT NULL DEFAULT 0.75,
  esi_employer_rate numeric(5,2) NOT NULL DEFAULT 3.25,
  esi_wage_ceiling numeric(10,2) NOT NULL DEFAULT 21000,
  nps_enabled boolean NOT NULL DEFAULT false,
  nps_employee_rate numeric(5,2) NOT NULL DEFAULT 10,
  nps_employer_rate numeric(5,2) NOT NULL DEFAULT 10,
  gratuity_enabled boolean NOT NULL DEFAULT true,
  gratuity_formula text NOT NULL DEFAULT '(Basic + DA) × 15/26 × Years of Service'::text,
  gratuity_min_years integer NOT NULL DEFAULT 5,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  professional_tax_enabled boolean NOT NULL DEFAULT true,
  bonus_enabled boolean NOT NULL DEFAULT false,
  bonus_percentage numeric NOT NULL DEFAULT 8.33,
  bonus_wage_ceiling numeric NOT NULL DEFAULT 7000,
  bonus_eligibility_limit numeric NOT NULL DEFAULT 21000,
  gratuity_accrual_enabled boolean NOT NULL DEFAULT true,
  pf_wage_components jsonb NOT NULL DEFAULT '[]'::jsonb,
  esi_wage_components jsonb NOT NULL DEFAULT '[]'::jsonb,
  bonus_min_percentage numeric NOT NULL DEFAULT 8.33,
  bonus_max_percentage numeric NOT NULL DEFAULT 20,
  bonus_wage_components jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE poll_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL,
  text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE poll_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL,
  option_id uuid,
  employee_id uuid,
  rating integer,
  text_response text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE polls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'single'::text,
  status text NOT NULL DEFAULT 'Active'::text,
  is_anonymous boolean NOT NULL DEFAULT false,
  start_date date,
  end_date date,
  end_time text,
  total_recipients integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE professional_tax_slabs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  state text NOT NULL,
  gender text NOT NULL DEFAULT 'All'::text,
  from_amount numeric NOT NULL DEFAULT 0,
  to_amount numeric NOT NULL DEFAULT 0,
  monthly_amount numeric NOT NULL DEFAULT 0,
  special_note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE salary_components (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  type text NOT NULL,
  calculation_basis text NOT NULL DEFAULT 'Fixed'::text,
  value numeric(10,4) NOT NULL DEFAULT 0,
  formula text,
  taxability text NOT NULL DEFAULT 'Fully Taxable'::text,
  pf_applicability text NOT NULL DEFAULT 'Not Applicable'::text,
  esi_applicability text NOT NULL DEFAULT 'Not Applicable'::text,
  is_active boolean NOT NULL DEFAULT true,
  is_system_defined boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_income_tax boolean NOT NULL DEFAULT false,
  statutory_type text NOT NULL DEFAULT 'none'::text,
  is_overtime boolean NOT NULL DEFAULT false,
  overtime_multiplier numeric NOT NULL DEFAULT 2,
  overtime_hours_per_month numeric NOT NULL DEFAULT 208,
  bonus_type text NOT NULL DEFAULT 'none'::text,
  is_reimbursement boolean NOT NULL DEFAULT false,
  round_off text NOT NULL DEFAULT 'nearest_1'::text,
  is_arrears boolean NOT NULL DEFAULT false
);

CREATE TABLE reimbursement_claims (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  payroll_period_id uuid,
  category text NOT NULL DEFAULT 'general'::text,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  has_bill boolean NOT NULL DEFAULT false,
  bill_reference text,
  reference_no text,
  raised_by text NOT NULL DEFAULT 'employee'::text,
  status text NOT NULL DEFAULT 'Pending'::text,
  verified_by text,
  verified_at timestamp with time zone,
  remarks text,
  rejection_reason text,
  salary_component_id uuid,
  manager_status text NOT NULL DEFAULT 'Pending'::text,
  manager_id uuid,
  manager_acted_on timestamp with time zone,
  manager_remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE salary_structure_components (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  salary_structure_id uuid NOT NULL,
  salary_component_id uuid NOT NULL,
  value numeric(10,4) NOT NULL DEFAULT 0,
  calculation_basis text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  value_type text NOT NULL DEFAULT 'fixed'::text,
  custom_values numeric[] NOT NULL DEFAULT '{}'::numeric[],
  selected_custom_value numeric NOT NULL DEFAULT 0,
  formula text
);

CREATE TABLE salary_structures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  applicable_to text[] NOT NULL DEFAULT ARRAY['All Employees'::text],
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  category text NOT NULL DEFAULT 'General'::text,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  break_duration_minutes integer NOT NULL DEFAULT 60,
  break_start_time time without time zone,
  break_end_time time without time zone,
  applicable_days integer[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
  grace_period_minutes integer NOT NULL DEFAULT 15,
  half_day_hours numeric(4,2) NOT NULL DEFAULT 4,
  minimum_hours_full_day numeric(4,2) NOT NULL DEFAULT 8,
  overtime_policy text NOT NULL DEFAULT 'After Shift Hours'::text,
  overtime_daily_limit_hours numeric(4,2) NOT NULL DEFAULT 9,
  overtime_weekly_limit_hours numeric(4,2) NOT NULL DEFAULT 45,
  overtime_multiplier numeric(4,2) NOT NULL DEFAULT 1.5,
  overtime_max_hours_per_day numeric(4,2) NOT NULL DEFAULT 3,
  overtime_requires_approval boolean NOT NULL DEFAULT true,
  description text,
  color text NOT NULL DEFAULT 'blue'::text,
  status text NOT NULL DEFAULT 'Active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  breaks jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE system_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  employee_id uuid,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  department text,
  role text NOT NULL DEFAULT 'Employee'::text,
  status text NOT NULL DEFAULT 'Active'::text,
  avatar text,
  last_login timestamp with time zone,
  two_factor_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  login_id text,
  password text,
  must_change_password boolean NOT NULL DEFAULT false,
  password_changed_at timestamp with time zone
);

CREATE TABLE tds_slabs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  financial_year text NOT NULL,
  regime text NOT NULL,
  gender text NOT NULL DEFAULT 'All'::text,
  from_amount numeric(15,2) NOT NULL,
  to_amount numeric(15,2) NOT NULL,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  surcharge_rate numeric(5,2) NOT NULL DEFAULT 0,
  cess_rate numeric(5,2) NOT NULL DEFAULT 4,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE user_dashboard_preferences (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  hidden_widgets text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE user_privileges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  system_user_id uuid NOT NULL,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_export boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE whatsapp_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid,
  to_phone text,
  category text NOT NULL DEFAULT 'general'::text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'Sent'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  wamid text,
  provider text NOT NULL DEFAULT 'sim'::text,
  status_at timestamp with time zone,
  error text
);

CREATE TABLE work_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL,
  address text,
  city text,
  state text,
  country text NOT NULL DEFAULT 'India'::text,
  phone text,
  email text,
  status text NOT NULL DEFAULT 'Active'::text,
  employee_count integer NOT NULL DEFAULT 0,
  lin_no text,
  epf_code_no text,
  esi_code_no text,
  pan_no text,
  gst_code text,
  tan_no text,
  cin_no text,
  pt_no text,
  is_factory boolean NOT NULL DEFAULT false,
  factory_registration_date date,
  factory_validity_from date,
  factory_validity_to date,
  factory_commencement_date date,
  factory_max_workers_per_day integer,
  factory_license_limit integer,
  factory_gps_latitude text,
  factory_gps_longitude text,
  factory_nic_code text,
  factory_full_postal_address text,
  factory_occupier_name text,
  factory_occupier_designation text,
  factory_occupier_phone text,
  factory_occupier_email text,
  factory_occupier_address_line1 text,
  factory_occupier_address_line2 text,
  factory_occupier_city text,
  factory_occupier_district text,
  factory_occupier_state text,
  factory_occupier_pincode text,
  factory_manager_name text,
  factory_manager_designation text,
  factory_manager_phone text,
  factory_manager_email text,
  factory_manager_address_line1 text,
  factory_manager_address_line2 text,
  factory_manager_city text,
  factory_manager_district text,
  factory_manager_state text,
  factory_manager_pincode text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =================== CONSTRAINTS (PK / UNIQUE / CHECK / FK) ===================

ALTER TABLE asset_allocations ADD CONSTRAINT asset_allocations_pkey PRIMARY KEY (id);
ALTER TABLE asset_allocations ADD CONSTRAINT asset_allocations_action_check CHECK ((action = ANY (ARRAY['Allocated'::text, 'Returned'::text])));
ALTER TABLE asset_allocations ADD CONSTRAINT asset_allocations_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;
ALTER TABLE asset_allocations ADD CONSTRAINT asset_allocations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE asset_categories ADD CONSTRAINT asset_categories_pkey PRIMARY KEY (id);
ALTER TABLE assets ADD CONSTRAINT assets_pkey PRIMARY KEY (id);
ALTER TABLE assets ADD CONSTRAINT assets_product_id_key UNIQUE (product_id);
ALTER TABLE assets ADD CONSTRAINT assets_status_check CHECK ((status = ANY (ARRAY['Available'::text, 'Allocated'::text, 'In Maintenance'::text, 'Retired'::text, 'Lost'::text])));
ALTER TABLE assets ADD CONSTRAINT assets_allocated_to_fkey FOREIGN KEY (allocated_to) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE assets ADD CONSTRAINT assets_category_id_fkey FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE SET NULL;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_emp_date_unique UNIQUE (employee_id, attendance_date);
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_status_check CHECK ((status = ANY (ARRAY['Present'::text, 'Absent'::text, 'Late'::text, 'Half Day'::text, 'On Leave'::text, 'Holiday'::text, 'Weekend'::text, 'LOP'::text])));
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_approval_status_check CHECK ((approval_status = ANY (ARRAY['Draft'::text, 'Submitted'::text, 'Approved'::text])));
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE deduction_entries ADD CONSTRAINT deduction_entries_pkey PRIMARY KEY (id);
ALTER TABLE deduction_entries ADD CONSTRAINT deduction_entries_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE SET NULL;
ALTER TABLE deduction_entries ADD CONSTRAINT deduction_entries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE departments ADD CONSTRAINT departments_pkey PRIMARY KEY (id);
ALTER TABLE departments ADD CONSTRAINT departments_code_location_unique UNIQUE (code, location_id);
ALTER TABLE departments ADD CONSTRAINT departments_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE departments ADD CONSTRAINT departments_location_id_fkey FOREIGN KEY (location_id) REFERENCES work_locations(id) ON DELETE CASCADE;
ALTER TABLE departments ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE designations ADD CONSTRAINT designations_pkey PRIMARY KEY (id);
ALTER TABLE designations ADD CONSTRAINT designations_code_unique UNIQUE (code);
ALTER TABLE designations ADD CONSTRAINT designations_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE document_signatures ADD CONSTRAINT document_signatures_pkey PRIMARY KEY (id);
ALTER TABLE documents ADD CONSTRAINT documents_pkey PRIMARY KEY (id);
ALTER TABLE employee_bank_accounts ADD CONSTRAINT employee_bank_accounts_pkey PRIMARY KEY (id);
ALTER TABLE employee_bank_accounts ADD CONSTRAINT employee_bank_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['Savings'::text, 'Current'::text, 'Salary'::text])));
ALTER TABLE employee_bank_accounts ADD CONSTRAINT employee_bank_accounts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_categories ADD CONSTRAINT employee_categories_pkey PRIMARY KEY (id);
ALTER TABLE employee_categories ADD CONSTRAINT employee_categories_code_unique UNIQUE (code);
ALTER TABLE employee_categories ADD CONSTRAINT employee_categories_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE employee_classifications ADD CONSTRAINT employee_classifications_pkey PRIMARY KEY (id);
ALTER TABLE employee_classifications ADD CONSTRAINT employee_classifications_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE employee_documents ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);
ALTER TABLE employee_documents ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_education ADD CONSTRAINT employee_education_pkey PRIMARY KEY (id);
ALTER TABLE employee_education ADD CONSTRAINT employee_education_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_family ADD CONSTRAINT employee_family_pkey PRIMARY KEY (id);
ALTER TABLE employee_family ADD CONSTRAINT employee_family_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_grades ADD CONSTRAINT employee_grades_pkey PRIMARY KEY (id);
ALTER TABLE employee_grades ADD CONSTRAINT employee_grades_code_unique UNIQUE (code);
ALTER TABLE employee_grades ADD CONSTRAINT employee_grades_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE employee_groups ADD CONSTRAINT employee_groups_pkey PRIMARY KEY (id);
ALTER TABLE employee_groups ADD CONSTRAINT employee_groups_code_unique UNIQUE (code);
ALTER TABLE employee_groups ADD CONSTRAINT employee_groups_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE employee_groups ADD CONSTRAINT employee_groups_group_type_check CHECK ((group_type = ANY (ARRAY['Payroll'::text, 'Incentive'::text, 'Allowance'::text, 'Benefits'::text, 'Compliance'::text, 'Other'::text])));
ALTER TABLE employee_languages ADD CONSTRAINT employee_languages_pkey PRIMARY KEY (id);
ALTER TABLE employee_languages ADD CONSTRAINT employee_languages_emp_lang_unique UNIQUE (employee_id, language);
ALTER TABLE employee_languages ADD CONSTRAINT employee_languages_speak_level_check CHECK ((speak_level = ANY (ARRAY['None'::text, 'Basic'::text, 'Intermediate'::text, 'Advanced'::text, 'Native'::text])));
ALTER TABLE employee_languages ADD CONSTRAINT employee_languages_read_level_check CHECK ((read_level = ANY (ARRAY['None'::text, 'Basic'::text, 'Intermediate'::text, 'Advanced'::text, 'Native'::text])));
ALTER TABLE employee_languages ADD CONSTRAINT employee_languages_write_level_check CHECK ((write_level = ANY (ARRAY['None'::text, 'Basic'::text, 'Intermediate'::text, 'Advanced'::text, 'Native'::text])));
ALTER TABLE employee_languages ADD CONSTRAINT employee_languages_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_salary_assignments ADD CONSTRAINT employee_salary_assignments_pkey PRIMARY KEY (id);
ALTER TABLE employee_salary_assignments ADD CONSTRAINT employee_salary_assignments_salary_structure_id_fkey FOREIGN KEY (salary_structure_id) REFERENCES salary_structures(id) ON DELETE RESTRICT;
ALTER TABLE employee_salary_assignments ADD CONSTRAINT employee_salary_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_sections ADD CONSTRAINT employee_sections_pkey PRIMARY KEY (id);
ALTER TABLE employee_sections ADD CONSTRAINT employee_sections_code_unique UNIQUE (code);
ALTER TABLE employee_sections ADD CONSTRAINT employee_sections_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE employee_statutory ADD CONSTRAINT employee_statutory_pkey PRIMARY KEY (id);
ALTER TABLE employee_statutory ADD CONSTRAINT employee_statutory_employee_id_unique UNIQUE (employee_id);
ALTER TABLE employee_statutory ADD CONSTRAINT employee_statutory_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_types ADD CONSTRAINT employee_types_pkey PRIMARY KEY (id);
ALTER TABLE employee_types ADD CONSTRAINT employee_types_code_unique UNIQUE (code);
ALTER TABLE employee_types ADD CONSTRAINT employee_types_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE employee_work_experience ADD CONSTRAINT employee_work_experience_pkey PRIMARY KEY (id);
ALTER TABLE employee_work_experience ADD CONSTRAINT employee_work_experience_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
ALTER TABLE employees ADD CONSTRAINT employees_employee_id_unique UNIQUE (employee_id);
ALTER TABLE employees ADD CONSTRAINT employees_blood_group_check CHECK ((blood_group = ANY (ARRAY['A+'::text, 'A-'::text, 'B+'::text, 'B-'::text, 'AB+'::text, 'AB-'::text, 'O+'::text, 'O-'::text])));
ALTER TABLE employees ADD CONSTRAINT employees_gender_check CHECK ((gender = ANY (ARRAY['Male'::text, 'Female'::text, 'Other'::text, 'Prefer not to say'::text])));
ALTER TABLE employees ADD CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text, 'On Leave'::text, 'Terminated'::text, 'Resigned'::text, 'Retired'::text])));
ALTER TABLE employees ADD CONSTRAINT employees_marital_status_check CHECK ((marital_status = ANY (ARRAY['Single'::text, 'Married'::text, 'Divorced'::text, 'Widowed'::text, 'Separated'::text])));
ALTER TABLE employees ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_work_location_id_fkey FOREIGN KEY (work_location_id) REFERENCES work_locations(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_reporting_manager_id_fkey FOREIGN KEY (reporting_manager_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES employee_grades(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_employee_type_id_fkey FOREIGN KEY (employee_type_id) REFERENCES employee_types(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_employee_group_id_fkey FOREIGN KEY (employee_group_id) REFERENCES employee_groups(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_employee_category_id_fkey FOREIGN KEY (employee_category_id) REFERENCES employee_categories(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES designations(id) ON DELETE SET NULL;
ALTER TABLE establishment ADD CONSTRAINT establishment_pkey PRIMARY KEY (id);
ALTER TABLE generated_letters ADD CONSTRAINT generated_letters_pkey PRIMARY KEY (id);
ALTER TABLE generated_letters ADD CONSTRAINT generated_letters_template_id_fkey FOREIGN KEY (template_id) REFERENCES letter_templates(id) ON DELETE SET NULL;
ALTER TABLE generated_letters ADD CONSTRAINT generated_letters_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE gratuity_settlements ADD CONSTRAINT gratuity_settlements_pkey PRIMARY KEY (id);
ALTER TABLE gratuity_settlements ADD CONSTRAINT gratuity_settlements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE holiday_lists ADD CONSTRAINT holiday_lists_pkey PRIMARY KEY (id);
ALTER TABLE holiday_lists ADD CONSTRAINT holiday_lists_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Draft'::text, 'Archived'::text])));
ALTER TABLE holidays ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);
ALTER TABLE holidays ADD CONSTRAINT holidays_type_check CHECK ((type = ANY (ARRAY['National'::text, 'Festival'::text, 'Regional'::text, 'Optional'::text, 'Weekly Off'::text])));
ALTER TABLE holidays ADD CONSTRAINT holidays_holiday_list_id_fkey FOREIGN KEY (holiday_list_id) REFERENCES holiday_lists(id) ON DELETE CASCADE;
ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);
ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_emp_type_year_unique UNIQUE (employee_id, leave_type_id, year);
ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE;
ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE leave_policies ADD CONSTRAINT leave_policies_pkey PRIMARY KEY (id);
ALTER TABLE leave_policy_allocations ADD CONSTRAINT leave_policy_allocations_pkey PRIMARY KEY (id);
ALTER TABLE leave_policy_allocations ADD CONSTRAINT leave_policy_allocations_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES leave_policies(id) ON DELETE CASCADE;
ALTER TABLE leave_policy_entitlements ADD CONSTRAINT leave_policy_entitlements_pkey PRIMARY KEY (id);
ALTER TABLE leave_policy_entitlements ADD CONSTRAINT leave_policy_entitlements_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES leave_policies(id) ON DELETE CASCADE;
ALTER TABLE leave_policy_entitlements ADD CONSTRAINT leave_policy_entitlements_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE SET NULL;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text, 'Cancelled'::text])));
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE leave_types ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);
ALTER TABLE leave_types ADD CONSTRAINT leave_types_code_unique UNIQUE (code);
ALTER TABLE leave_types ADD CONSTRAINT leave_types_gender_applicability_check CHECK ((gender_applicability = ANY (ARRAY['All'::text, 'Male'::text, 'Female'::text, 'Other'::text])));
ALTER TABLE leave_types ADD CONSTRAINT leave_types_encashment_policy_check CHECK ((encashment_policy = ANY (ARRAY['None'::text, 'On Separation'::text, 'Annual'::text, 'On Request'::text])));
ALTER TABLE leave_types ADD CONSTRAINT leave_types_category_check CHECK ((category = ANY (ARRAY['Casual'::text, 'Sick'::text, 'Earned'::text, 'Maternity'::text, 'Paternity'::text, 'Bereavement'::text, 'Unpaid'::text, 'Compensatory'::text, 'Study'::text, 'Other'::text])));
ALTER TABLE leave_types ADD CONSTRAINT leave_types_carry_forward_policy_check CHECK ((carry_forward_policy = ANY (ARRAY['None'::text, 'Full'::text, 'Limited'::text, 'Percentage'::text])));
ALTER TABLE leave_types ADD CONSTRAINT leave_types_accrual_frequency_check CHECK ((accrual_frequency = ANY (ARRAY['Monthly'::text, 'Quarterly'::text, 'Half-Yearly'::text, 'Annually'::text, 'None'::text])));
ALTER TABLE leave_types ADD CONSTRAINT leave_types_accrual_basis_check CHECK ((accrual_basis = ANY (ARRAY['Fixed'::text, 'Pro-Rata'::text, 'Working Days'::text])));
ALTER TABLE letter_templates ADD CONSTRAINT letter_templates_pkey PRIMARY KEY (id);
ALTER TABLE letterheads ADD CONSTRAINT letterheads_pkey PRIMARY KEY (id);
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_logo_size_check CHECK ((header_logo_size = ANY (ARRAY['sm'::text, 'md'::text, 'lg'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_logo_position_check CHECK ((header_logo_position = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_paper_size_check CHECK ((paper_size = ANY (ARRAY['A4'::text, 'Letter'::text, 'Legal'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_tagline_alignment_check CHECK ((header_tagline_alignment = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_website_alignment_check CHECK ((header_website_alignment = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_footer_divider_thickness_check CHECK ((footer_divider_thickness = ANY (ARRAY['thin'::text, 'medium'::text, 'thick'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_footer_image_height_check CHECK ((footer_image_height = ANY (ARRAY['sm'::text, 'md'::text, 'lg'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_footer_line1_alignment_check CHECK ((footer_line1_alignment = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_footer_line2_alignment_check CHECK ((footer_line2_alignment = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_footer_page_number_align_check CHECK ((footer_page_number_align = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_address_alignment_check CHECK ((header_address_alignment = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_company_name_align_check CHECK ((header_company_name_align = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_company_name_size_check CHECK ((header_company_name_size = ANY (ARRAY['xs'::text, 'sm'::text, 'base'::text, 'lg'::text, 'xl'::text, '2xl'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_contact_alignment_check CHECK ((header_contact_alignment = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_divider_thickness_check CHECK ((header_divider_thickness = ANY (ARRAY['thin'::text, 'medium'::text, 'thick'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_image_height_check CHECK ((header_image_height = ANY (ARRAY['sm'::text, 'md'::text, 'lg'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_location_id_fkey FOREIGN KEY (location_id) REFERENCES work_locations(id) ON DELETE CASCADE;
ALTER TABLE loan_emi_schedule ADD CONSTRAINT loan_emi_schedule_pkey PRIMARY KEY (id);
ALTER TABLE loan_emi_schedule ADD CONSTRAINT loan_emi_schedule_loan_month_unique UNIQUE (loan_id, month_number);
ALTER TABLE loan_emi_schedule ADD CONSTRAINT loan_emi_schedule_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE;
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_pkey PRIMARY KEY (id);
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_hr_status_check CHECK ((hr_status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text])));
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'ManagerApproved'::text, 'Approved'::text, 'Rejected'::text])));
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_manager_status_check CHECK ((manager_status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text])));
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE;
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE SET NULL;
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_hr_id_fkey FOREIGN KEY (hr_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE loan_types ADD CONSTRAINT loan_types_pkey PRIMARY KEY (id);
ALTER TABLE loan_types ADD CONSTRAINT loan_types_code_unique UNIQUE (code);
ALTER TABLE loans ADD CONSTRAINT loans_pkey PRIMARY KEY (id);
ALTER TABLE loans ADD CONSTRAINT loans_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Active'::text, 'Closed'::text, 'Rejected'::text])));
ALTER TABLE loans ADD CONSTRAINT loans_hr_id_fkey FOREIGN KEY (hr_id) REFERENCES employees(id);
ALTER TABLE loans ADD CONSTRAINT loans_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES employees(id);
ALTER TABLE loans ADD CONSTRAINT loans_loan_type_id_fkey FOREIGN KEY (loan_type_id) REFERENCES loan_types(id) ON DELETE RESTRICT;
ALTER TABLE loans ADD CONSTRAINT loans_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE loans ADD CONSTRAINT loans_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE location_bank_accounts ADD CONSTRAINT location_bank_accounts_pkey PRIMARY KEY (id);
ALTER TABLE location_bank_accounts ADD CONSTRAINT location_bank_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['Current'::text, 'Savings'::text, 'Overdraft'::text, 'Cash Credit'::text])));
ALTER TABLE location_bank_accounts ADD CONSTRAINT location_bank_accounts_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE location_bank_accounts ADD CONSTRAINT location_bank_accounts_location_id_fkey FOREIGN KEY (location_id) REFERENCES work_locations(id) ON DELETE CASCADE;
ALTER TABLE location_documents ADD CONSTRAINT location_documents_pkey PRIMARY KEY (id);
ALTER TABLE location_documents ADD CONSTRAINT location_documents_location_id_fkey FOREIGN KEY (location_id) REFERENCES work_locations(id) ON DELETE CASCADE;
ALTER TABLE lookup_values ADD CONSTRAINT lookup_values_pkey PRIMARY KEY (id);
ALTER TABLE pay_heads ADD CONSTRAINT pay_heads_pkey PRIMARY KEY (id);
ALTER TABLE pay_heads ADD CONSTRAINT pay_heads_code_unique UNIQUE (code);
ALTER TABLE pay_heads ADD CONSTRAINT pay_heads_type_check CHECK ((type = ANY (ARRAY['Earning'::text, 'Deduction'::text])));
ALTER TABLE payroll_arrears ADD CONSTRAINT payroll_arrears_pkey PRIMARY KEY (id);
ALTER TABLE payroll_arrears ADD CONSTRAINT payroll_arrears_payroll_period_id_employee_id_key UNIQUE (payroll_period_id, employee_id);
ALTER TABLE payroll_arrears ADD CONSTRAINT payroll_arrears_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE;
ALTER TABLE payroll_arrears ADD CONSTRAINT payroll_arrears_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE payroll_arrears ADD CONSTRAINT payroll_arrears_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE SET NULL;
ALTER TABLE payroll_entries ADD CONSTRAINT payroll_entries_pkey PRIMARY KEY (id);
ALTER TABLE payroll_entries ADD CONSTRAINT payroll_entries_run_emp_unique UNIQUE (payroll_run_id, employee_id);
ALTER TABLE payroll_entries ADD CONSTRAINT payroll_entries_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE;
ALTER TABLE payroll_entries ADD CONSTRAINT payroll_entries_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE RESTRICT;
ALTER TABLE payroll_entries ADD CONSTRAINT payroll_entries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_pkey PRIMARY KEY (id);
ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_code_unique UNIQUE (code);
ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_status_check CHECK ((status = ANY (ARRAY['Open'::text, 'Processing'::text, 'Closed'::text, 'Locked'::text])));
ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_frequency_check CHECK ((frequency = ANY (ARRAY['Monthly'::text, 'Weekly'::text, 'Bi-Weekly'::text, 'Quarterly'::text])));
ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES system_users(id) ON DELETE SET NULL;
ALTER TABLE payroll_precheck_stages ADD CONSTRAINT payroll_precheck_stages_pkey PRIMARY KEY (id);
ALTER TABLE payroll_precheck_stages ADD CONSTRAINT payroll_precheck_stages_payroll_period_id_stage_key UNIQUE (payroll_period_id, stage);
ALTER TABLE payroll_precheck_stages ADD CONSTRAINT payroll_precheck_stages_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE;
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_pkey PRIMARY KEY (id);
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_payment_status_check CHECK ((payment_status = ANY (ARRAY['Pending'::text, 'Paid'::text])));
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Processing'::text, 'Completed'::text, 'Approved'::text, 'Disbursed'::text, 'Cancelled'::text])));
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES system_users(id) ON DELETE SET NULL;
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE RESTRICT;
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES system_users(id) ON DELETE SET NULL;
ALTER TABLE pf_esi_config ADD CONSTRAINT pf_esi_config_pkey PRIMARY KEY (id);
ALTER TABLE pf_esi_config ADD CONSTRAINT pf_esi_config_pf_apply_on_check CHECK ((pf_apply_on = ANY (ARRAY['Actual'::text, 'Ceiling'::text])));
ALTER TABLE poll_options ADD CONSTRAINT poll_options_pkey PRIMARY KEY (id);
ALTER TABLE poll_options ADD CONSTRAINT poll_options_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE;
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_pkey PRIMARY KEY (id);
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE;
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE;
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE polls ADD CONSTRAINT polls_pkey PRIMARY KEY (id);
ALTER TABLE polls ADD CONSTRAINT polls_type_check CHECK ((type = ANY (ARRAY['single'::text, 'multiple'::text, 'rating'::text, 'text'::text])));
ALTER TABLE polls ADD CONSTRAINT polls_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Closed'::text, 'Scheduled'::text, 'Draft'::text])));
ALTER TABLE professional_tax_slabs ADD CONSTRAINT professional_tax_slabs_pkey PRIMARY KEY (id);
ALTER TABLE salary_components ADD CONSTRAINT salary_components_pkey PRIMARY KEY (id);
ALTER TABLE salary_components ADD CONSTRAINT salary_components_code_unique UNIQUE (code);
ALTER TABLE salary_components ADD CONSTRAINT salary_components_esi_applicability_check CHECK ((esi_applicability = ANY (ARRAY['Applicable'::text, 'Not Applicable'::text, 'Optional'::text])));
ALTER TABLE salary_components ADD CONSTRAINT salary_components_type_check CHECK ((type = ANY (ARRAY['Earning'::text, 'Deduction'::text, 'Employer Contribution'::text, 'Reimbursement'::text])));
ALTER TABLE salary_components ADD CONSTRAINT salary_components_taxability_check CHECK ((taxability = ANY (ARRAY['Fully Taxable'::text, 'Partially Exempt'::text, 'Fully Exempt'::text])));
ALTER TABLE salary_components ADD CONSTRAINT salary_components_calculation_basis_check CHECK ((calculation_basis = ANY (ARRAY['Fixed'::text, 'Percentage of Basic'::text, 'Percentage of Gross'::text, 'Percentage of CTC'::text, 'Formula'::text])));
ALTER TABLE salary_components ADD CONSTRAINT salary_components_pf_applicability_check CHECK ((pf_applicability = ANY (ARRAY['Applicable'::text, 'Not Applicable'::text, 'Optional'::text])));
ALTER TABLE salary_structure_components ADD CONSTRAINT salary_structure_components_pkey PRIMARY KEY (id);
ALTER TABLE salary_structure_components ADD CONSTRAINT salary_struct_comp_unique UNIQUE (salary_structure_id, salary_component_id);
ALTER TABLE salary_structure_components ADD CONSTRAINT salary_structure_components_calculation_basis_check CHECK ((calculation_basis = ANY (ARRAY['Fixed'::text, 'Percentage of Basic'::text, 'Percentage of Gross'::text, 'Percentage of CTC'::text, 'Formula'::text])));
ALTER TABLE salary_structure_components ADD CONSTRAINT salary_structure_components_salary_structure_id_fkey FOREIGN KEY (salary_structure_id) REFERENCES salary_structures(id) ON DELETE CASCADE;
ALTER TABLE salary_structure_components ADD CONSTRAINT salary_structure_components_salary_component_id_fkey FOREIGN KEY (salary_component_id) REFERENCES salary_components(id) ON DELETE CASCADE;
ALTER TABLE salary_structures ADD CONSTRAINT salary_structures_pkey PRIMARY KEY (id);
ALTER TABLE salary_structures ADD CONSTRAINT salary_structures_code_unique UNIQUE (code);
ALTER TABLE shifts ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);
ALTER TABLE shifts ADD CONSTRAINT shifts_code_unique UNIQUE (code);
ALTER TABLE shifts ADD CONSTRAINT shifts_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE shifts ADD CONSTRAINT shifts_category_check CHECK ((category = ANY (ARRAY['General'::text, 'Morning'::text, 'Afternoon'::text, 'Night'::text, 'Rotational'::text, 'Flexible'::text])));
ALTER TABLE shifts ADD CONSTRAINT shifts_overtime_policy_check CHECK ((overtime_policy = ANY (ARRAY['None'::text, 'After Shift Hours'::text, 'After Daily Limit'::text, 'After Weekly Limit'::text])));
ALTER TABLE system_users ADD CONSTRAINT system_users_pkey PRIMARY KEY (id);
ALTER TABLE system_users ADD CONSTRAINT system_users_email_unique UNIQUE (email);
ALTER TABLE system_users ADD CONSTRAINT system_users_role_check CHECK ((role = ANY (ARRAY['Super Admin'::text, 'HR Manager'::text, 'Payroll Manager'::text, 'Department Manager'::text, 'Employee'::text, 'Auditor'::text])));
ALTER TABLE system_users ADD CONSTRAINT system_users_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text, 'Suspended'::text, 'Pending'::text])));
ALTER TABLE system_users ADD CONSTRAINT system_users_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE system_users ADD CONSTRAINT system_users_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE tds_slabs ADD CONSTRAINT tds_slabs_pkey PRIMARY KEY (id);
ALTER TABLE tds_slabs ADD CONSTRAINT tds_slabs_gender_check CHECK ((gender = ANY (ARRAY['All'::text, 'Male'::text, 'Female'::text, 'Senior Citizen'::text, 'Super Senior Citizen'::text])));
ALTER TABLE tds_slabs ADD CONSTRAINT tds_slabs_regime_check CHECK ((regime = ANY (ARRAY['Old'::text, 'New'::text])));
ALTER TABLE user_dashboard_preferences ADD CONSTRAINT user_dashboard_preferences_pkey PRIMARY KEY (user_id);
ALTER TABLE user_privileges ADD CONSTRAINT user_privileges_pkey PRIMARY KEY (id);
ALTER TABLE user_privileges ADD CONSTRAINT user_privileges_user_module_unique UNIQUE (system_user_id, module);
ALTER TABLE user_privileges ADD CONSTRAINT user_privileges_module_check CHECK ((module = ANY (ARRAY['Dashboard'::text, 'Employees'::text, 'Payroll'::text, 'Attendance'::text, 'Leave'::text, 'Loans'::text, 'Reports'::text, 'Configuration'::text, 'User Master'::text, 'Settings'::text])));
ALTER TABLE user_privileges ADD CONSTRAINT user_privileges_system_user_id_fkey FOREIGN KEY (system_user_id) REFERENCES system_users(id) ON DELETE CASCADE;
ALTER TABLE whatsapp_notifications ADD CONSTRAINT whatsapp_notifications_pkey PRIMARY KEY (id);
ALTER TABLE whatsapp_notifications ADD CONSTRAINT whatsapp_notifications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE work_locations ADD CONSTRAINT work_locations_pkey PRIMARY KEY (id);
ALTER TABLE work_locations ADD CONSTRAINT work_locations_code_unique UNIQUE (code);
ALTER TABLE work_locations ADD CONSTRAINT work_locations_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));

-- =================== INDEXES ===================

CREATE INDEX assets_category_idx ON public.assets USING btree (category_id);
CREATE INDEX assets_allocated_idx ON public.assets USING btree (allocated_to);
CREATE INDEX idx_attendance_emp_date ON public.attendance_records USING btree (employee_id, attendance_date);
CREATE INDEX idx_attendance_status ON public.attendance_records USING btree (status);
CREATE INDEX idx_attendance_date ON public.attendance_records USING btree (attendance_date);
CREATE INDEX idx_departments_location_id ON public.departments USING btree (location_id);
CREATE INDEX idx_departments_parent_id ON public.departments USING btree (parent_id);
CREATE INDEX idx_departments_status ON public.departments USING btree (status);
CREATE INDEX document_signatures_document_ref_idx ON public.document_signatures USING btree (document_ref);
CREATE INDEX document_signatures_source_idx ON public.document_signatures USING btree (source);
CREATE INDEX documents_category_idx ON public.documents USING btree (entity_type, entity_ref, category);
CREATE INDEX documents_entity_idx ON public.documents USING btree (entity_type, entity_ref);
CREATE INDEX idx_emp_bank_is_primary ON public.employee_bank_accounts USING btree (is_primary);
CREATE INDEX idx_emp_bank_employee_id ON public.employee_bank_accounts USING btree (employee_id);
CREATE INDEX idx_emp_docs_category ON public.employee_documents USING btree (document_category);
CREATE INDEX idx_emp_docs_employee_id ON public.employee_documents USING btree (employee_id);
CREATE INDEX idx_emp_education_employee_id ON public.employee_education USING btree (employee_id);
CREATE INDEX idx_emp_family_is_nominee ON public.employee_family USING btree (is_nominee);
CREATE INDEX idx_emp_family_employee_id ON public.employee_family USING btree (employee_id);
CREATE INDEX idx_emp_languages_employee_id ON public.employee_languages USING btree (employee_id);
CREATE INDEX idx_emp_sal_assign_structure_id ON public.employee_salary_assignments USING btree (salary_structure_id);
CREATE INDEX idx_emp_sal_assign_effective_from ON public.employee_salary_assignments USING btree (effective_from);
CREATE INDEX idx_emp_sal_assign_employee_id ON public.employee_salary_assignments USING btree (employee_id);
CREATE INDEX idx_emp_sal_assign_is_current ON public.employee_salary_assignments USING btree (is_current);
CREATE INDEX idx_emp_statutory_uan_no ON public.employee_statutory USING btree (uan_no);
CREATE INDEX idx_emp_statutory_pan_no ON public.employee_statutory USING btree (pan_no);
CREATE INDEX idx_emp_statutory_employee_id ON public.employee_statutory USING btree (employee_id);
CREATE INDEX idx_emp_work_exp_employee_id ON public.employee_work_experience USING btree (employee_id);
CREATE INDEX idx_employees_date_of_joining ON public.employees USING btree (date_of_joining);
CREATE INDEX idx_emp_dept_location ON public.employees USING btree (department_id, work_location_id);
CREATE INDEX idx_emp_status_joining ON public.employees USING btree (status, date_of_joining);
CREATE INDEX idx_employees_status ON public.employees USING btree (status);
CREATE INDEX idx_employees_employee_id ON public.employees USING btree (employee_id);
CREATE INDEX idx_employees_department_id ON public.employees USING btree (department_id);
CREATE UNIQUE INDEX employees_attendance_system_id_unique ON public.employees USING btree (attendance_system_id) WHERE (attendance_system_id IS NOT NULL);
CREATE INDEX idx_employees_current_emp_id ON public.employees USING btree (current_employee_id);
CREATE INDEX idx_employees_designation_id ON public.employees USING btree (designation_id);
CREATE INDEX idx_employees_reporting_manager ON public.employees USING btree (reporting_manager_id);
CREATE INDEX idx_employees_work_location_id ON public.employees USING btree (work_location_id);
CREATE INDEX idx_holiday_lists_year ON public.holiday_lists USING btree (year);
CREATE INDEX idx_holiday_lists_status ON public.holiday_lists USING btree (status);
CREATE INDEX idx_holidays_list_date ON public.holidays USING btree (holiday_list_id, holiday_date);
CREATE INDEX idx_holidays_type ON public.holidays USING btree (type);
CREATE INDEX idx_leave_bal_type_id ON public.leave_balances USING btree (leave_type_id);
CREATE INDEX idx_leave_bal_emp_year ON public.leave_balances USING btree (employee_id, year);
CREATE INDEX idx_leave_req_emp_status ON public.leave_requests USING btree (employee_id, status);
CREATE INDEX idx_leave_req_type_id ON public.leave_requests USING btree (leave_type_id);
CREATE INDEX idx_leave_req_to_date ON public.leave_requests USING btree (to_date);
CREATE INDEX idx_leave_req_applied_on ON public.leave_requests USING btree (applied_on);
CREATE INDEX idx_leave_req_from_date ON public.leave_requests USING btree (from_date);
CREATE INDEX idx_leave_types_code ON public.leave_types USING btree (code);
CREATE INDEX idx_leave_types_is_paid ON public.leave_types USING btree (is_paid);
CREATE INDEX idx_leave_types_category ON public.leave_types USING btree (category);
CREATE INDEX idx_leave_types_is_active ON public.leave_types USING btree (is_active);
CREATE INDEX idx_letterheads_location_id ON public.letterheads USING btree (location_id);
CREATE INDEX idx_letterheads_is_active ON public.letterheads USING btree (is_active);
CREATE INDEX idx_emi_loan_paid ON public.loan_emi_schedule USING btree (loan_id, is_paid);
CREATE INDEX idx_emi_due_date ON public.loan_emi_schedule USING btree (due_date);
CREATE INDEX loan_emi_skip_employee_id_idx ON public.loan_emi_skip_requests USING btree (employee_id);
CREATE INDEX loan_emi_skip_status_idx ON public.loan_emi_skip_requests USING btree (status);
CREATE INDEX loan_emi_skip_loan_id_idx ON public.loan_emi_skip_requests USING btree (loan_id);
CREATE INDEX idx_loan_types_is_active ON public.loan_types USING btree (is_active);
CREATE INDEX idx_loan_types_code ON public.loan_types USING btree (code);
CREATE INDEX idx_loans_emp_status ON public.loans USING btree (employee_id, status);
CREATE INDEX idx_loans_type_id ON public.loans USING btree (loan_type_id);
CREATE INDEX idx_loans_applied_date ON public.loans USING btree (applied_date);
CREATE INDEX idx_loc_bank_location_id ON public.location_bank_accounts USING btree (location_id);
CREATE INDEX idx_loc_bank_is_primary ON public.location_bank_accounts USING btree (is_primary);
CREATE INDEX idx_loc_docs_location_id ON public.location_documents USING btree (location_id);
CREATE INDEX idx_loc_docs_category ON public.location_documents USING btree (document_category);
CREATE INDEX lookup_values_category_idx ON public.lookup_values USING btree (category, sort_order);
CREATE INDEX idx_pay_heads_type ON public.pay_heads USING btree (type);
CREATE INDEX idx_pay_heads_code ON public.pay_heads USING btree (code);
CREATE INDEX idx_pay_heads_is_active ON public.pay_heads USING btree (is_active);
CREATE INDEX idx_payroll_entries_run ON public.payroll_entries USING btree (payroll_run_id, employee_id);
CREATE INDEX idx_payroll_entries_status ON public.payroll_entries USING btree (status);
CREATE INDEX idx_payroll_entries_emp_id ON public.payroll_entries USING btree (employee_id);
CREATE INDEX idx_payroll_entries_period ON public.payroll_entries USING btree (payroll_period_id);
CREATE INDEX idx_payroll_period_fy ON public.payroll_periods USING btree (financial_year, status);
CREATE INDEX idx_payroll_period_is_default ON public.payroll_periods USING btree (is_default);
CREATE INDEX idx_payroll_period_to_date ON public.payroll_periods USING btree (to_date);
CREATE INDEX idx_payroll_period_from_date ON public.payroll_periods USING btree (from_date);
CREATE INDEX idx_payroll_runs_run_date ON public.payroll_runs USING btree (run_date);
CREATE INDEX idx_payroll_runs_status ON public.payroll_runs USING btree (status);
CREATE INDEX idx_payroll_runs_period_id ON public.payroll_runs USING btree (payroll_period_id);
CREATE INDEX poll_options_poll_id_idx ON public.poll_options USING btree (poll_id);
CREATE INDEX poll_votes_poll_id_idx ON public.poll_votes USING btree (poll_id);
CREATE INDEX poll_votes_employee_id_idx ON public.poll_votes USING btree (employee_id);
CREATE INDEX idx_salary_comp_code ON public.salary_components USING btree (code);
CREATE INDEX idx_salary_comp_is_system_defined ON public.salary_components USING btree (is_system_defined);
CREATE INDEX idx_salary_comp_is_active ON public.salary_components USING btree (is_active);
CREATE INDEX idx_salary_comp_type ON public.salary_components USING btree (type);
CREATE INDEX idx_sal_struct_comp_comp_id ON public.salary_structure_components USING btree (salary_component_id);
CREATE INDEX idx_sal_struct_comp_struct_id ON public.salary_structure_components USING btree (salary_structure_id);
CREATE INDEX idx_salary_struct_is_active ON public.salary_structures USING btree (is_active);
CREATE INDEX idx_salary_struct_code ON public.salary_structures USING btree (code);
CREATE INDEX idx_shifts_status ON public.shifts USING btree (status);
CREATE INDEX idx_shifts_category ON public.shifts USING btree (category);
CREATE INDEX idx_shifts_code ON public.shifts USING btree (code);
CREATE UNIQUE INDEX system_users_login_id_unique ON public.system_users USING btree (login_id);
CREATE INDEX idx_system_users_employee_id ON public.system_users USING btree (employee_id);
CREATE INDEX idx_system_users_role ON public.system_users USING btree (role);
CREATE INDEX idx_system_users_auth_id ON public.system_users USING btree (auth_user_id);
CREATE INDEX idx_system_users_status ON public.system_users USING btree (status);
CREATE INDEX idx_system_users_email ON public.system_users USING btree (email);
CREATE INDEX idx_tds_gender ON public.tds_slabs USING btree (gender);
CREATE INDEX idx_tds_fy_regime ON public.tds_slabs USING btree (financial_year, regime);
CREATE INDEX idx_user_privileges_module ON public.user_privileges USING btree (system_user_id, module);
CREATE INDEX idx_user_privileges_user_id ON public.user_privileges USING btree (system_user_id);
CREATE INDEX idx_work_locations_status ON public.work_locations USING btree (status);
CREATE INDEX idx_work_locations_factory ON public.work_locations USING btree (is_factory);
CREATE INDEX idx_work_locations_code ON public.work_locations USING btree (code);
CREATE INDEX reimbursement_claims_employee_idx ON public.reimbursement_claims USING btree (employee_id);
CREATE INDEX reimbursement_claims_period_idx ON public.reimbursement_claims USING btree (payroll_period_id);
CREATE INDEX reimbursement_claims_status_idx ON public.reimbursement_claims USING btree (status);
CREATE INDEX employee_exits_employee_idx ON public.employee_exits USING btree (employee_id);
CREATE INDEX employee_exits_status_idx ON public.employee_exits USING btree (status);
CREATE INDEX exit_clearances_exit_idx ON public.exit_clearances USING btree (exit_id);
CREATE INDEX idx_exit_approvals_exit ON public.exit_approvals USING btree (exit_id);
CREATE INDEX idx_exit_approvals_approver ON public.exit_approvals USING btree (approver_employee_id, status);
CREATE INDEX idx_salary_revision_items_revision ON public.salary_revision_items USING btree (revision_id);
CREATE INDEX idx_salary_revision_items_employee ON public.salary_revision_items USING btree (employee_id);
CREATE INDEX idx_sra_target ON public.salary_revision_arrears USING btree (target_period_id, status);
CREATE INDEX idx_sra_revision ON public.salary_revision_arrears USING btree (revision_id);
CREATE INDEX idx_sra_employee ON public.salary_revision_arrears USING btree (employee_id);

-- ─── Email Communication module (migration 20260622010000_email_communication) ───
-- establishment += SMTP/email config columns:
--   email_enabled bool, email_provider text ('smtp'|'off'), email_host text, email_port int,
--   email_secure bool, email_username text, email_password text, email_from_name text,
--   email_from_address text, email_reply_to text.
-- The 'documents' storage bucket allowed_mime_types extended to include text/html, text/plain
-- (so the print-ready HTML document can be stored for the attachment + tracked view link).
CREATE TABLE public.email_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  to_email text,
  category text NOT NULL DEFAULT 'general',        -- payslip | letter | report | notification
  document_title text,
  subject text,
  body_html text,
  doc_path text,                                   -- path in the 'documents' bucket (nullable)
  token text NOT NULL UNIQUE,                       -- tracking key (open/doc/confirm links)
  status text NOT NULL DEFAULT 'Queued',            -- Queued|Sent|Opened|Viewed|Confirmed|Failed|Bounced|Simulated|No Email
  provider text NOT NULL DEFAULT 'sim',             -- 'sim' | 'smtp'
  sent_at timestamptz,
  opened_at timestamptz,
  doc_opened_at timestamptz,
  confirmed_at timestamptz,
  message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
CREATE INDEX idx_email_deliveries_token ON public.email_deliveries USING btree (token);
CREATE INDEX idx_email_deliveries_employee ON public.email_deliveries USING btree (employee_id, created_at desc);
CREATE INDEX idx_email_deliveries_category ON public.email_deliveries USING btree (category, created_at desc);
-- RLS: authenticated-ALL policy; table added to supabase_realtime publication.
-- Edge function `email` (verify_jwt false): POST send via SMTP; GET ?a=open|doc|confirm tracking.

-- ─── Salary-component deduction-source linkage (20260622130000 / 20260622140000) ───
-- salary_components.deduction_source text — links a Deduction component to a Deductions-
--   module category (loan-advances|damages-loss|fines|canteen|society|donations|other-deductions).
-- payroll_entries.deduction_breakdown jsonb — per-head amounts for approved deduction
--   entries recovered through the linked component during the run (shown as payslip lines).
ALTER TABLE public.salary_components ADD COLUMN IF NOT EXISTS deduction_source text;
ALTER TABLE public.payroll_entries  ADD COLUMN IF NOT EXISTS deduction_breakdown jsonb;
