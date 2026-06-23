-- ============================================================================
--  SakthiHR HRMS & Payroll — Database STRUCTURE for Microsoft Access
--  Generated: 2026-06-17
--  Source: Supabase Postgres (public schema)  ->  Access (Jet/ACE) DDL
--
--  HOW TO USE — two options:
--   A) One-click: open Access, create a blank database in THIS folder, press
--      Alt+F11, Insert > Module, paste Import_To_Access.bas, run BuildSchema().
--   B) Manual: open each CREATE/ALTER statement in Access Query Design > SQL
--      View and Run (Access executes one DDL statement at a time).
--
--  Type mapping: uuid->TEXT(38), text/json/jsonb/array->LONGTEXT(Memo),
--  integer->INTEGER(Long), numeric/bigint/float->DOUBLE, boolean->YESNO,
--  timestamp/date->DATETIME. Postgres RLS, defaults, and CHECK constraints are
--  NOT represented in Access. Run the CREATE TABLE block first, then the
--  FOREIGN KEY block (so referenced tables exist).
-- ============================================================================

-- ===== TABLES =====

CREATE TABLE [attendance_records] (
  [id] TEXT(38) NOT NULL,
  [employee_id] TEXT(38) NOT NULL,
  [attendance_date] DATETIME NOT NULL,
  [check_in] DATETIME,
  [check_out] DATETIME,
  [hours_worked] DOUBLE NOT NULL,
  [overtime_hours] DOUBLE NOT NULL,
  [status] LONGTEXT NOT NULL,
  [shift_id] TEXT(38),
  [remarks] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_attendance_records] PRIMARY KEY ([id])
);

CREATE TABLE [departments] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [parent_id] TEXT(38),
  [location_id] TEXT(38) NOT NULL,
  [head_name] LONGTEXT,
  [employee_count] INTEGER NOT NULL,
  [status] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_departments] PRIMARY KEY ([id])
);

CREATE TABLE [designations] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [description] LONGTEXT,
  [level] INTEGER NOT NULL,
  [department] LONGTEXT,
  [status] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_designations] PRIMARY KEY ([id])
);

CREATE TABLE [document_signatures] (
  [id] TEXT(38) NOT NULL,
  [document_ref] LONGTEXT NOT NULL,
  [document_name] LONGTEXT,
  [document_category] LONGTEXT,
  [source] LONGTEXT,
  [signer_name] LONGTEXT,
  [signer_employee_id] LONGTEXT,
  [signed_by] TEXT(38),
  [aadhaar_last4] LONGTEXT,
  [transaction_id] LONGTEXT,
  [signature_hash] LONGTEXT,
  [signed_at] LONGTEXT,
  [signed_timestamp] DATETIME NOT NULL,
  [created_at] DATETIME NOT NULL,
  CONSTRAINT [pk_document_signatures] PRIMARY KEY ([id])
);

CREATE TABLE [documents] (
  [id] TEXT(38) NOT NULL,
  [entity_type] LONGTEXT NOT NULL,
  [entity_ref] LONGTEXT NOT NULL,
  [category] LONGTEXT,
  [file_name] LONGTEXT NOT NULL,
  [file_path] LONGTEXT NOT NULL,
  [bucket] LONGTEXT NOT NULL,
  [mime_type] LONGTEXT,
  [size_bytes] DOUBLE,
  [uploaded_by] TEXT(38),
  [signed] YESNO NOT NULL,
  [signature] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  CONSTRAINT [pk_documents] PRIMARY KEY ([id])
);

CREATE TABLE [employee_bank_accounts] (
  [id] TEXT(38) NOT NULL,
  [employee_id] TEXT(38) NOT NULL,
  [bank_name] LONGTEXT NOT NULL,
  [account_name] LONGTEXT NOT NULL,
  [account_number] LONGTEXT NOT NULL,
  [ifsc_code] LONGTEXT NOT NULL,
  [branch_name] LONGTEXT,
  [branch_address] LONGTEXT,
  [account_type] LONGTEXT NOT NULL,
  [is_primary] YESNO NOT NULL,
  [swift_code] LONGTEXT,
  [micr_code] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  CONSTRAINT [pk_employee_bank_accounts] PRIMARY KEY ([id])
);

CREATE TABLE [employee_categories] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [description] LONGTEXT,
  [status] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_employee_categories] PRIMARY KEY ([id])
);

CREATE TABLE [employee_classifications] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT,
  [description] LONGTEXT,
  [status] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_employee_classifications] PRIMARY KEY ([id])
);

CREATE TABLE [employee_documents] (
  [id] TEXT(38) NOT NULL,
  [employee_id] TEXT(38) NOT NULL,
  [document_category] LONGTEXT NOT NULL,
  [document_name] LONGTEXT NOT NULL,
  [file_url] LONGTEXT NOT NULL,
  [file_size] INTEGER,
  [file_type] LONGTEXT,
  [description] LONGTEXT,
  [uploaded_at] DATETIME NOT NULL,
  CONSTRAINT [pk_employee_documents] PRIMARY KEY ([id])
);

CREATE TABLE [employee_education] (
  [id] TEXT(38) NOT NULL,
  [employee_id] TEXT(38) NOT NULL,
  [qualification] LONGTEXT NOT NULL,
  [specialization] LONGTEXT,
  [institution] LONGTEXT,
  [university] LONGTEXT,
  [year_of_passing] LONGTEXT,
  [percentage] LONGTEXT,
  [grade] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  CONSTRAINT [pk_employee_education] PRIMARY KEY ([id])
);

CREATE TABLE [employee_family] (
  [id] TEXT(38) NOT NULL,
  [employee_id] TEXT(38) NOT NULL,
  [relationship] LONGTEXT NOT NULL,
  [name] LONGTEXT NOT NULL,
  [date_of_birth] DATETIME,
  [gender] LONGTEXT,
  [occupation] LONGTEXT,
  [phone] LONGTEXT,
  [is_dependent] YESNO NOT NULL,
  [is_nominee] YESNO NOT NULL,
  [nomination_percentage] DOUBLE NOT NULL,
  [nomination_purpose] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  CONSTRAINT [pk_employee_family] PRIMARY KEY ([id])
);

