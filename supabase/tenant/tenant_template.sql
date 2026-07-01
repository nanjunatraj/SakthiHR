-- ============================================================
-- SakthiHR TENANT schema template (generated from SAKTHI)
-- Applied to each new establishment project. Control-plane-only
-- objects (establishments registry, resolver) are excluded.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ===== TABLES =====
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
  doc_group text CHECK (doc_group IS NULL OR doc_group IN ('employment','personal')),
  doc_type text,
  approval_status text NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved','pending','rejected')),
  uploaded_via text NOT NULL DEFAULT 'admin' CHECK (uploaded_via IN ('admin','portal')),
  approved_by uuid,
  approved_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE email_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid,
  to_email text,
  category text NOT NULL DEFAULT 'general'::text,
  document_title text,
  subject text,
  body_html text,
  doc_path text,
  token text NOT NULL,
  status text NOT NULL DEFAULT 'Queued'::text,
  provider text NOT NULL DEFAULT 'sim'::text,
  sent_at timestamp with time zone,
  opened_at timestamp with time zone,
  doc_opened_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  message_id text,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
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
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  submitted_by text NOT NULL DEFAULT 'hr'::text,
  notice_waived boolean NOT NULL DEFAULT false,
  acceptance_issued boolean NOT NULL DEFAULT false,
  step_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_deadline date
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
  email_enabled boolean NOT NULL DEFAULT false,
  email_provider text NOT NULL DEFAULT 'smtp'::text,
  email_host text,
  email_port integer,
  email_secure boolean NOT NULL DEFAULT true,
  email_username text,
  email_password text,
  email_from_name text,
  email_from_address text,
  email_reply_to text
);

CREATE TABLE exit_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  exit_id uuid NOT NULL,
  level integer NOT NULL DEFAULT 1,
  role text NOT NULL,
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
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  manager_status text NOT NULL DEFAULT 'Pending'::text,
  manager_id uuid,
  manager_acted_on timestamp with time zone,
  manager_remarks text
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