CREATE TABLE [employee_grades] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [description] LONGTEXT,
  [grade_level] INTEGER NOT NULL,
  [min_salary] DOUBLE NOT NULL,
  [max_salary] DOUBLE NOT NULL,
  [status] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_employee_grades] PRIMARY KEY ([id])
);

CREATE TABLE [employee_groups] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [description] LONGTEXT,
  [group_type] LONGTEXT NOT NULL,
  [status] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_employee_groups] PRIMARY KEY ([id])
);

CREATE TABLE [employee_languages] (
  [id] TEXT(38) NOT NULL,
  [employee_id] TEXT(38) NOT NULL,
  [language] LONGTEXT NOT NULL,
  [speak_level] LONGTEXT NOT NULL,
  [read_level] LONGTEXT NOT NULL,
  [write_level] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  CONSTRAINT [pk_employee_languages] PRIMARY KEY ([id])
);

CREATE TABLE [employee_salary_assignments] (
  [id] TEXT(38) NOT NULL,
  [employee_id] TEXT(38) NOT NULL,
  [salary_structure_id] TEXT(38) NOT NULL,
  [ctc_annual] DOUBLE NOT NULL,
  [ctc_monthly] DOUBLE NOT NULL,
  [effective_from] DATETIME NOT NULL,
  [effective_to] DATETIME,
  [is_current] YESNO NOT NULL,
  [created_at] DATETIME NOT NULL,
  CONSTRAINT [pk_employee_salary_assignments] PRIMARY KEY ([id])
);

CREATE TABLE [employee_sections] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [description] LONGTEXT,
  [parent_section] LONGTEXT,
  [status] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_employee_sections] PRIMARY KEY ([id])
);

CREATE TABLE [employee_statutory] (
  [id] TEXT(38) NOT NULL,
  [employee_id] TEXT(38) NOT NULL,
  [pan_no] LONGTEXT,
  [aadhar_no] LONGTEXT,
  [uan_no] LONGTEXT,
  [pf_account_no] LONGTEXT,
  [esi_no] LONGTEXT,
  [passport_no] LONGTEXT,
  [passport_expiry] DATETIME,
  [driving_license_no] LONGTEXT,
  [driving_license_expiry] DATETIME,
  [voter_id_no] LONGTEXT,
  [ration_card_no] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_employee_statutory] PRIMARY KEY ([id])
);

CREATE TABLE [employee_types] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [description] LONGTEXT,
  [is_contractual] YESNO NOT NULL,
  [status] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_employee_types] PRIMARY KEY ([id])
);

CREATE TABLE [employee_work_experience] (
  [id] TEXT(38) NOT NULL,
  [employee_id] TEXT(38) NOT NULL,
  [company_name] LONGTEXT NOT NULL,
  [designation] LONGTEXT,
  [department] LONGTEXT,
  [from_date] DATETIME,
  [to_date] DATETIME,
  [years_of_experience] INTEGER NOT NULL,
  [months_of_experience] INTEGER NOT NULL,
  [reason_for_leaving] LONGTEXT,
  [last_salary] LONGTEXT,
  [reference_name] LONGTEXT,
  [reference_designation] LONGTEXT,
  [reference_phone] LONGTEXT,
  [reference_email] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  CONSTRAINT [pk_employee_work_experience] PRIMARY KEY ([id])
);

CREATE TABLE [employees] (
  [id] TEXT(38) NOT NULL,
  [employee_id] LONGTEXT NOT NULL,
  [current_employee_id] LONGTEXT,
  [service_book_no] LONGTEXT,
  [first_name] LONGTEXT NOT NULL,
  [middle_name] LONGTEXT,
  [last_name] LONGTEXT NOT NULL,
  [father_name] LONGTEXT,
  [mother_name] LONGTEXT,
  [date_of_birth] DATETIME,
  [place_of_birth] LONGTEXT,
  [nationality] LONGTEXT NOT NULL,
  [identification_marks] LONGTEXT,
  [gender] LONGTEXT,
  [marital_status] LONGTEXT,
  [blood_group] LONGTEXT,
  [religion] LONGTEXT,
  [caste] LONGTEXT,
  [mother_tongue] LONGTEXT,
  [photo_url] LONGTEXT,
  [signature_url] LONGTEXT,
  [thumb_impression_url] LONGTEXT,
  [present_address_line1] LONGTEXT,
  [present_address_line2] LONGTEXT,
  [present_city] LONGTEXT,
  [present_district] LONGTEXT,
  [present_state] LONGTEXT,
  [present_pincode] LONGTEXT,
  [present_country] LONGTEXT NOT NULL,
  [permanent_address_line1] LONGTEXT,
  [permanent_address_line2] LONGTEXT,
  [permanent_city] LONGTEXT,
  [permanent_district] LONGTEXT,
  [permanent_state] LONGTEXT,
  [permanent_pincode] LONGTEXT,
  [permanent_country] LONGTEXT NOT NULL,
  [same_address] YESNO NOT NULL,
  [date_of_joining] DATETIME,
  [date_of_confirmation] DATETIME,
  [probation_period_months] INTEGER NOT NULL,
  [designation_id] TEXT(38),
  [department_id] TEXT(38),
  [section] LONGTEXT,
  [grade_id] TEXT(38),
  [employee_type_id] TEXT(38),
  [employee_category_id] TEXT(38),
  [employee_group_id] TEXT(38),
  [work_location_id] TEXT(38),
  [shift_id] TEXT(38),
  [reporting_manager_id] TEXT(38),
  [notice_period_days] INTEGER NOT NULL,
  [offer_letter_validity_days] INTEGER NOT NULL,
  [total_experience_years] INTEGER NOT NULL,
  [total_experience_months] INTEGER NOT NULL,
  [status] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  [employee_classification] LONGTEXT,
  CONSTRAINT [pk_employees] PRIMARY KEY ([id])
);

CREATE TABLE [establishment] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [short_name] LONGTEXT,
  [incorporation_date] DATETIME,
  [industry_type] LONGTEXT,
  [entity_type] LONGTEXT,
  [website] LONGTEXT,
  [email] LONGTEXT,
  [phone] LONGTEXT,
  [currency_code] LONGTEXT NOT NULL,
  [address_line1] LONGTEXT,
  [address_line2] LONGTEXT,
  [city] LONGTEXT,
  [district] LONGTEXT,
  [state] LONGTEXT,
  [pincode] LONGTEXT,
  [country] LONGTEXT NOT NULL,
  [logo_url] LONGTEXT,
  [occupier_name] LONGTEXT,
  [occupier_designation] LONGTEXT,
  [occupier_phone] LONGTEXT,
  [occupier_email] LONGTEXT,
  [occupier_address_line1] LONGTEXT,
  [occupier_address_line2] LONGTEXT,
  [occupier_city] LONGTEXT,
  [occupier_district] LONGTEXT,
  [occupier_state] LONGTEXT,
  [occupier_pincode] LONGTEXT,
  [manager_name] LONGTEXT,
  [manager_designation] LONGTEXT,
  [manager_phone] LONGTEXT,
  [manager_email] LONGTEXT,
  [manager_address_line1] LONGTEXT,
  [manager_address_line2] LONGTEXT,
  [manager_city] LONGTEXT,
  [manager_district] LONGTEXT,
  [manager_state] LONGTEXT,
  [manager_pincode] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_establishment] PRIMARY KEY ([id])
);

CREATE TABLE [holiday_lists] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [year] INTEGER NOT NULL,
  [from_date] DATETIME NOT NULL,
  [to_date] DATETIME NOT NULL,
  [description] LONGTEXT,
  [status] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_holiday_lists] PRIMARY KEY ([id])
);

CREATE TABLE [holidays] (
  [id] TEXT(38) NOT NULL,
  [holiday_list_id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [holiday_date] DATETIME NOT NULL,
  [type] LONGTEXT NOT NULL,
  [description] LONGTEXT,
  [is_recurring] YESNO NOT NULL,
  [location] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  [is_half_day] YESNO NOT NULL,
  [half_day_session] LONGTEXT,
  CONSTRAINT [pk_holidays] PRIMARY KEY ([id])
);

CREATE TABLE [leave_balances] (
  [id] TEXT(38) NOT NULL,
  [employee_id] TEXT(38) NOT NULL,
  [leave_type_id] TEXT(38) NOT NULL,
  [year] INTEGER NOT NULL,
  [opening_balance] DOUBLE NOT NULL,
  [accrued] DOUBLE NOT NULL,
  [used] DOUBLE NOT NULL,
  [pending] DOUBLE NOT NULL,
  [encashed] DOUBLE NOT NULL,
  [lapsed] DOUBLE NOT NULL,
  [closing_balance] DOUBLE NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_leave_balances] PRIMARY KEY ([id])
);

CREATE TABLE [leave_requests] (
  [id] TEXT(38) NOT NULL,
  [employee_id] TEXT(38) NOT NULL,
  [leave_type_id] TEXT(38) NOT NULL,
  [from_date] DATETIME NOT NULL,
  [to_date] DATETIME NOT NULL,
  [days] DOUBLE NOT NULL,
  [is_half_day] YESNO NOT NULL,
  [reason] LONGTEXT,
  [contact_during_leave] LONGTEXT,
  [handover_to] LONGTEXT,
  [status] LONGTEXT NOT NULL,
  [applied_on] DATETIME NOT NULL,
  [approved_by] TEXT(38),
  [approved_on] DATETIME,
  [remarks] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_leave_requests] PRIMARY KEY ([id])
);

CREATE TABLE [leave_types] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [category] LONGTEXT NOT NULL,
  [color] LONGTEXT NOT NULL,
  [description] LONGTEXT,
  [max_days_per_year] DOUBLE NOT NULL,
  [max_consecutive_days] INTEGER NOT NULL,
  [min_days_per_application] DOUBLE NOT NULL,
  [allow_half_day] YESNO NOT NULL,
  [requires_documentation] YESNO NOT NULL,
  [documentation_after_days] INTEGER NOT NULL,
  [advance_notice_days] INTEGER NOT NULL,
  [is_paid] YESNO NOT NULL,
  [is_active] YESNO NOT NULL,
  [accrual_frequency] LONGTEXT NOT NULL,
  [accrual_days_per_cycle] DOUBLE NOT NULL,
  [accrual_basis] LONGTEXT NOT NULL,
  [max_accrual_per_year] DOUBLE NOT NULL,
  [accrual_start_month] INTEGER NOT NULL,
  [accrual_waiting_period_days] INTEGER NOT NULL,
  [accrue_on_probation] YESNO NOT NULL,
  [carry_forward_policy] LONGTEXT NOT NULL,
  [max_days_carry_forward] DOUBLE NOT NULL,
  [percentage_carry_forward] DOUBLE NOT NULL,
  [carry_forward_expiry_months] INTEGER NOT NULL,
  [carry_forward_to_next_year] YESNO NOT NULL,
  [encashment_policy] LONGTEXT NOT NULL,
  [max_encashment_days_per_year] DOUBLE NOT NULL,
  [min_balance_after_encashment] DOUBLE NOT NULL,
  [encashment_multiplier] DOUBLE NOT NULL,
  [encashment_taxable] YESNO NOT NULL,
  [applicable_categories] LONGTEXT NOT NULL,
  [gender_applicability] LONGTEXT NOT NULL,
  [min_service_months] INTEGER NOT NULL,
  [applicable_to_contractors] YESNO NOT NULL,
  [applicable_to_part_time] YESNO NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_leave_types] PRIMARY KEY ([id])
);