CREATE TABLE letter_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL,
  label text NOT NULL,
  activity text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE letter_template_models (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text NOT NULL,
  name text NOT NULL,
  subject text,
  body text NOT NULL DEFAULT ''::text,
  use_letterhead boolean NOT NULL DEFAULT true,
  language text NOT NULL DEFAULT 'English'::text,
  is_builtin boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
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
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  language text NOT NULL DEFAULT 'English'::text
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
  employee_acknowledged_at timestamp with time zone,
  arrears numeric(12,2) NOT NULL DEFAULT 0,
  deduction_breakdown jsonb
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
  bonus_wage_components jsonb NOT NULL DEFAULT '[]'::jsonb,
  bonus_exgratia_enabled boolean NOT NULL DEFAULT false,
  bonus_exgratia_percentage numeric NOT NULL DEFAULT 8.33
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
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  manager_status text NOT NULL DEFAULT 'Pending'::text,
  manager_id uuid,
  manager_acted_on timestamp with time zone,
  manager_remarks text
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
  is_arrears boolean NOT NULL DEFAULT false,
  deduction_source text
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

-- ===== FUNCTIONS =====
CREATE OR REPLACE FUNCTION public.auth_user_id_by_email(p_email text)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_emi(p_principal numeric, p_annual_rate numeric, p_tenure integer)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_monthly_rate NUMERIC;
  v_emi          NUMERIC;
BEGIN
  IF p_annual_rate = 0 THEN
    RETURN ROUND(p_principal / p_tenure, 2);
  END IF;
  v_monthly_rate := p_annual_rate / 12 / 100;
  v_emi := p_principal * v_monthly_rate * POWER(1 + v_monthly_rate, p_tenure)
           / (POWER(1 + v_monthly_rate, p_tenure) - 1);
  RETURN ROUND(v_emi, 2);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.change_password(p_login_id text, p_current text, p_new text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare rec record;
begin
  select id, password into rec from public.system_users where login_id = trim(p_login_id) limit 1;
  if rec.id is null then return json_build_object('error', 'Account not found.'); end if;
  if not public.system_users_password_matches(rec.password, p_current) then
    return json_build_object('error', 'Current password is incorrect.');
  end if;
  update public.system_users
    set password = p_new, must_change_password = false,
        password_changed_at = now(), updated_at = now()
    where id = rec.id;
  return json_build_object('error', null);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_employee_id(p_prefix text DEFAULT 'EMP'::text, p_year integer DEFAULT NULL::integer)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_year    TEXT;
  v_seq     INTEGER;
  v_emp_id  TEXT;
BEGIN
  v_year := RIGHT(COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE))::TEXT, 2);
  SELECT COUNT(*) + 1 INTO v_seq FROM public.employees;
  v_emp_id := p_prefix || v_year || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_emp_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_leave_balance(p_employee_id uuid, p_leave_type_id uuid, p_year integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_balance NUMERIC;
BEGIN
  SELECT closing_balance
  INTO v_balance
  FROM public.leave_balances
  WHERE employee_id   = p_employee_id
    AND leave_type_id = p_leave_type_id
    AND year          = p_year;

  RETURN COALESCE(v_balance, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.hash_system_user_password()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if new.password is not null and new.password <> '' and new.password not like '$2%' then
    new.password := extensions.crypt(new.password, extensions.gen_salt('bf'));
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_doc_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.system_users su
    where su.auth_user_id = auth.uid()
      and coalesce(su.status, 'Active') <> 'Inactive'
      and (su.role ilike '%admin%' or su.role ilike '%hr%' or su.role ilike 'human resource%')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.owns_employee_doc(p_entity_type text, p_entity_ref text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_entity_type = 'employee'
    and exists (
      select 1
      from public.system_users su
      join public.employees e on e.id = su.employee_id
      where su.auth_user_id = auth.uid()
        and (
             p_entity_ref =  e.employee_id          or p_entity_ref like e.employee_id || '/%'
          or p_entity_ref =  e.current_employee_id  or p_entity_ref like e.current_employee_id || '/%'
        )
    );
$function$
;

CREATE OR REPLACE FUNCTION public.owns_storage_doc(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.system_users su
    join public.employees e on e.id = su.employee_id
    where su.auth_user_id = auth.uid()
      and (p_name like 'employee/' || e.employee_id || '/%'
        or p_name like 'employee/' || e.current_employee_id || '/%')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.owns_storage_photo(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.system_users su
    join public.employees e on e.id = su.employee_id
    where su.auth_user_id = auth.uid()
      and (p_name like 'employees/' || e.employee_id || '/%'
        or p_name like 'employees/' || e.current_employee_id || '/%')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.reset_password(p_login_id text, p_new_password text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare rec record;
begin
  select su.id, su.name, su.login_id, su.employee_id, e.email, e.mobile_number
  into rec
  from public.system_users su
  left join public.employees e on e.id = su.employee_id
  where su.login_id = trim(p_login_id)
  limit 1;
  if rec.id is null then return json_build_object('error', 'No user account found for this Employee ID.'); end if;
  update public.system_users
    set password = p_new_password, must_change_password = true, updated_at = now()
    where id = rec.id;
  return json_build_object(
    'error', null,
    'account', json_build_object(
      'id', rec.id, 'name', rec.name, 'login_id', rec.login_id,
      'employee_id', rec.employee_id, 'email', rec.email, 'mobile', rec.mobile_number
    )
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.system_users_password_matches(stored text, supplied text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select case
    when stored is null then false
    when stored like '$2%' then stored = extensions.crypt(supplied, stored)
    else stored = supplied
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_login(p_login_id text, p_password text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare rec record;
begin
  select su.id, su.name, su.login_id, su.must_change_password, su.employee_id, su.password,
         e.employee_id as employee_code, e.mobile_number, e.email
  into rec
  from public.system_users su
  left join public.employees e on e.id = su.employee_id
  where su.login_id = trim(p_login_id)
  limit 1;

  if rec.id is null then return null; end if;
  if not public.system_users_password_matches(rec.password, p_password) then return null; end if;

  return json_build_object(
    'id', rec.id,
    'name', rec.name,
    'login_id', rec.login_id,
    'must_change_password', rec.must_change_password,
    'employee_id', rec.employee_id,
    'employee_code', rec.employee_code,
    'mobile', rec.mobile_number,
    'email', rec.email
  );
end;
$function$
;

-- ===== CONSTRAINTS =====
ALTER TABLE asset_categories ADD CONSTRAINT asset_categories_pkey PRIMARY KEY (id);
ALTER TABLE asset_allocations ADD CONSTRAINT asset_allocations_pkey PRIMARY KEY (id);
ALTER TABLE email_deliveries ADD CONSTRAINT email_deliveries_pkey PRIMARY KEY (id);
ALTER TABLE documents ADD CONSTRAINT documents_pkey PRIMARY KEY (id);
ALTER TABLE document_signatures ADD CONSTRAINT document_signatures_pkey PRIMARY KEY (id);
ALTER TABLE designations ADD CONSTRAINT designations_pkey PRIMARY KEY (id);
ALTER TABLE departments ADD CONSTRAINT departments_pkey PRIMARY KEY (id);
ALTER TABLE employee_types ADD CONSTRAINT employee_types_pkey PRIMARY KEY (id);
ALTER TABLE employee_documents ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);
ALTER TABLE employee_education ADD CONSTRAINT employee_education_pkey PRIMARY KEY (id);
ALTER TABLE employee_exits ADD CONSTRAINT employee_exits_pkey PRIMARY KEY (id);
ALTER TABLE employee_family ADD CONSTRAINT employee_family_pkey PRIMARY KEY (id);
ALTER TABLE work_locations ADD CONSTRAINT work_locations_pkey PRIMARY KEY (id);
ALTER TABLE user_dashboard_preferences ADD CONSTRAINT user_dashboard_preferences_pkey PRIMARY KEY (user_id);
ALTER TABLE tds_slabs ADD CONSTRAINT tds_slabs_pkey PRIMARY KEY (id);
ALTER TABLE system_users ADD CONSTRAINT system_users_pkey PRIMARY KEY (id);
ALTER TABLE shifts ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);
ALTER TABLE salary_structures ADD CONSTRAINT salary_structures_pkey PRIMARY KEY (id);
ALTER TABLE salary_structure_components ADD CONSTRAINT salary_structure_components_pkey PRIMARY KEY (id);
ALTER TABLE salary_revisions ADD CONSTRAINT salary_revisions_pkey PRIMARY KEY (id);
ALTER TABLE employee_grades ADD CONSTRAINT employee_grades_pkey PRIMARY KEY (id);
ALTER TABLE salary_revision_items ADD CONSTRAINT salary_revision_items_pkey PRIMARY KEY (id);
ALTER TABLE salary_revision_arrears ADD CONSTRAINT salary_revision_arrears_pkey PRIMARY KEY (id);
ALTER TABLE salary_components ADD CONSTRAINT salary_components_pkey PRIMARY KEY (id);
ALTER TABLE reimbursement_claims ADD CONSTRAINT reimbursement_claims_pkey PRIMARY KEY (id);
ALTER TABLE professional_tax_slabs ADD CONSTRAINT professional_tax_slabs_pkey PRIMARY KEY (id);
ALTER TABLE polls ADD CONSTRAINT polls_pkey PRIMARY KEY (id);
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_pkey PRIMARY KEY (id);
ALTER TABLE poll_options ADD CONSTRAINT poll_options_pkey PRIMARY KEY (id);
ALTER TABLE pf_esi_config ADD CONSTRAINT pf_esi_config_pkey PRIMARY KEY (id);
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_pkey PRIMARY KEY (id);
ALTER TABLE payroll_precheck_stages ADD CONSTRAINT payroll_precheck_stages_pkey PRIMARY KEY (id);
ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_pkey PRIMARY KEY (id);
ALTER TABLE employee_bank_accounts ADD CONSTRAINT employee_bank_accounts_pkey PRIMARY KEY (id);
ALTER TABLE employee_groups ADD CONSTRAINT employee_groups_pkey PRIMARY KEY (id);
ALTER TABLE user_privileges ADD CONSTRAINT user_privileges_pkey PRIMARY KEY (id);
ALTER TABLE payroll_entries ADD CONSTRAINT payroll_entries_pkey PRIMARY KEY (id);
ALTER TABLE payroll_arrears ADD CONSTRAINT payroll_arrears_pkey PRIMARY KEY (id);
ALTER TABLE pay_heads ADD CONSTRAINT pay_heads_pkey PRIMARY KEY (id);
ALTER TABLE lookup_values ADD CONSTRAINT lookup_values_pkey PRIMARY KEY (id);
ALTER TABLE location_documents ADD CONSTRAINT location_documents_pkey PRIMARY KEY (id);
ALTER TABLE location_bank_accounts ADD CONSTRAINT location_bank_accounts_pkey PRIMARY KEY (id);
ALTER TABLE loans ADD CONSTRAINT loans_pkey PRIMARY KEY (id);
ALTER TABLE loan_types ADD CONSTRAINT loan_types_pkey PRIMARY KEY (id);
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_pkey PRIMARY KEY (id);
ALTER TABLE loan_emi_schedule ADD CONSTRAINT loan_emi_schedule_pkey PRIMARY KEY (id);
ALTER TABLE letterheads ADD CONSTRAINT letterheads_pkey PRIMARY KEY (id);
ALTER TABLE letter_templates ADD CONSTRAINT letter_templates_pkey PRIMARY KEY (id);
ALTER TABLE letter_template_models ADD CONSTRAINT letter_template_models_pkey PRIMARY KEY (id);
ALTER TABLE letter_categories ADD CONSTRAINT letter_categories_pkey PRIMARY KEY (id);
ALTER TABLE leave_types ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);
ALTER TABLE leave_policy_entitlements ADD CONSTRAINT leave_policy_entitlements_pkey PRIMARY KEY (id);
ALTER TABLE leave_policy_allocations ADD CONSTRAINT leave_policy_allocations_pkey PRIMARY KEY (id);
ALTER TABLE leave_policies ADD CONSTRAINT leave_policies_pkey PRIMARY KEY (id);
ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);
ALTER TABLE holidays ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);
ALTER TABLE employee_languages ADD CONSTRAINT employee_languages_pkey PRIMARY KEY (id);
ALTER TABLE employee_salary_assignments ADD CONSTRAINT employee_salary_assignments_pkey PRIMARY KEY (id);
ALTER TABLE employee_categories ADD CONSTRAINT employee_categories_pkey PRIMARY KEY (id);
ALTER TABLE employee_sections ADD CONSTRAINT employee_sections_pkey PRIMARY KEY (id);
ALTER TABLE holiday_lists ADD CONSTRAINT holiday_lists_pkey PRIMARY KEY (id);
ALTER TABLE gratuity_settlements ADD CONSTRAINT gratuity_settlements_pkey PRIMARY KEY (id);
ALTER TABLE generated_letters ADD CONSTRAINT generated_letters_pkey PRIMARY KEY (id);
ALTER TABLE exit_settlements ADD CONSTRAINT exit_settlements_pkey PRIMARY KEY (id);
ALTER TABLE exit_clearances ADD CONSTRAINT exit_clearances_pkey PRIMARY KEY (id);
ALTER TABLE exit_approvals ADD CONSTRAINT exit_approvals_pkey PRIMARY KEY (id);
ALTER TABLE establishment ADD CONSTRAINT establishment_pkey PRIMARY KEY (id);
ALTER TABLE employee_classifications ADD CONSTRAINT employee_classifications_pkey PRIMARY KEY (id);
ALTER TABLE employee_statutory ADD CONSTRAINT employee_statutory_pkey PRIMARY KEY (id);
ALTER TABLE employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
ALTER TABLE employee_work_experience ADD CONSTRAINT employee_work_experience_pkey PRIMARY KEY (id);
ALTER TABLE deduction_entries ADD CONSTRAINT deduction_entries_pkey PRIMARY KEY (id);
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);
ALTER TABLE assets ADD CONSTRAINT assets_pkey PRIMARY KEY (id);
ALTER TABLE employee_types ADD CONSTRAINT employee_types_code_unique UNIQUE (code);
ALTER TABLE email_deliveries ADD CONSTRAINT email_deliveries_token_key UNIQUE (token);
ALTER TABLE employee_categories ADD CONSTRAINT employee_categories_code_unique UNIQUE (code);
ALTER TABLE employee_grades ADD CONSTRAINT employee_grades_code_unique UNIQUE (code);
ALTER TABLE employee_groups ADD CONSTRAINT employee_groups_code_unique UNIQUE (code);
ALTER TABLE employee_languages ADD CONSTRAINT employee_languages_emp_lang_unique UNIQUE (employee_id, language);
ALTER TABLE employee_sections ADD CONSTRAINT employee_sections_code_unique UNIQUE (code);
ALTER TABLE employee_statutory ADD CONSTRAINT employee_statutory_employee_id_unique UNIQUE (employee_id);
ALTER TABLE designations ADD CONSTRAINT designations_code_unique UNIQUE (code);
ALTER TABLE assets ADD CONSTRAINT assets_product_id_key UNIQUE (product_id);
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_emp_date_unique UNIQUE (employee_id, attendance_date);
ALTER TABLE departments ADD CONSTRAINT departments_code_location_unique UNIQUE (code, location_id);
ALTER TABLE employees ADD CONSTRAINT employees_employee_id_unique UNIQUE (employee_id);
ALTER TABLE exit_settlements ADD CONSTRAINT exit_settlements_exit_id_key UNIQUE (exit_id);
ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_emp_type_year_unique UNIQUE (employee_id, leave_type_id, year);
ALTER TABLE leave_types ADD CONSTRAINT leave_types_code_unique UNIQUE (code);
ALTER TABLE letter_categories ADD CONSTRAINT letter_categories_key_key UNIQUE (key);
ALTER TABLE loan_emi_schedule ADD CONSTRAINT loan_emi_schedule_loan_month_unique UNIQUE (loan_id, month_number);
ALTER TABLE loan_types ADD CONSTRAINT loan_types_code_unique UNIQUE (code);
ALTER TABLE pay_heads ADD CONSTRAINT pay_heads_code_unique UNIQUE (code);
ALTER TABLE payroll_arrears ADD CONSTRAINT payroll_arrears_payroll_period_id_employee_id_key UNIQUE (payroll_period_id, employee_id);
ALTER TABLE payroll_entries ADD CONSTRAINT payroll_entries_run_emp_unique UNIQUE (payroll_run_id, employee_id);
ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_code_unique UNIQUE (code);
ALTER TABLE payroll_precheck_stages ADD CONSTRAINT payroll_precheck_stages_payroll_period_id_stage_key UNIQUE (payroll_period_id, stage);
ALTER TABLE salary_components ADD CONSTRAINT salary_components_code_unique UNIQUE (code);
ALTER TABLE salary_structure_components ADD CONSTRAINT salary_struct_comp_unique UNIQUE (salary_structure_id, salary_component_id);
ALTER TABLE salary_structures ADD CONSTRAINT salary_structures_code_unique UNIQUE (code);
ALTER TABLE shifts ADD CONSTRAINT shifts_code_unique UNIQUE (code);
ALTER TABLE system_users ADD CONSTRAINT system_users_email_unique UNIQUE (email);
ALTER TABLE user_privileges ADD CONSTRAINT user_privileges_user_module_unique UNIQUE (system_user_id, module);
ALTER TABLE work_locations ADD CONSTRAINT work_locations_code_unique UNIQUE (code);
ALTER TABLE shifts ADD CONSTRAINT shifts_overtime_policy_check CHECK ((overtime_policy = ANY (ARRAY['None'::text, 'After Shift Hours'::text, 'After Daily Limit'::text, 'After Weekly Limit'::text])));
ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_status_check CHECK ((status = ANY (ARRAY['Open'::text, 'Processing'::text, 'Closed'::text, 'Locked'::text])));
ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_frequency_check CHECK ((frequency = ANY (ARRAY['Monthly'::text, 'Weekly'::text, 'Bi-Weekly'::text, 'Quarterly'::text])));
ALTER TABLE pay_heads ADD CONSTRAINT pay_heads_type_check CHECK ((type = ANY (ARRAY['Earning'::text, 'Deduction'::text])));
ALTER TABLE location_bank_accounts ADD CONSTRAINT location_bank_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['Current'::text, 'Savings'::text, 'Overdraft'::text, 'Cash Credit'::text])));
ALTER TABLE system_users ADD CONSTRAINT system_users_role_check CHECK ((role = ANY (ARRAY['Super Admin'::text, 'Admin'::text, 'HR Manager'::text, 'Payroll Manager'::text, 'Department Manager'::text, 'Employee'::text, 'Auditor'::text])));
ALTER TABLE system_users ADD CONSTRAINT system_users_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text, 'Suspended'::text, 'Pending'::text])));
ALTER TABLE tds_slabs ADD CONSTRAINT tds_slabs_gender_check CHECK ((gender = ANY (ARRAY['All'::text, 'Male'::text, 'Female'::text, 'Senior Citizen'::text, 'Super Senior Citizen'::text])));
ALTER TABLE tds_slabs ADD CONSTRAINT tds_slabs_regime_check CHECK ((regime = ANY (ARRAY['Old'::text, 'New'::text])));
ALTER TABLE user_privileges ADD CONSTRAINT user_privileges_module_check CHECK ((module = ANY (ARRAY['Dashboard'::text, 'Employees'::text, 'Payroll'::text, 'Attendance'::text, 'Leave'::text, 'Loans'::text, 'Reports'::text, 'Configuration'::text, 'User Master'::text, 'Settings'::text])));
ALTER TABLE work_locations ADD CONSTRAINT work_locations_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE loans ADD CONSTRAINT loans_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Active'::text, 'Closed'::text, 'Rejected'::text])));
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'ManagerApproved'::text, 'Approved'::text, 'Rejected'::text])));
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_manager_status_check CHECK ((manager_status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text])));
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_hr_status_check CHECK ((hr_status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_paper_size_check CHECK ((paper_size = ANY (ARRAY['A4'::text, 'Letter'::text, 'Legal'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_website_alignment_check CHECK ((header_website_alignment = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE asset_allocations ADD CONSTRAINT asset_allocations_action_check CHECK ((action = ANY (ARRAY['Allocated'::text, 'Returned'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_tagline_alignment_check CHECK ((header_tagline_alignment = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_logo_size_check CHECK ((header_logo_size = ANY (ARRAY['sm'::text, 'md'::text, 'lg'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_logo_position_check CHECK ((header_logo_position = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_image_height_check CHECK ((header_image_height = ANY (ARRAY['sm'::text, 'md'::text, 'lg'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_divider_thickness_check CHECK ((header_divider_thickness = ANY (ARRAY['thin'::text, 'medium'::text, 'thick'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_contact_alignment_check CHECK ((header_contact_alignment = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_company_name_size_check CHECK ((header_company_name_size = ANY (ARRAY['xs'::text, 'sm'::text, 'base'::text, 'lg'::text, 'xl'::text, '2xl'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_address_alignment_check CHECK ((header_address_alignment = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_footer_page_number_align_check CHECK ((footer_page_number_align = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_footer_line2_alignment_check CHECK ((footer_line2_alignment = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_footer_line1_alignment_check CHECK ((footer_line1_alignment = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_footer_image_height_check CHECK ((footer_image_height = ANY (ARRAY['sm'::text, 'md'::text, 'lg'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_footer_divider_thickness_check CHECK ((footer_divider_thickness = ANY (ARRAY['thin'::text, 'medium'::text, 'thick'::text])));
ALTER TABLE leave_types ADD CONSTRAINT leave_types_gender_applicability_check CHECK ((gender_applicability = ANY (ARRAY['All'::text, 'Male'::text, 'Female'::text, 'Other'::text])));
ALTER TABLE letterheads ADD CONSTRAINT letterheads_header_company_name_align_check CHECK ((header_company_name_align = ANY (ARRAY['left'::text, 'center'::text, 'right'::text])));
ALTER TABLE leave_types ADD CONSTRAINT leave_types_category_check CHECK ((category = ANY (ARRAY['Casual'::text, 'Sick'::text, 'Earned'::text, 'Maternity'::text, 'Paternity'::text, 'Bereavement'::text, 'Unpaid'::text, 'Compensatory'::text, 'Study'::text, 'Other'::text])));
ALTER TABLE leave_types ADD CONSTRAINT leave_types_carry_forward_policy_check CHECK ((carry_forward_policy = ANY (ARRAY['None'::text, 'Full'::text, 'Limited'::text, 'Percentage'::text])));
ALTER TABLE leave_types ADD CONSTRAINT leave_types_accrual_frequency_check CHECK ((accrual_frequency = ANY (ARRAY['Monthly'::text, 'Quarterly'::text, 'Half-Yearly'::text, 'Annually'::text, 'None'::text])));
ALTER TABLE leave_types ADD CONSTRAINT leave_types_accrual_basis_check CHECK ((accrual_basis = ANY (ARRAY['Fixed'::text, 'Pro-Rata'::text, 'Working Days'::text])));
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text, 'Cancelled'::text])));
ALTER TABLE holidays ADD CONSTRAINT holidays_type_check CHECK ((type = ANY (ARRAY['National'::text, 'Festival'::text, 'Regional'::text, 'Optional'::text, 'Weekly Off'::text])));
ALTER TABLE location_bank_accounts ADD CONSTRAINT location_bank_accounts_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE holiday_lists ADD CONSTRAINT holiday_lists_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Draft'::text, 'Archived'::text])));
ALTER TABLE exit_settlements ADD CONSTRAINT exit_settlements_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Finalised'::text])));
ALTER TABLE exit_clearances ADD CONSTRAINT exit_clearances_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Cleared'::text, 'NA'::text])));
ALTER TABLE exit_approvals ADD CONSTRAINT exit_approvals_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text, 'Skipped'::text])));
ALTER TABLE employees ADD CONSTRAINT employees_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text, 'On Leave'::text, 'Terminated'::text, 'Resigned'::text, 'Retired'::text])));
ALTER TABLE employees ADD CONSTRAINT employees_marital_status_check CHECK ((marital_status = ANY (ARRAY['Single'::text, 'Married'::text, 'Divorced'::text, 'Widowed'::text, 'Separated'::text])));
ALTER TABLE employees ADD CONSTRAINT employees_gender_check CHECK ((gender = ANY (ARRAY['Male'::text, 'Female'::text, 'Other'::text, 'Prefer not to say'::text])));
ALTER TABLE employees ADD CONSTRAINT employees_blood_group_check CHECK ((blood_group = ANY (ARRAY['A+'::text, 'A-'::text, 'B+'::text, 'B-'::text, 'AB+'::text, 'AB-'::text, 'O+'::text, 'O-'::text])));
ALTER TABLE employee_types ADD CONSTRAINT employee_types_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE employee_sections ADD CONSTRAINT employee_sections_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE employee_languages ADD CONSTRAINT employee_languages_write_level_check CHECK ((write_level = ANY (ARRAY['None'::text, 'Basic'::text, 'Intermediate'::text, 'Advanced'::text, 'Native'::text])));
ALTER TABLE employee_languages ADD CONSTRAINT employee_languages_speak_level_check CHECK ((speak_level = ANY (ARRAY['None'::text, 'Basic'::text, 'Intermediate'::text, 'Advanced'::text, 'Native'::text])));
ALTER TABLE leave_types ADD CONSTRAINT leave_types_encashment_policy_check CHECK ((encashment_policy = ANY (ARRAY['None'::text, 'On Separation'::text, 'Annual'::text, 'On Request'::text])));
ALTER TABLE employee_groups ADD CONSTRAINT employee_groups_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE employee_groups ADD CONSTRAINT employee_groups_group_type_check CHECK ((group_type = ANY (ARRAY['Payroll'::text, 'Incentive'::text, 'Allowance'::text, 'Benefits'::text, 'Compliance'::text, 'Other'::text])));
ALTER TABLE employee_grades ADD CONSTRAINT employee_grades_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE employee_exits ADD CONSTRAINT employee_exits_status_check CHECK ((status = ANY (ARRAY['Initiated'::text, 'In Clearance'::text, 'Settled'::text, 'Relieved'::text, 'Cancelled'::text])));
ALTER TABLE employee_exits ADD CONSTRAINT employee_exits_exit_type_check CHECK ((exit_type = ANY (ARRAY['Resignation'::text, 'Termination'::text, 'Retirement'::text, 'Absconding'::text, 'End of Contract'::text, 'Death'::text, 'Retrenchment'::text, 'Layoff'::text])));
ALTER TABLE employee_languages ADD CONSTRAINT employee_languages_read_level_check CHECK ((read_level = ANY (ARRAY['None'::text, 'Basic'::text, 'Intermediate'::text, 'Advanced'::text, 'Native'::text])));
ALTER TABLE employee_classifications ADD CONSTRAINT employee_classifications_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE employee_categories ADD CONSTRAINT employee_categories_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE employee_bank_accounts ADD CONSTRAINT employee_bank_accounts_account_type_check CHECK ((account_type = ANY (ARRAY['Savings'::text, 'Current'::text, 'Salary'::text])));
ALTER TABLE designations ADD CONSTRAINT designations_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE departments ADD CONSTRAINT departments_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_status_check CHECK ((status = ANY (ARRAY['Present'::text, 'Absent'::text, 'Late'::text, 'Half Day'::text, 'On Leave'::text, 'Holiday'::text, 'Weekend'::text, 'LOP'::text])));
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_approval_status_check CHECK ((approval_status = ANY (ARRAY['Draft'::text, 'Submitted'::text, 'Approved'::text])));
ALTER TABLE assets ADD CONSTRAINT assets_status_check CHECK ((status = ANY (ARRAY['Available'::text, 'Allocated'::text, 'In Maintenance'::text, 'Retired'::text, 'Lost'::text])));
ALTER TABLE pf_esi_config ADD CONSTRAINT pf_esi_config_pf_apply_on_check CHECK ((pf_apply_on = ANY (ARRAY['Actual'::text, 'Ceiling'::text])));
ALTER TABLE polls ADD CONSTRAINT polls_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Closed'::text, 'Scheduled'::text, 'Draft'::text])));
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Processing'::text, 'Completed'::text, 'Approved'::text, 'Disbursed'::text, 'Cancelled'::text])));
ALTER TABLE polls ADD CONSTRAINT polls_type_check CHECK ((type = ANY (ARRAY['single'::text, 'multiple'::text, 'rating'::text, 'text'::text])));
ALTER TABLE reimbursement_claims ADD CONSTRAINT reimbursement_claims_raised_by_check CHECK ((raised_by = ANY (ARRAY['employee'::text, 'hr'::text])));
ALTER TABLE reimbursement_claims ADD CONSTRAINT reimbursement_claims_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Verified'::text, 'Rejected'::text, 'Closed'::text, 'Paid'::text])));
ALTER TABLE salary_components ADD CONSTRAINT salary_components_bonus_type_check CHECK ((bonus_type = ANY (ARRAY['none'::text, 'bonus'::text, 'exgratia'::text])));
ALTER TABLE salary_components ADD CONSTRAINT salary_components_calculation_basis_check CHECK ((calculation_basis = ANY (ARRAY['Fixed'::text, 'Percentage of Basic'::text, 'Percentage of Gross'::text, 'Percentage of CTC'::text, 'Formula'::text])));
ALTER TABLE salary_components ADD CONSTRAINT salary_components_esi_applicability_check CHECK ((esi_applicability = ANY (ARRAY['Applicable'::text, 'Not Applicable'::text, 'Optional'::text])));
ALTER TABLE shifts ADD CONSTRAINT shifts_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Inactive'::text])));
ALTER TABLE salary_components ADD CONSTRAINT salary_components_pf_applicability_check CHECK ((pf_applicability = ANY (ARRAY['Applicable'::text, 'Not Applicable'::text, 'Optional'::text])));
ALTER TABLE salary_components ADD CONSTRAINT salary_components_taxability_check CHECK ((taxability = ANY (ARRAY['Fully Taxable'::text, 'Partially Exempt'::text, 'Fully Exempt'::text])));
ALTER TABLE salary_components ADD CONSTRAINT salary_components_type_check CHECK ((type = ANY (ARRAY['Earning'::text, 'Deduction'::text, 'Employer Contribution'::text, 'Reimbursement'::text])));
ALTER TABLE salary_revision_arrears ADD CONSTRAINT salary_revision_arrears_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Paid'::text, 'Cancelled'::text])));
ALTER TABLE salary_revision_items ADD CONSTRAINT salary_revision_items_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Applied'::text, 'Skipped'::text])));
ALTER TABLE salary_revisions ADD CONSTRAINT salary_revisions_basis_check CHECK ((basis = ANY (ARRAY['CTC'::text, 'Gross'::text, 'Net'::text, 'TakeHome'::text])));
ALTER TABLE salary_revisions ADD CONSTRAINT salary_revisions_method_check CHECK ((method = ANY (ARRAY['Percentage'::text, 'Amount'::text])));
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_payment_status_check CHECK ((payment_status = ANY (ARRAY['Pending'::text, 'Paid'::text])));
ALTER TABLE salary_revisions ADD CONSTRAINT salary_revisions_scope_check CHECK ((scope = ANY (ARRAY['all'::text, 'location'::text, 'department'::text, 'designation'::text, 'category'::text, 'selected'::text])));
ALTER TABLE salary_revisions ADD CONSTRAINT salary_revisions_status_check CHECK ((status = ANY (ARRAY['Proposed'::text, 'Approved'::text, 'Rejected'::text, 'Applied'::text, 'Cancelled'::text])));
ALTER TABLE salary_structure_components ADD CONSTRAINT salary_structure_components_calculation_basis_check CHECK ((calculation_basis = ANY (ARRAY['Fixed'::text, 'Percentage of Basic'::text, 'Percentage of Gross'::text, 'Percentage of CTC'::text, 'Formula'::text])));
ALTER TABLE shifts ADD CONSTRAINT shifts_category_check CHECK ((category = ANY (ARRAY['General'::text, 'Morning'::text, 'Afternoon'::text, 'Night'::text, 'Rotational'::text, 'Flexible'::text])));
ALTER TABLE asset_allocations ADD CONSTRAINT asset_allocations_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;
ALTER TABLE asset_allocations ADD CONSTRAINT asset_allocations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE assets ADD CONSTRAINT assets_allocated_to_fkey FOREIGN KEY (allocated_to) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE assets ADD CONSTRAINT assets_category_id_fkey FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE SET NULL;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
ALTER TABLE deduction_entries ADD CONSTRAINT deduction_entries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE deduction_entries ADD CONSTRAINT deduction_entries_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE SET NULL;
ALTER TABLE departments ADD CONSTRAINT departments_location_id_fkey FOREIGN KEY (location_id) REFERENCES work_locations(id) ON DELETE CASCADE;
ALTER TABLE departments ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE email_deliveries ADD CONSTRAINT email_deliveries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE employee_bank_accounts ADD CONSTRAINT employee_bank_accounts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_documents ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_education ADD CONSTRAINT employee_education_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_exits ADD CONSTRAINT employee_exits_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES system_users(id) ON DELETE SET NULL;
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE RESTRICT;
ALTER TABLE employee_family ADD CONSTRAINT employee_family_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_languages ADD CONSTRAINT employee_languages_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES system_users(id) ON DELETE SET NULL;
ALTER TABLE employee_salary_assignments ADD CONSTRAINT employee_salary_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE poll_options ADD CONSTRAINT poll_options_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE;
ALTER TABLE employee_salary_assignments ADD CONSTRAINT employee_salary_assignments_salary_structure_id_fkey FOREIGN KEY (salary_structure_id) REFERENCES salary_structures(id) ON DELETE RESTRICT;
ALTER TABLE employee_statutory ADD CONSTRAINT employee_statutory_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employee_work_experience ADD CONSTRAINT employee_work_experience_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE employees ADD CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES designations(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_employee_category_id_fkey FOREIGN KEY (employee_category_id) REFERENCES employee_categories(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_employee_group_id_fkey FOREIGN KEY (employee_group_id) REFERENCES employee_groups(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_employee_type_id_fkey FOREIGN KEY (employee_type_id) REFERENCES employee_types(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES employee_grades(id) ON DELETE SET NULL;
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE;
ALTER TABLE employees ADD CONSTRAINT employees_reporting_manager_id_fkey FOREIGN KEY (reporting_manager_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
ALTER TABLE employees ADD CONSTRAINT employees_work_location_id_fkey FOREIGN KEY (work_location_id) REFERENCES work_locations(id) ON DELETE SET NULL;
ALTER TABLE exit_approvals ADD CONSTRAINT exit_approvals_approver_employee_id_fkey FOREIGN KEY (approver_employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE exit_approvals ADD CONSTRAINT exit_approvals_exit_id_fkey FOREIGN KEY (exit_id) REFERENCES employee_exits(id) ON DELETE CASCADE;
ALTER TABLE poll_votes ADD CONSTRAINT poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE;
ALTER TABLE exit_clearances ADD CONSTRAINT exit_clearances_exit_id_fkey FOREIGN KEY (exit_id) REFERENCES employee_exits(id) ON DELETE CASCADE;
ALTER TABLE reimbursement_claims ADD CONSTRAINT reimbursement_claims_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE exit_settlements ADD CONSTRAINT exit_settlements_exit_id_fkey FOREIGN KEY (exit_id) REFERENCES employee_exits(id) ON DELETE CASCADE;
ALTER TABLE generated_letters ADD CONSTRAINT generated_letters_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE generated_letters ADD CONSTRAINT generated_letters_template_id_fkey FOREIGN KEY (template_id) REFERENCES letter_templates(id) ON DELETE SET NULL;
ALTER TABLE gratuity_settlements ADD CONSTRAINT gratuity_settlements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE reimbursement_claims ADD CONSTRAINT reimbursement_claims_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE SET NULL;
ALTER TABLE holidays ADD CONSTRAINT holidays_holiday_list_id_fkey FOREIGN KEY (holiday_list_id) REFERENCES holiday_lists(id) ON DELETE CASCADE;
ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE reimbursement_claims ADD CONSTRAINT reimbursement_claims_salary_component_id_fkey FOREIGN KEY (salary_component_id) REFERENCES salary_components(id) ON DELETE SET NULL;
ALTER TABLE leave_balances ADD CONSTRAINT leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE;
ALTER TABLE leave_policy_allocations ADD CONSTRAINT leave_policy_allocations_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES leave_policies(id) ON DELETE CASCADE;
ALTER TABLE leave_policy_entitlements ADD CONSTRAINT leave_policy_entitlements_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE SET NULL;
ALTER TABLE leave_policy_entitlements ADD CONSTRAINT leave_policy_entitlements_policy_id_fkey FOREIGN KEY (policy_id) REFERENCES leave_policies(id) ON DELETE CASCADE;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE salary_revision_arrears ADD CONSTRAINT salary_revision_arrears_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE salary_revision_arrears ADD CONSTRAINT salary_revision_arrears_period_id_fkey FOREIGN KEY (period_id) REFERENCES payroll_periods(id);
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT;
ALTER TABLE letterheads ADD CONSTRAINT letterheads_location_id_fkey FOREIGN KEY (location_id) REFERENCES work_locations(id) ON DELETE CASCADE;
ALTER TABLE salary_revision_arrears ADD CONSTRAINT salary_revision_arrears_revision_id_fkey FOREIGN KEY (revision_id) REFERENCES salary_revisions(id) ON DELETE CASCADE;
ALTER TABLE salary_revision_arrears ADD CONSTRAINT salary_revision_arrears_target_period_id_fkey FOREIGN KEY (target_period_id) REFERENCES payroll_periods(id);
ALTER TABLE loan_emi_schedule ADD CONSTRAINT loan_emi_schedule_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE;
ALTER TABLE salary_revision_items ADD CONSTRAINT salary_revision_items_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_hr_id_fkey FOREIGN KEY (hr_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE;
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE loan_emi_skip_requests ADD CONSTRAINT loan_emi_skip_requests_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE SET NULL;
ALTER TABLE loans ADD CONSTRAINT loans_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE loans ADD CONSTRAINT loans_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE loans ADD CONSTRAINT loans_hr_id_fkey FOREIGN KEY (hr_id) REFERENCES employees(id);
ALTER TABLE salary_revision_items ADD CONSTRAINT salary_revision_items_revision_id_fkey FOREIGN KEY (revision_id) REFERENCES salary_revisions(id) ON DELETE CASCADE;
ALTER TABLE loans ADD CONSTRAINT loans_loan_type_id_fkey FOREIGN KEY (loan_type_id) REFERENCES loan_types(id) ON DELETE RESTRICT;
ALTER TABLE loans ADD CONSTRAINT loans_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES employees(id);
ALTER TABLE location_bank_accounts ADD CONSTRAINT location_bank_accounts_location_id_fkey FOREIGN KEY (location_id) REFERENCES work_locations(id) ON DELETE CASCADE;
ALTER TABLE location_documents ADD CONSTRAINT location_documents_location_id_fkey FOREIGN KEY (location_id) REFERENCES work_locations(id) ON DELETE CASCADE;
ALTER TABLE salary_revisions ADD CONSTRAINT salary_revisions_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id);
ALTER TABLE payroll_arrears ADD CONSTRAINT payroll_arrears_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE salary_structure_components ADD CONSTRAINT salary_structure_components_salary_component_id_fkey FOREIGN KEY (salary_component_id) REFERENCES salary_components(id) ON DELETE CASCADE;
ALTER TABLE payroll_arrears ADD CONSTRAINT payroll_arrears_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE;
ALTER TABLE salary_structure_components ADD CONSTRAINT salary_structure_components_salary_structure_id_fkey FOREIGN KEY (salary_structure_id) REFERENCES salary_structures(id) ON DELETE CASCADE;
ALTER TABLE payroll_arrears ADD CONSTRAINT payroll_arrears_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE SET NULL;
ALTER TABLE system_users ADD CONSTRAINT system_users_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE payroll_entries ADD CONSTRAINT payroll_entries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
ALTER TABLE payroll_entries ADD CONSTRAINT payroll_entries_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE RESTRICT;
ALTER TABLE payroll_entries ADD CONSTRAINT payroll_entries_payroll_run_id_fkey FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE;
ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES system_users(id) ON DELETE SET NULL;
ALTER TABLE user_privileges ADD CONSTRAINT user_privileges_system_user_id_fkey FOREIGN KEY (system_user_id) REFERENCES system_users(id) ON DELETE CASCADE;
ALTER TABLE system_users ADD CONSTRAINT system_users_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE payroll_precheck_stages ADD CONSTRAINT payroll_precheck_stages_payroll_period_id_fkey FOREIGN KEY (payroll_period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE;

-- ===== INDEXES =====
CREATE INDEX assets_allocated_idx ON public.assets USING btree (allocated_to);
CREATE INDEX assets_category_idx ON public.assets USING btree (category_id);
CREATE INDEX document_signatures_document_ref_idx ON public.document_signatures USING btree (document_ref);
CREATE INDEX document_signatures_source_idx ON public.document_signatures USING btree (source);
CREATE INDEX documents_category_idx ON public.documents USING btree (entity_type, entity_ref, category);
CREATE INDEX documents_entity_idx ON public.documents USING btree (entity_type, entity_ref);
CREATE INDEX employee_exits_employee_idx ON public.employee_exits USING btree (employee_id);
CREATE INDEX employee_exits_status_idx ON public.employee_exits USING btree (status);
CREATE UNIQUE INDEX employees_attendance_system_id_unique ON public.employees USING btree (attendance_system_id) WHERE (attendance_system_id IS NOT NULL);
CREATE INDEX exit_approvals_approver_idx ON public.exit_approvals USING btree (approver_employee_id, status);
CREATE INDEX exit_approvals_exit_idx ON public.exit_approvals USING btree (exit_id);
CREATE INDEX exit_clearances_exit_idx ON public.exit_clearances USING btree (exit_id);
CREATE INDEX idx_attendance_date ON public.attendance_records USING btree (attendance_date);
CREATE INDEX idx_attendance_emp_date ON public.attendance_records USING btree (employee_id, attendance_date);
CREATE INDEX idx_attendance_status ON public.attendance_records USING btree (status);
CREATE INDEX idx_departments_location_id ON public.departments USING btree (location_id);
CREATE INDEX idx_departments_parent_id ON public.departments USING btree (parent_id);
CREATE INDEX idx_departments_status ON public.departments USING btree (status);
CREATE INDEX idx_email_deliveries_category ON public.email_deliveries USING btree (category, created_at DESC);
CREATE INDEX idx_email_deliveries_employee ON public.email_deliveries USING btree (employee_id, created_at DESC);
CREATE INDEX idx_email_deliveries_token ON public.email_deliveries USING btree (token);
CREATE INDEX idx_emi_due_date ON public.loan_emi_schedule USING btree (due_date);
CREATE INDEX idx_emi_loan_paid ON public.loan_emi_schedule USING btree (loan_id, is_paid);
CREATE INDEX idx_emp_bank_employee_id ON public.employee_bank_accounts USING btree (employee_id);
CREATE INDEX idx_emp_bank_is_primary ON public.employee_bank_accounts USING btree (is_primary);
CREATE INDEX idx_emp_dept_location ON public.employees USING btree (department_id, work_location_id);
CREATE INDEX idx_emp_docs_category ON public.employee_documents USING btree (document_category);
CREATE INDEX idx_emp_docs_employee_id ON public.employee_documents USING btree (employee_id);
CREATE INDEX idx_emp_education_employee_id ON public.employee_education USING btree (employee_id);
CREATE INDEX idx_emp_family_employee_id ON public.employee_family USING btree (employee_id);
CREATE INDEX idx_emp_family_is_nominee ON public.employee_family USING btree (is_nominee);
CREATE INDEX idx_emp_languages_employee_id ON public.employee_languages USING btree (employee_id);
CREATE INDEX idx_emp_sal_assign_effective_from ON public.employee_salary_assignments USING btree (effective_from);
CREATE INDEX idx_emp_sal_assign_employee_id ON public.employee_salary_assignments USING btree (employee_id);
CREATE INDEX idx_emp_sal_assign_is_current ON public.employee_salary_assignments USING btree (is_current);
CREATE INDEX idx_emp_sal_assign_structure_id ON public.employee_salary_assignments USING btree (salary_structure_id);
CREATE INDEX idx_emp_status_joining ON public.employees USING btree (status, date_of_joining);
CREATE INDEX idx_emp_statutory_employee_id ON public.employee_statutory USING btree (employee_id);
CREATE INDEX idx_emp_statutory_pan_no ON public.employee_statutory USING btree (pan_no);
CREATE INDEX idx_emp_statutory_uan_no ON public.employee_statutory USING btree (uan_no);
CREATE INDEX idx_emp_work_exp_employee_id ON public.employee_work_experience USING btree (employee_id);
CREATE INDEX idx_employees_current_emp_id ON public.employees USING btree (current_employee_id);
CREATE INDEX idx_employees_date_of_joining ON public.employees USING btree (date_of_joining);
CREATE INDEX idx_employees_department_id ON public.employees USING btree (department_id);
CREATE INDEX idx_employees_designation_id ON public.employees USING btree (designation_id);
CREATE INDEX idx_employees_employee_id ON public.employees USING btree (employee_id);
CREATE INDEX idx_employees_reporting_manager ON public.employees USING btree (reporting_manager_id);
CREATE INDEX idx_employees_status ON public.employees USING btree (status);
CREATE INDEX idx_employees_work_location_id ON public.employees USING btree (work_location_id);
CREATE INDEX idx_holiday_lists_status ON public.holiday_lists USING btree (status);
CREATE INDEX idx_holiday_lists_year ON public.holiday_lists USING btree (year);
CREATE INDEX idx_holidays_list_date ON public.holidays USING btree (holiday_list_id, holiday_date);
CREATE INDEX idx_holidays_type ON public.holidays USING btree (type);
CREATE INDEX idx_leave_bal_emp_year ON public.leave_balances USING btree (employee_id, year);
CREATE INDEX idx_leave_bal_type_id ON public.leave_balances USING btree (leave_type_id);
CREATE INDEX idx_leave_req_applied_on ON public.leave_requests USING btree (applied_on);
CREATE INDEX idx_leave_req_emp_status ON public.leave_requests USING btree (employee_id, status);
CREATE INDEX idx_leave_req_from_date ON public.leave_requests USING btree (from_date);
CREATE INDEX idx_leave_req_to_date ON public.leave_requests USING btree (to_date);
CREATE INDEX idx_leave_req_type_id ON public.leave_requests USING btree (leave_type_id);
CREATE INDEX idx_leave_requests_mgr ON public.leave_requests USING btree (manager_id, manager_status);
CREATE INDEX idx_leave_types_category ON public.leave_types USING btree (category);
CREATE INDEX idx_leave_types_code ON public.leave_types USING btree (code);
CREATE INDEX idx_leave_types_is_active ON public.leave_types USING btree (is_active);
CREATE INDEX idx_leave_types_is_paid ON public.leave_types USING btree (is_paid);
CREATE INDEX idx_letterheads_is_active ON public.letterheads USING btree (is_active);
CREATE INDEX idx_letterheads_location_id ON public.letterheads USING btree (location_id);
CREATE INDEX idx_loan_types_code ON public.loan_types USING btree (code);
CREATE INDEX idx_loan_types_is_active ON public.loan_types USING btree (is_active);
CREATE INDEX idx_loans_applied_date ON public.loans USING btree (applied_date);
CREATE INDEX idx_loans_emp_status ON public.loans USING btree (employee_id, status);
CREATE INDEX idx_loans_type_id ON public.loans USING btree (loan_type_id);
CREATE INDEX idx_loc_bank_is_primary ON public.location_bank_accounts USING btree (is_primary);
CREATE INDEX idx_loc_bank_location_id ON public.location_bank_accounts USING btree (location_id);
CREATE INDEX idx_loc_docs_category ON public.location_documents USING btree (document_category);
CREATE INDEX idx_loc_docs_location_id ON public.location_documents USING btree (location_id);
CREATE INDEX idx_pay_heads_code ON public.pay_heads USING btree (code);
CREATE INDEX idx_pay_heads_is_active ON public.pay_heads USING btree (is_active);
CREATE INDEX idx_pay_heads_type ON public.pay_heads USING btree (type);
CREATE INDEX idx_payroll_entries_emp_id ON public.payroll_entries USING btree (employee_id);
CREATE INDEX idx_payroll_entries_period ON public.payroll_entries USING btree (payroll_period_id);
CREATE INDEX idx_payroll_entries_run ON public.payroll_entries USING btree (payroll_run_id, employee_id);
CREATE INDEX idx_payroll_entries_status ON public.payroll_entries USING btree (status);
CREATE INDEX idx_payroll_period_from_date ON public.payroll_periods USING btree (from_date);
CREATE INDEX idx_payroll_period_fy ON public.payroll_periods USING btree (financial_year, status);
CREATE INDEX idx_payroll_period_is_default ON public.payroll_periods USING btree (is_default);
CREATE INDEX idx_payroll_period_to_date ON public.payroll_periods USING btree (to_date);
CREATE INDEX idx_payroll_runs_period_id ON public.payroll_runs USING btree (payroll_period_id);
CREATE INDEX idx_payroll_runs_run_date ON public.payroll_runs USING btree (run_date);
CREATE INDEX idx_payroll_runs_status ON public.payroll_runs USING btree (status);
CREATE INDEX idx_reimbursement_claims_mgr ON public.reimbursement_claims USING btree (manager_id, manager_status);
CREATE INDEX idx_sal_struct_comp_comp_id ON public.salary_structure_components USING btree (salary_component_id);
CREATE INDEX idx_sal_struct_comp_struct_id ON public.salary_structure_components USING btree (salary_structure_id);
CREATE INDEX idx_salary_comp_code ON public.salary_components USING btree (code);
CREATE INDEX idx_salary_comp_is_active ON public.salary_components USING btree (is_active);
CREATE INDEX idx_salary_comp_is_system_defined ON public.salary_components USING btree (is_system_defined);
CREATE INDEX idx_salary_comp_type ON public.salary_components USING btree (type);
CREATE INDEX idx_salary_revision_items_employee ON public.salary_revision_items USING btree (employee_id);
CREATE INDEX idx_salary_revision_items_revision ON public.salary_revision_items USING btree (revision_id);
CREATE INDEX idx_salary_struct_code ON public.salary_structures USING btree (code);
CREATE INDEX idx_salary_struct_is_active ON public.salary_structures USING btree (is_active);
CREATE INDEX idx_shifts_category ON public.shifts USING btree (category);
CREATE INDEX idx_shifts_code ON public.shifts USING btree (code);
CREATE INDEX idx_shifts_status ON public.shifts USING btree (status);
CREATE INDEX idx_sra_employee ON public.salary_revision_arrears USING btree (employee_id);
CREATE INDEX idx_sra_revision ON public.salary_revision_arrears USING btree (revision_id);
CREATE INDEX idx_sra_target ON public.salary_revision_arrears USING btree (target_period_id, status);
CREATE INDEX idx_system_users_auth_id ON public.system_users USING btree (auth_user_id);
CREATE INDEX idx_system_users_email ON public.system_users USING btree (email);
CREATE INDEX idx_system_users_employee_id ON public.system_users USING btree (employee_id);
CREATE INDEX idx_system_users_role ON public.system_users USING btree (role);
CREATE INDEX idx_system_users_status ON public.system_users USING btree (status);
CREATE INDEX idx_tds_fy_regime ON public.tds_slabs USING btree (financial_year, regime);
CREATE INDEX idx_tds_gender ON public.tds_slabs USING btree (gender);
CREATE INDEX idx_user_privileges_module ON public.user_privileges USING btree (system_user_id, module);
CREATE INDEX idx_user_privileges_user_id ON public.user_privileges USING btree (system_user_id);
CREATE INDEX idx_work_locations_code ON public.work_locations USING btree (code);
CREATE INDEX idx_work_locations_factory ON public.work_locations USING btree (is_factory);
CREATE INDEX idx_work_locations_status ON public.work_locations USING btree (status);
CREATE INDEX letter_template_models_category_idx ON public.letter_template_models USING btree (category, sort_order);
CREATE INDEX loan_emi_skip_employee_id_idx ON public.loan_emi_skip_requests USING btree (employee_id);
CREATE INDEX loan_emi_skip_loan_id_idx ON public.loan_emi_skip_requests USING btree (loan_id);
CREATE INDEX loan_emi_skip_status_idx ON public.loan_emi_skip_requests USING btree (status);
CREATE INDEX lookup_values_category_idx ON public.lookup_values USING btree (category, sort_order);
CREATE INDEX poll_options_poll_id_idx ON public.poll_options USING btree (poll_id);
CREATE INDEX poll_votes_employee_id_idx ON public.poll_votes USING btree (employee_id);
CREATE INDEX poll_votes_poll_id_idx ON public.poll_votes USING btree (poll_id);
CREATE INDEX reimbursement_claims_employee_idx ON public.reimbursement_claims USING btree (employee_id);
CREATE INDEX reimbursement_claims_period_idx ON public.reimbursement_claims USING btree (payroll_period_id);
CREATE INDEX reimbursement_claims_status_idx ON public.reimbursement_claims USING btree (status);
CREATE UNIQUE INDEX system_users_login_id_unique ON public.system_users USING btree (login_id);

-- ===== TRIGGERS =====
CREATE TRIGGER trg_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_designations_updated_at BEFORE UPDATE ON public.designations FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_employee_categories_updated_at BEFORE UPDATE ON public.employee_categories FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_employee_grades_updated_at BEFORE UPDATE ON public.employee_grades FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_employee_groups_updated_at BEFORE UPDATE ON public.employee_groups FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_employee_salary_assignments_updated_at BEFORE UPDATE ON public.employee_salary_assignments FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_employee_sections_updated_at BEFORE UPDATE ON public.employee_sections FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_employee_statutory_updated_at BEFORE UPDATE ON public.employee_statutory FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_employee_types_updated_at BEFORE UPDATE ON public.employee_types FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_establishment_updated_at BEFORE UPDATE ON public.establishment FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_holiday_lists_updated_at BEFORE UPDATE ON public.holiday_lists FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_leave_balances_updated_at BEFORE UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_leave_types_updated_at BEFORE UPDATE ON public.leave_types FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_loan_types_updated_at BEFORE UPDATE ON public.loan_types FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_location_bank_accounts_updated_at BEFORE UPDATE ON public.location_bank_accounts FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_pay_heads_updated_at BEFORE UPDATE ON public.pay_heads FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_payroll_entries_updated_at BEFORE UPDATE ON public.payroll_entries FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_payroll_periods_updated_at BEFORE UPDATE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_payroll_runs_updated_at BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_salary_components_updated_at BEFORE UPDATE ON public.salary_components FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_salary_structures_updated_at BEFORE UPDATE ON public.salary_structures FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_system_users_updated_at BEFORE UPDATE ON public.system_users FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_user_privileges_updated_at BEFORE UPDATE ON public.user_privileges FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_work_locations_updated_at BEFORE UPDATE ON public.work_locations FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER trg_system_users_hash_password BEFORE INSERT OR UPDATE OF password ON public.system_users FOR EACH ROW EXECUTE FUNCTION hash_system_user_password();

-- ===== RLS ENABLE =====
ALTER TABLE asset_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE deduction_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_exits ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_family ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salary_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_statutory ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_work_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishment ENABLE ROW LEVEL SECURITY;
ALTER TABLE exit_clearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE exit_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE holiday_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookup_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gratuity_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE exit_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_emi_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_template_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_emi_skip_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_policy_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE letterheads ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE pf_esi_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_tax_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_arrears ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_precheck_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reimbursement_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dashboard_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE tds_slabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_revision_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_privileges ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_revision_arrears ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_policy_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_structure_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY;

-- ===== POLICIES =====
CREATE POLICY asset_allocations_all ON asset_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY asset_categories_all ON asset_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY assets_all ON assets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY attendance_records_authenticated_all ON attendance_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated all deduction_entries" ON deduction_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY departments_authenticated_all ON departments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY designations_authenticated_all ON designations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY docsig_admin_all ON document_signatures FOR ALL TO authenticated USING (is_doc_admin()) WITH CHECK (is_doc_admin());
CREATE POLICY docsig_owner_insert ON document_signatures FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM documents d
  WHERE (((d.id)::text = document_signatures.document_ref) AND owns_employee_doc(d.entity_type, d.entity_ref)))));
CREATE POLICY docsig_owner_select ON document_signatures FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM documents d
  WHERE (((d.id)::text = document_signatures.document_ref) AND owns_employee_doc(d.entity_type, d.entity_ref)))));
CREATE POLICY documents_admin_all ON documents FOR ALL TO authenticated USING (is_doc_admin()) WITH CHECK (is_doc_admin());
CREATE POLICY documents_owner_delete ON documents FOR DELETE TO authenticated USING (owns_employee_doc(entity_type, entity_ref));
CREATE POLICY documents_owner_insert ON documents FOR INSERT TO authenticated WITH CHECK ((owns_employee_doc(entity_type, entity_ref) AND (COALESCE(doc_group, 'personal'::text) <> 'employment'::text)));
CREATE POLICY documents_owner_select ON documents FOR SELECT TO authenticated USING (owns_employee_doc(entity_type, entity_ref));
CREATE POLICY documents_owner_update ON documents FOR UPDATE TO authenticated USING (owns_employee_doc(entity_type, entity_ref)) WITH CHECK (owns_employee_doc(entity_type, entity_ref));
CREATE POLICY email_deliveries_all ON email_deliveries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_bank_accounts_authenticated_all ON employee_bank_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_categories_authenticated_all ON employee_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_classifications_authenticated_all ON employee_classifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_documents_authenticated_all ON employee_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_education_authenticated_all ON employee_education FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_exits_all ON employee_exits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_family_authenticated_all ON employee_family FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_grades_authenticated_all ON employee_grades FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_groups_authenticated_all ON employee_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_languages_authenticated_all ON employee_languages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_salary_assignments_authenticated_all ON employee_salary_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_sections_authenticated_all ON employee_sections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_statutory_authenticated_all ON employee_statutory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_types_authenticated_all ON employee_types FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employee_work_experience_authenticated_all ON employee_work_experience FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY employees_authenticated_all ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY establishment_authenticated_all ON establishment FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY exit_approvals_all ON exit_approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY exit_clearances_all ON exit_clearances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY exit_settlements_all ON exit_settlements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated all generated_letters" ON generated_letters FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY gratuity_settlements_authenticated_all ON gratuity_settlements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY holiday_lists_authenticated_all ON holiday_lists FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY holidays_authenticated_all ON holidays FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY leave_balances_authenticated_all ON leave_balances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY leave_policies_authenticated_all ON leave_policies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated all leave_policy_allocations" ON leave_policy_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY leave_policy_entitlements_authenticated_all ON leave_policy_entitlements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY leave_requests_authenticated_all ON leave_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY leave_types_authenticated_all ON leave_types FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated all letter_categories" ON letter_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated all letter_template_models" ON letter_template_models FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated all letter_templates" ON letter_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY letterheads_authenticated_all ON letterheads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY loan_emi_schedule_authenticated_all ON loan_emi_schedule FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY loan_emi_skip_requests_authenticated_all ON loan_emi_skip_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY loan_types_authenticated_all ON loan_types FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY loans_authenticated_all ON loans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY location_bank_accounts_authenticated_all ON location_bank_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY location_documents_authenticated_all ON location_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY lookup_values_authenticated_all ON lookup_values FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pay_heads_authenticated_all ON pay_heads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY payroll_arrears_all ON payroll_arrears FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY payroll_entries_authenticated_all ON payroll_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY payroll_periods_authenticated_all ON payroll_periods FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated all payroll_precheck_stages" ON payroll_precheck_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY payroll_runs_authenticated_all ON payroll_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY pf_esi_config_authenticated_all ON pf_esi_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY poll_options_authenticated_all ON poll_options FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY poll_votes_authenticated_all ON poll_votes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY polls_authenticated_all ON polls FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY professional_tax_slabs_authenticated_all ON professional_tax_slabs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY reimbursement_claims_all ON reimbursement_claims FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY salary_components_authenticated_all ON salary_components FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all salary_revision_arrears" ON salary_revision_arrears FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all salary_revision_items" ON salary_revision_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all salary_revisions" ON salary_revisions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY salary_structure_components_authenticated_all ON salary_structure_components FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY salary_structures_authenticated_all ON salary_structures FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY shifts_authenticated_all ON shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY system_users_authenticated_all ON system_users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY tds_slabs_authenticated_all ON tds_slabs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY own_dashboard_prefs ON user_dashboard_preferences FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY user_privileges_authenticated_all ON user_privileges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY work_locations_authenticated_all ON work_locations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== GRANTS =====
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
revoke all on function public.auth_user_id_by_email(text) from anon, authenticated;