CREATE TABLE [letterheads] (
  [id] TEXT(38) NOT NULL,
  [location_id] TEXT(38) NOT NULL,
  [is_active] YESNO NOT NULL,
  [paper_size] LONGTEXT NOT NULL,
  [margin_top] INTEGER NOT NULL,
  [margin_bottom] INTEGER NOT NULL,
  [margin_left] INTEGER NOT NULL,
  [margin_right] INTEGER NOT NULL,
  [header_enabled] YESNO NOT NULL,
  [header_logo_url] LONGTEXT,
  [header_logo_position] LONGTEXT NOT NULL,
  [header_logo_size] LONGTEXT NOT NULL,
  [header_image_url] LONGTEXT,
  [header_image_height] LONGTEXT NOT NULL,
  [header_company_name] LONGTEXT,
  [header_company_name_size] LONGTEXT NOT NULL,
  [header_company_name_align] LONGTEXT NOT NULL,
  [header_company_name_color] LONGTEXT NOT NULL,
  [header_tagline] LONGTEXT,
  [header_tagline_alignment] LONGTEXT NOT NULL,
  [header_tagline_color] LONGTEXT NOT NULL,
  [header_address_line] LONGTEXT,
  [header_address_alignment] LONGTEXT NOT NULL,
  [header_contact_line] LONGTEXT,
  [header_contact_alignment] LONGTEXT NOT NULL,
  [header_website_line] LONGTEXT,
  [header_website_alignment] LONGTEXT NOT NULL,
  [header_divider_enabled] YESNO NOT NULL,
  [header_divider_color] LONGTEXT NOT NULL,
  [header_divider_thickness] LONGTEXT NOT NULL,
  [header_bg_color] LONGTEXT NOT NULL,
  [header_custom_html] LONGTEXT,
  [header_use_custom_html] YESNO NOT NULL,
  [footer_enabled] YESNO NOT NULL,
  [footer_image_url] LONGTEXT,
  [footer_image_height] LONGTEXT NOT NULL,
  [footer_line1] LONGTEXT,
  [footer_line1_alignment] LONGTEXT NOT NULL,
  [footer_line1_color] LONGTEXT NOT NULL,
  [footer_line2] LONGTEXT,
  [footer_line2_alignment] LONGTEXT NOT NULL,
  [footer_line2_color] LONGTEXT NOT NULL,
  [footer_show_page_number] YESNO NOT NULL,
  [footer_page_number_align] LONGTEXT NOT NULL,
  [footer_divider_enabled] YESNO NOT NULL,
  [footer_divider_color] LONGTEXT NOT NULL,
  [footer_divider_thickness] LONGTEXT NOT NULL,
  [footer_bg_color] LONGTEXT NOT NULL,
  [footer_custom_html] LONGTEXT,
  [footer_use_custom_html] YESNO NOT NULL,
  [use_for_payslip] YESNO NOT NULL,
  [use_for_offer_letter] YESNO NOT NULL,
  [use_for_memo] YESNO NOT NULL,
  [use_for_transfer_letter] YESNO NOT NULL,
  [use_for_experience_letter] YESNO NOT NULL,
  [use_for_relieving_letter] YESNO NOT NULL,
  [use_for_appointment_letter] YESNO NOT NULL,
  [use_for_warning_letter] YESNO NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_letterheads] PRIMARY KEY ([id])
);

CREATE TABLE [loan_emi_schedule] (
  [id] TEXT(38) NOT NULL,
  [loan_id] TEXT(38) NOT NULL,
  [month_number] INTEGER NOT NULL,
  [due_date] DATETIME NOT NULL,
  [emi_amount] DOUBLE NOT NULL,
  [principal_component] DOUBLE NOT NULL,
  [interest_component] DOUBLE NOT NULL,
  [is_paid] YESNO NOT NULL,
  [paid_date] DATETIME,
  [paid_amount] DOUBLE NOT NULL,
  [created_at] DATETIME NOT NULL,
  CONSTRAINT [pk_loan_emi_schedule] PRIMARY KEY ([id])
);

CREATE TABLE [loan_emi_skip_requests] (
  [id] TEXT(38) NOT NULL,
  [loan_id] TEXT(38) NOT NULL,
  [employee_id] TEXT(38),
  [payroll_period_id] TEXT(38),
  [emi_month_number] INTEGER,
  [reason] LONGTEXT NOT NULL,
  [status] LONGTEXT NOT NULL,
  [manager_status] LONGTEXT NOT NULL,
  [manager_id] TEXT(38),
  [manager_acted_on] DATETIME,
  [manager_remarks] LONGTEXT,
  [hr_status] LONGTEXT NOT NULL,
  [hr_id] TEXT(38),
  [hr_acted_on] DATETIME,
  [hr_remarks] LONGTEXT,
  [requested_on] DATETIME NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_loan_emi_skip_requests] PRIMARY KEY ([id])
);

CREATE TABLE [loan_types] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [max_amount] DOUBLE NOT NULL,
  [max_tenure_months] INTEGER NOT NULL,
  [interest_rate] DOUBLE NOT NULL,
  [is_interest_free] YESNO NOT NULL,
  [eligibility_months] INTEGER NOT NULL,
  [max_amount_multiplier] DOUBLE NOT NULL,
  [deduction_head] LONGTEXT NOT NULL,
  [is_active] YESNO NOT NULL,
  [description] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_loan_types] PRIMARY KEY ([id])
);

CREATE TABLE [loans] (
  [id] TEXT(38) NOT NULL,
  [employee_id] TEXT(38) NOT NULL,
  [loan_type_id] TEXT(38) NOT NULL,
  [principal_amount] DOUBLE NOT NULL,
  [interest_rate] DOUBLE NOT NULL,
  [tenure_months] INTEGER NOT NULL,
  [emi_amount] DOUBLE NOT NULL,
  [disbursed_date] DATETIME,
  [applied_date] DATETIME NOT NULL,
  [status] LONGTEXT NOT NULL,
  [purpose] LONGTEXT,
  [paid_emis] INTEGER NOT NULL,
  [outstanding_balance] DOUBLE NOT NULL,
  [approved_by] TEXT(38),
  [approved_on] DATETIME,
  [remarks] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_loans] PRIMARY KEY ([id])
);

CREATE TABLE [location_bank_accounts] (
  [id] TEXT(38) NOT NULL,
  [location_id] TEXT(38) NOT NULL,
  [bank_name] LONGTEXT NOT NULL,
  [account_name] LONGTEXT NOT NULL,
  [account_number] LONGTEXT NOT NULL,
  [ifsc_code] LONGTEXT NOT NULL,
  [branch_name] LONGTEXT,
  [branch_address] LONGTEXT,
  [account_type] LONGTEXT NOT NULL,
  [is_primary] YESNO NOT NULL,
  [swift_code] LONGTEXT,
  [micr_code] LONGTEXT,
  [status] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_location_bank_accounts] PRIMARY KEY ([id])
);

CREATE TABLE [location_documents] (
  [id] TEXT(38) NOT NULL,
  [location_id] TEXT(38) NOT NULL,
  [document_category] LONGTEXT NOT NULL,
  [document_name] LONGTEXT NOT NULL,
  [file_url] LONGTEXT NOT NULL,
  [file_size] INTEGER,
  [file_type] LONGTEXT,
  [description] LONGTEXT,
  [uploaded_at] DATETIME NOT NULL,
  CONSTRAINT [pk_location_documents] PRIMARY KEY ([id])
);

CREATE TABLE [lookup_values] (
  [id] TEXT(38) NOT NULL,
  [category] LONGTEXT NOT NULL,
  [code] LONGTEXT,
  [label] LONGTEXT NOT NULL,
  [sort_order] INTEGER NOT NULL,
  [metadata] LONGTEXT,
  [is_active] YESNO NOT NULL,
  [created_at] DATETIME NOT NULL,
  CONSTRAINT [pk_lookup_values] PRIMARY KEY ([id])
);

CREATE TABLE [pay_heads] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [type] LONGTEXT NOT NULL,
  [ledger_group] LONGTEXT NOT NULL,
  [is_active] YESNO NOT NULL,
  [description] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_pay_heads] PRIMARY KEY ([id])
);

CREATE TABLE [payroll_entries] (
  [id] TEXT(38) NOT NULL,
  [payroll_run_id] TEXT(38) NOT NULL,
  [employee_id] TEXT(38) NOT NULL,
  [payroll_period_id] TEXT(38) NOT NULL,
  [basic_salary] DOUBLE NOT NULL,
  [hra] DOUBLE NOT NULL,
  [special_allowance] DOUBLE NOT NULL,
  [conveyance_allowance] DOUBLE NOT NULL,
  [medical_allowance] DOUBLE NOT NULL,
  [lta] DOUBLE NOT NULL,
  [other_earnings] DOUBLE NOT NULL,
  [gross_salary] DOUBLE NOT NULL,
  [pf_employee] DOUBLE NOT NULL,
  [esi_employee] DOUBLE NOT NULL,
  [professional_tax] DOUBLE NOT NULL,
  [tds] DOUBLE NOT NULL,
  [loan_emi] DOUBLE NOT NULL,
  [advance_recovery] DOUBLE NOT NULL,
  [other_deductions] DOUBLE NOT NULL,
  [total_deductions] DOUBLE NOT NULL,
  [net_salary] DOUBLE NOT NULL,
  [pf_employer] DOUBLE NOT NULL,
  [esi_employer] DOUBLE NOT NULL,
  [working_days] INTEGER NOT NULL,
  [present_days] DOUBLE NOT NULL,
  [absent_days] DOUBLE NOT NULL,
  [leave_days] DOUBLE NOT NULL,
  [overtime_hours] DOUBLE NOT NULL,
  [status] LONGTEXT NOT NULL,
  [remarks] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_payroll_entries] PRIMARY KEY ([id])
);

CREATE TABLE [payroll_periods] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [financial_year] LONGTEXT NOT NULL,
  [frequency] LONGTEXT NOT NULL,
  [from_date] DATETIME NOT NULL,
  [to_date] DATETIME NOT NULL,
  [payment_date] DATETIME NOT NULL,
  [status] LONGTEXT NOT NULL,
  [description] LONGTEXT,
  [is_default] YESNO NOT NULL,
  [closed_at] DATETIME,
  [closed_by] TEXT(38),
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_payroll_periods] PRIMARY KEY ([id])
);

CREATE TABLE [payroll_runs] (
  [id] TEXT(38) NOT NULL,
  [payroll_period_id] TEXT(38) NOT NULL,
  [run_date] DATETIME NOT NULL,
  [status] LONGTEXT NOT NULL,
  [total_employees] INTEGER NOT NULL,
  [total_gross] DOUBLE NOT NULL,
  [total_deductions] DOUBLE NOT NULL,
  [total_net] DOUBLE NOT NULL,
  [total_employer_pf] DOUBLE NOT NULL,
  [total_employer_esi] DOUBLE NOT NULL,
  [remarks] LONGTEXT,
  [processed_by] TEXT(38),
  [approved_by] TEXT(38),
  [approved_at] DATETIME,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_payroll_runs] PRIMARY KEY ([id])
);

CREATE TABLE [pf_esi_config] (
  [id] TEXT(38) NOT NULL,
  [pf_enabled] YESNO NOT NULL,
  [pf_employee_rate] DOUBLE NOT NULL,
  [pf_employer_rate] DOUBLE NOT NULL,
  [pf_admin_charges] DOUBLE NOT NULL,
  [pf_edli_charges] DOUBLE NOT NULL,
  [pf_wage_ceiling] DOUBLE NOT NULL,
  [pf_apply_on] LONGTEXT NOT NULL,
  [vpf_enabled] YESNO NOT NULL,
  [vpf_max_percentage] DOUBLE NOT NULL,
  [esi_enabled] YESNO NOT NULL,
  [esi_employee_rate] DOUBLE NOT NULL,
  [esi_employer_rate] DOUBLE NOT NULL,
  [esi_wage_ceiling] DOUBLE NOT NULL,
  [nps_enabled] YESNO NOT NULL,
  [nps_employee_rate] DOUBLE NOT NULL,
  [nps_employer_rate] DOUBLE NOT NULL,
  [gratuity_enabled] YESNO NOT NULL,
  [gratuity_formula] LONGTEXT NOT NULL,
  [gratuity_min_years] INTEGER NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_pf_esi_config] PRIMARY KEY ([id])
);

CREATE TABLE [poll_options] (
  [id] TEXT(38) NOT NULL,
  [poll_id] TEXT(38) NOT NULL,
  [text] LONGTEXT NOT NULL,
  [sort_order] INTEGER NOT NULL,
  [created_at] DATETIME NOT NULL,
  CONSTRAINT [pk_poll_options] PRIMARY KEY ([id])
);

CREATE TABLE [poll_votes] (
  [id] TEXT(38) NOT NULL,
  [poll_id] TEXT(38) NOT NULL,
  [option_id] TEXT(38),
  [employee_id] TEXT(38),
  [rating] INTEGER,
  [text_response] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  CONSTRAINT [pk_poll_votes] PRIMARY KEY ([id])
);

CREATE TABLE [polls] (
  [id] TEXT(38) NOT NULL,
  [title] LONGTEXT NOT NULL,
  [description] LONGTEXT,
  [type] LONGTEXT NOT NULL,
  [status] LONGTEXT NOT NULL,
  [is_anonymous] YESNO NOT NULL,
  [start_date] DATETIME,
  [end_date] DATETIME,
  [end_time] LONGTEXT,
  [total_recipients] INTEGER NOT NULL,
  [created_by] TEXT(38),
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_polls] PRIMARY KEY ([id])
);

CREATE TABLE [salary_components] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [type] LONGTEXT NOT NULL,
  [calculation_basis] LONGTEXT NOT NULL,
  [value] DOUBLE NOT NULL,
  [formula] LONGTEXT,
  [taxability] LONGTEXT NOT NULL,
  [pf_applicability] LONGTEXT NOT NULL,
  [esi_applicability] LONGTEXT NOT NULL,
  [is_active] YESNO NOT NULL,
  [is_system_defined] YESNO NOT NULL,
  [description] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_salary_components] PRIMARY KEY ([id])
);

CREATE TABLE [salary_structure_components] (
  [id] TEXT(38) NOT NULL,
  [salary_structure_id] TEXT(38) NOT NULL,
  [salary_component_id] TEXT(38) NOT NULL,
  [value] DOUBLE NOT NULL,
  [calculation_basis] LONGTEXT,
  [sort_order] INTEGER NOT NULL,
  [created_at] DATETIME NOT NULL,
  [value_type] LONGTEXT NOT NULL,
  [custom_values] LONGTEXT NOT NULL,
  [selected_custom_value] DOUBLE NOT NULL,
  [formula] LONGTEXT,
  CONSTRAINT [pk_salary_structure_components] PRIMARY KEY ([id])
);

CREATE TABLE [salary_structures] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [applicable_to] LONGTEXT NOT NULL,
  [is_active] YESNO NOT NULL,
  [description] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_salary_structures] PRIMARY KEY ([id])
);

CREATE TABLE [shifts] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [category] LONGTEXT NOT NULL,
  [start_time] DATETIME NOT NULL,
  [end_time] DATETIME NOT NULL,
  [break_duration_minutes] INTEGER NOT NULL,
  [break_start_time] DATETIME,
  [break_end_time] DATETIME,
  [applicable_days] LONGTEXT NOT NULL,
  [grace_period_minutes] INTEGER NOT NULL,
  [half_day_hours] DOUBLE NOT NULL,
  [minimum_hours_full_day] DOUBLE NOT NULL,
  [overtime_policy] LONGTEXT NOT NULL,
  [overtime_daily_limit_hours] DOUBLE NOT NULL,
  [overtime_weekly_limit_hours] DOUBLE NOT NULL,
  [overtime_multiplier] DOUBLE NOT NULL,
  [overtime_max_hours_per_day] DOUBLE NOT NULL,
  [overtime_requires_approval] YESNO NOT NULL,
  [description] LONGTEXT,
  [color] LONGTEXT NOT NULL,
  [status] LONGTEXT NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  [breaks] LONGTEXT NOT NULL,
  CONSTRAINT [pk_shifts] PRIMARY KEY ([id])
);

CREATE TABLE [system_users] (
  [id] TEXT(38) NOT NULL,
  [auth_user_id] TEXT(38),
  [employee_id] TEXT(38),
  [name] LONGTEXT NOT NULL,
  [email] LONGTEXT NOT NULL,
  [phone] LONGTEXT,
  [department] LONGTEXT,
  [role] LONGTEXT NOT NULL,
  [status] LONGTEXT NOT NULL,
  [avatar] LONGTEXT,
  [last_login] DATETIME,
  [two_factor_enabled] YESNO NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_system_users] PRIMARY KEY ([id])
);

CREATE TABLE [tds_slabs] (
  [id] TEXT(38) NOT NULL,
  [financial_year] LONGTEXT NOT NULL,
  [regime] LONGTEXT NOT NULL,
  [gender] LONGTEXT NOT NULL,
  [from_amount] DOUBLE NOT NULL,
  [to_amount] DOUBLE NOT NULL,
  [tax_rate] DOUBLE NOT NULL,
  [surcharge_rate] DOUBLE NOT NULL,
  [cess_rate] DOUBLE NOT NULL,
  [description] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  CONSTRAINT [pk_tds_slabs] PRIMARY KEY ([id])
);

CREATE TABLE [user_dashboard_preferences] (
  [user_id] TEXT(38) NOT NULL,
  [hidden_widgets] LONGTEXT NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_user_dashboard_preferences] PRIMARY KEY ([user_id])
);

CREATE TABLE [user_privileges] (
  [id] TEXT(38) NOT NULL,
  [system_user_id] TEXT(38) NOT NULL,
  [module] LONGTEXT NOT NULL,
  [can_view] YESNO NOT NULL,
  [can_create] YESNO NOT NULL,
  [can_edit] YESNO NOT NULL,
  [can_delete] YESNO NOT NULL,
  [can_export] YESNO NOT NULL,
  [can_approve] YESNO NOT NULL,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_user_privileges] PRIMARY KEY ([id])
);

CREATE TABLE [work_locations] (
  [id] TEXT(38) NOT NULL,
  [name] LONGTEXT NOT NULL,
  [code] LONGTEXT NOT NULL,
  [address] LONGTEXT,
  [city] LONGTEXT,
  [state] LONGTEXT,
  [country] LONGTEXT NOT NULL,
  [phone] LONGTEXT,
  [email] LONGTEXT,
  [status] LONGTEXT NOT NULL,
  [employee_count] INTEGER NOT NULL,
  [lin_no] LONGTEXT,
  [epf_code_no] LONGTEXT,
  [esi_code_no] LONGTEXT,
  [pan_no] LONGTEXT,
  [gst_code] LONGTEXT,
  [tan_no] LONGTEXT,
  [cin_no] LONGTEXT,
  [pt_no] LONGTEXT,
  [is_factory] YESNO NOT NULL,
  [factory_registration_date] DATETIME,
  [factory_validity_from] DATETIME,
  [factory_validity_to] DATETIME,
  [factory_commencement_date] DATETIME,
  [factory_max_workers_per_day] INTEGER,
  [factory_license_limit] INTEGER,
  [factory_gps_latitude] LONGTEXT,
  [factory_gps_longitude] LONGTEXT,
  [factory_nic_code] LONGTEXT,
  [factory_full_postal_address] LONGTEXT,
  [factory_occupier_name] LONGTEXT,
  [factory_occupier_designation] LONGTEXT,
  [factory_occupier_phone] LONGTEXT,
  [factory_occupier_email] LONGTEXT,
  [factory_occupier_address_line1] LONGTEXT,
  [factory_occupier_address_line2] LONGTEXT,
  [factory_occupier_city] LONGTEXT,
  [factory_occupier_district] LONGTEXT,
  [factory_occupier_state] LONGTEXT,
  [factory_occupier_pincode] LONGTEXT,
  [factory_manager_name] LONGTEXT,
  [factory_manager_designation] LONGTEXT,
  [factory_manager_phone] LONGTEXT,
  [factory_manager_email] LONGTEXT,
  [factory_manager_address_line1] LONGTEXT,
  [factory_manager_address_line2] LONGTEXT,
  [factory_manager_city] LONGTEXT,
  [factory_manager_district] LONGTEXT,
  [factory_manager_state] LONGTEXT,
  [factory_manager_pincode] LONGTEXT,
  [created_at] DATETIME NOT NULL,
  [updated_at] DATETIME NOT NULL,
  CONSTRAINT [pk_work_locations] PRIMARY KEY ([id])
);

-- ===== FOREIGN KEYS (run after all tables are created) =====

ALTER TABLE [attendance_records] ADD CONSTRAINT [fk_attendance_records_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]) ON DELETE CASCADE;
ALTER TABLE [attendance_records] ADD CONSTRAINT [fk_attendance_records_shift_id] FOREIGN KEY ([shift_id]) REFERENCES [shifts] ([id]);
ALTER TABLE [departments] ADD CONSTRAINT [fk_departments_location_id] FOREIGN KEY ([location_id]) REFERENCES [work_locations] ([id]) ON DELETE CASCADE;
ALTER TABLE [departments] ADD CONSTRAINT [fk_departments_parent_id] FOREIGN KEY ([parent_id]) REFERENCES [departments] ([id]);
ALTER TABLE [employee_bank_accounts] ADD CONSTRAINT [fk_employee_bank_accounts_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]) ON DELETE CASCADE;
ALTER TABLE [employee_documents] ADD CONSTRAINT [fk_employee_documents_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]) ON DELETE CASCADE;
ALTER TABLE [employee_education] ADD CONSTRAINT [fk_employee_education_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]) ON DELETE CASCADE;
ALTER TABLE [employee_family] ADD CONSTRAINT [fk_employee_family_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]) ON DELETE CASCADE;
ALTER TABLE [employee_languages] ADD CONSTRAINT [fk_employee_languages_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]) ON DELETE CASCADE;
ALTER TABLE [employee_salary_assignments] ADD CONSTRAINT [fk_employee_salary_assignments_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]) ON DELETE CASCADE;
ALTER TABLE [employee_salary_assignments] ADD CONSTRAINT [fk_employee_salary_assignments_salary_structure_id] FOREIGN KEY ([salary_structure_id]) REFERENCES [salary_structures] ([id]);
ALTER TABLE [employee_statutory] ADD CONSTRAINT [fk_employee_statutory_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]) ON DELETE CASCADE;
ALTER TABLE [employee_work_experience] ADD CONSTRAINT [fk_employee_work_experience_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]) ON DELETE CASCADE;
ALTER TABLE [employees] ADD CONSTRAINT [fk_employees_department_id] FOREIGN KEY ([department_id]) REFERENCES [departments] ([id]);
ALTER TABLE [employees] ADD CONSTRAINT [fk_employees_designation_id] FOREIGN KEY ([designation_id]) REFERENCES [designations] ([id]);
ALTER TABLE [employees] ADD CONSTRAINT [fk_employees_employee_category_id] FOREIGN KEY ([employee_category_id]) REFERENCES [employee_categories] ([id]);
ALTER TABLE [employees] ADD CONSTRAINT [fk_employees_employee_group_id] FOREIGN KEY ([employee_group_id]) REFERENCES [employee_groups] ([id]);
ALTER TABLE [employees] ADD CONSTRAINT [fk_employees_employee_type_id] FOREIGN KEY ([employee_type_id]) REFERENCES [employee_types] ([id]);
ALTER TABLE [employees] ADD CONSTRAINT [fk_employees_grade_id] FOREIGN KEY ([grade_id]) REFERENCES [employee_grades] ([id]);
ALTER TABLE [employees] ADD CONSTRAINT [fk_employees_reporting_manager_id] FOREIGN KEY ([reporting_manager_id]) REFERENCES [employees] ([id]);
ALTER TABLE [employees] ADD CONSTRAINT [fk_employees_shift_id] FOREIGN KEY ([shift_id]) REFERENCES [shifts] ([id]);
ALTER TABLE [employees] ADD CONSTRAINT [fk_employees_work_location_id] FOREIGN KEY ([work_location_id]) REFERENCES [work_locations] ([id]);
ALTER TABLE [holidays] ADD CONSTRAINT [fk_holidays_holiday_list_id] FOREIGN KEY ([holiday_list_id]) REFERENCES [holiday_lists] ([id]) ON DELETE CASCADE;
ALTER TABLE [leave_balances] ADD CONSTRAINT [fk_leave_balances_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]) ON DELETE CASCADE;
ALTER TABLE [leave_balances] ADD CONSTRAINT [fk_leave_balances_leave_type_id] FOREIGN KEY ([leave_type_id]) REFERENCES [leave_types] ([id]) ON DELETE CASCADE;
ALTER TABLE [leave_requests] ADD CONSTRAINT [fk_leave_requests_approved_by] FOREIGN KEY ([approved_by]) REFERENCES [employees] ([id]);
ALTER TABLE [leave_requests] ADD CONSTRAINT [fk_leave_requests_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]) ON DELETE CASCADE;
ALTER TABLE [leave_requests] ADD CONSTRAINT [fk_leave_requests_leave_type_id] FOREIGN KEY ([leave_type_id]) REFERENCES [leave_types] ([id]);
ALTER TABLE [letterheads] ADD CONSTRAINT [fk_letterheads_location_id] FOREIGN KEY ([location_id]) REFERENCES [work_locations] ([id]) ON DELETE CASCADE;
ALTER TABLE [loan_emi_schedule] ADD CONSTRAINT [fk_loan_emi_schedule_loan_id] FOREIGN KEY ([loan_id]) REFERENCES [loans] ([id]) ON DELETE CASCADE;
ALTER TABLE [loan_emi_skip_requests] ADD CONSTRAINT [fk_loan_emi_skip_requests_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]);
ALTER TABLE [loan_emi_skip_requests] ADD CONSTRAINT [fk_loan_emi_skip_requests_hr_id] FOREIGN KEY ([hr_id]) REFERENCES [employees] ([id]);
ALTER TABLE [loan_emi_skip_requests] ADD CONSTRAINT [fk_loan_emi_skip_requests_loan_id] FOREIGN KEY ([loan_id]) REFERENCES [loans] ([id]) ON DELETE CASCADE;
ALTER TABLE [loan_emi_skip_requests] ADD CONSTRAINT [fk_loan_emi_skip_requests_manager_id] FOREIGN KEY ([manager_id]) REFERENCES [employees] ([id]);
ALTER TABLE [loan_emi_skip_requests] ADD CONSTRAINT [fk_loan_emi_skip_requests_payroll_period_id] FOREIGN KEY ([payroll_period_id]) REFERENCES [payroll_periods] ([id]);
ALTER TABLE [loans] ADD CONSTRAINT [fk_loans_approved_by] FOREIGN KEY ([approved_by]) REFERENCES [employees] ([id]);
ALTER TABLE [loans] ADD CONSTRAINT [fk_loans_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]) ON DELETE CASCADE;
ALTER TABLE [loans] ADD CONSTRAINT [fk_loans_loan_type_id] FOREIGN KEY ([loan_type_id]) REFERENCES [loan_types] ([id]);
ALTER TABLE [location_bank_accounts] ADD CONSTRAINT [fk_location_bank_accounts_location_id] FOREIGN KEY ([location_id]) REFERENCES [work_locations] ([id]) ON DELETE CASCADE;
ALTER TABLE [location_documents] ADD CONSTRAINT [fk_location_documents_location_id] FOREIGN KEY ([location_id]) REFERENCES [work_locations] ([id]) ON DELETE CASCADE;
ALTER TABLE [payroll_entries] ADD CONSTRAINT [fk_payroll_entries_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]) ON DELETE CASCADE;
ALTER TABLE [payroll_entries] ADD CONSTRAINT [fk_payroll_entries_payroll_period_id] FOREIGN KEY ([payroll_period_id]) REFERENCES [payroll_periods] ([id]);
ALTER TABLE [payroll_entries] ADD CONSTRAINT [fk_payroll_entries_payroll_run_id] FOREIGN KEY ([payroll_run_id]) REFERENCES [payroll_runs] ([id]) ON DELETE CASCADE;
ALTER TABLE [payroll_periods] ADD CONSTRAINT [fk_payroll_periods_closed_by] FOREIGN KEY ([closed_by]) REFERENCES [system_users] ([id]);
ALTER TABLE [payroll_runs] ADD CONSTRAINT [fk_payroll_runs_approved_by] FOREIGN KEY ([approved_by]) REFERENCES [system_users] ([id]);
ALTER TABLE [payroll_runs] ADD CONSTRAINT [fk_payroll_runs_payroll_period_id] FOREIGN KEY ([payroll_period_id]) REFERENCES [payroll_periods] ([id]);
ALTER TABLE [payroll_runs] ADD CONSTRAINT [fk_payroll_runs_processed_by] FOREIGN KEY ([processed_by]) REFERENCES [system_users] ([id]);
ALTER TABLE [poll_options] ADD CONSTRAINT [fk_poll_options_poll_id] FOREIGN KEY ([poll_id]) REFERENCES [polls] ([id]) ON DELETE CASCADE;
ALTER TABLE [poll_votes] ADD CONSTRAINT [fk_poll_votes_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]);
ALTER TABLE [poll_votes] ADD CONSTRAINT [fk_poll_votes_option_id] FOREIGN KEY ([option_id]) REFERENCES [poll_options] ([id]) ON DELETE CASCADE;
ALTER TABLE [poll_votes] ADD CONSTRAINT [fk_poll_votes_poll_id] FOREIGN KEY ([poll_id]) REFERENCES [polls] ([id]) ON DELETE CASCADE;
ALTER TABLE [salary_structure_components] ADD CONSTRAINT [fk_salary_structure_components_salary_component_id] FOREIGN KEY ([salary_component_id]) REFERENCES [salary_components] ([id]) ON DELETE CASCADE;
ALTER TABLE [salary_structure_components] ADD CONSTRAINT [fk_salary_structure_components_salary_structure_id] FOREIGN KEY ([salary_structure_id]) REFERENCES [salary_structures] ([id]) ON DELETE CASCADE;
ALTER TABLE [system_users] ADD CONSTRAINT [fk_system_users_employee_id] FOREIGN KEY ([employee_id]) REFERENCES [employees] ([id]);
ALTER TABLE [user_privileges] ADD CONSTRAINT [fk_user_privileges_system_user_id] FOREIGN KEY ([system_user_id]) REFERENCES [system_users] ([id]) ON DELETE CASCADE;
