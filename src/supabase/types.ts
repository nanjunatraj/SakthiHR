export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          attendance_date: string
          check_in: string | null
          check_out: string | null
          created_at: string
          employee_id: string
          hours_worked: number
          id: string
          overtime_hours: number
          remarks: string | null
          shift_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          employee_id: string
          hours_worked?: number
          id?: string
          overtime_hours?: number
          remarks?: string | null
          shift_id?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          employee_id?: string
          hours_worked?: number
          id?: string
          overtime_hours?: number
          remarks?: string | null
          shift_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          employee_count: number
          head_name: string | null
          id: string
          location_id: string
          name: string
          parent_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          employee_count?: number
          head_name?: string | null
          id?: string
          location_id: string
          name: string
          parent_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          employee_count?: number
          head_name?: string | null
          id?: string
          location_id?: string
          name?: string
          parent_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      designations: {
        Row: {
          code: string
          created_at: string
          department: string | null
          description: string | null
          id: string
          level: number
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          level?: number
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          level?: number
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          account_type: string
          bank_name: string
          branch_address: string | null
          branch_name: string | null
          created_at: string
          employee_id: string
          id: string
          ifsc_code: string
          is_primary: boolean
          micr_code: string | null
          swift_code: string | null
        }
        Insert: {
          account_name: string
          account_number: string
          account_type?: string
          bank_name: string
          branch_address?: string | null
          branch_name?: string | null
          created_at?: string
          employee_id: string
          id?: string
          ifsc_code: string
          is_primary?: boolean
          micr_code?: string | null
          swift_code?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string
          account_type?: string
          bank_name?: string
          branch_address?: string | null
          branch_name?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          ifsc_code?: string
          is_primary?: boolean
          micr_code?: string | null
          swift_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_bank_accounts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_bank_accounts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          description: string | null
          document_category: string
          document_name: string
          employee_id: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_at: string
        }
        Insert: {
          description?: string | null
          document_category: string
          document_name: string
          employee_id: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_at?: string
        }
        Update: {
          description?: string | null
          document_category?: string
          document_name?: string
          employee_id?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_education: {
        Row: {
          created_at: string
          employee_id: string
          grade: string | null
          id: string
          institution: string | null
          percentage: string | null
          qualification: string
          specialization: string | null
          university: string | null
          year_of_passing: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          grade?: string | null
          id?: string
          institution?: string | null
          percentage?: string | null
          qualification: string
          specialization?: string | null
          university?: string | null
          year_of_passing?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          grade?: string | null
          id?: string
          institution?: string | null
          percentage?: string | null
          qualification?: string
          specialization?: string | null
          university?: string | null
          year_of_passing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_education_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_education_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_family: {
        Row: {
          created_at: string
          date_of_birth: string | null
          employee_id: string
          gender: string | null
          id: string
          is_dependent: boolean
          is_nominee: boolean
          name: string
          nomination_percentage: number
          nomination_purpose: string[]
          occupation: string | null
          phone: string | null
          relationship: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          employee_id: string
          gender?: string | null
          id?: string
          is_dependent?: boolean
          is_nominee?: boolean
          name: string
          nomination_percentage?: number
          nomination_purpose?: string[]
          occupation?: string | null
          phone?: string | null
          relationship: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          employee_id?: string
          gender?: string | null
          id?: string
          is_dependent?: boolean
          is_nominee?: boolean
          name?: string
          nomination_percentage?: number
          nomination_purpose?: string[]
          occupation?: string | null
          phone?: string | null
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_family_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_family_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_grades: {
        Row: {
          code: string
          created_at: string
          description: string | null
          grade_level: number
          id: string
          max_salary: number
          min_salary: number
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          grade_level?: number
          id?: string
          max_salary?: number
          min_salary?: number
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          grade_level?: number
          id?: string
          max_salary?: number
          min_salary?: number
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_groups: {
        Row: {
          code: string
          created_at: string
          description: string | null
          group_type: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          group_type?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          group_type?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_languages: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          language: string
          read_level: string
          speak_level: string
          write_level: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          language: string
          read_level?: string
          speak_level?: string
          write_level?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          language?: string
          read_level?: string
          speak_level?: string
          write_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_languages_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_languages_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_assignments: {
        Row: {
          created_at: string
          ctc_annual: number
          ctc_monthly: number
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          is_current: boolean
          salary_structure_id: string
        }
        Insert: {
          created_at?: string
          ctc_annual?: number
          ctc_monthly?: number
          effective_from: string
          effective_to?: string | null
          employee_id: string
          id?: string
          is_current?: boolean
          salary_structure_id: string
        }
        Update: {
          created_at?: string
          ctc_annual?: number
          ctc_monthly?: number
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          is_current?: boolean
          salary_structure_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_salary_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_assignments_salary_structure_id_fkey"
            columns: ["salary_structure_id"]
            isOneToOne: false
            referencedRelation: "salary_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_sections: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          parent_section: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_section?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_section?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_statutory: {
        Row: {
          aadhar_no: string | null
          created_at: string
          driving_license_expiry: string | null
          driving_license_no: string | null
          employee_id: string
          esi_no: string | null
          id: string
          pan_no: string | null
          passport_expiry: string | null
          passport_no: string | null
          pf_account_no: string | null
          ration_card_no: string | null
          uan_no: string | null
          updated_at: string
          voter_id_no: string | null
        }
        Insert: {
          aadhar_no?: string | null
          created_at?: string
          driving_license_expiry?: string | null
          driving_license_no?: string | null
          employee_id: string
          esi_no?: string | null
          id?: string
          pan_no?: string | null
          passport_expiry?: string | null
          passport_no?: string | null
          pf_account_no?: string | null
          ration_card_no?: string | null
          uan_no?: string | null
          updated_at?: string
          voter_id_no?: string | null
        }
        Update: {
          aadhar_no?: string | null
          created_at?: string
          driving_license_expiry?: string | null
          driving_license_no?: string | null
          employee_id?: string
          esi_no?: string | null
          id?: string
          pan_no?: string | null
          passport_expiry?: string | null
          passport_no?: string | null
          pf_account_no?: string | null
          ration_card_no?: string | null
          uan_no?: string | null
          updated_at?: string
          voter_id_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_statutory_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_statutory_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_contractual: boolean
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_contractual?: boolean
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_contractual?: boolean
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_work_experience: {
        Row: {
          company_name: string
          created_at: string
          department: string | null
          designation: string | null
          employee_id: string
          from_date: string | null
          id: string
          last_salary: string | null
          months_of_experience: number
          reason_for_leaving: string | null
          reference_designation: string | null
          reference_email: string | null
          reference_name: string | null
          reference_phone: string | null
          to_date: string | null
          years_of_experience: number
        }
        Insert: {
          company_name: string
          created_at?: string
          department?: string | null
          designation?: string | null
          employee_id: string
          from_date?: string | null
          id?: string
          last_salary?: string | null
          months_of_experience?: number
          reason_for_leaving?: string | null
          reference_designation?: string | null
          reference_email?: string | null
          reference_name?: string | null
          reference_phone?: string | null
          to_date?: string | null
          years_of_experience?: number
        }
        Update: {
          company_name?: string
          created_at?: string
          department?: string | null
          designation?: string | null
          employee_id?: string
          from_date?: string | null
          id?: string
          last_salary?: string | null
          months_of_experience?: number
          reason_for_leaving?: string | null
          reference_designation?: string | null
          reference_email?: string | null
          reference_name?: string | null
          reference_phone?: string | null
          to_date?: string | null
          years_of_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_work_experience_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_work_experience_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          blood_group: string | null
          caste: string | null
          created_at: string
          current_employee_id: string | null
          date_of_birth: string | null
          date_of_confirmation: string | null
          date_of_joining: string | null
          department_id: string | null
          designation_id: string | null
          employee_category_id: string | null
          employee_group_id: string | null
          employee_id: string
          employee_type_id: string | null
          father_name: string | null
          first_name: string
          gender: string | null
          grade_id: string | null
          id: string
          identification_marks: string | null
          last_name: string
          marital_status: string | null
          middle_name: string | null
          mother_name: string | null
          mother_tongue: string | null
          nationality: string
          notice_period_days: number
          offer_letter_validity_days: number
          permanent_address_line1: string | null
          permanent_address_line2: string | null
          permanent_city: string | null
          permanent_country: string
          permanent_district: string | null
          permanent_pincode: string | null
          permanent_state: string | null
          photo_url: string | null
          place_of_birth: string | null
          present_address_line1: string | null
          present_address_line2: string | null
          present_city: string | null
          present_country: string
          present_district: string | null
          present_pincode: string | null
          present_state: string | null
          probation_period_months: number
          religion: string | null
          reporting_manager_id: string | null
          same_address: boolean
          section: string | null
          service_book_no: string | null
          shift_id: string | null
          signature_url: string | null
          status: string
          thumb_impression_url: string | null
          total_experience_months: number
          total_experience_years: number
          updated_at: string
          work_location_id: string | null
        }
        Insert: {
          blood_group?: string | null
          caste?: string | null
          created_at?: string
          current_employee_id?: string | null
          date_of_birth?: string | null
          date_of_confirmation?: string | null
          date_of_joining?: string | null
          department_id?: string | null
          designation_id?: string | null
          employee_category_id?: string | null
          employee_group_id?: string | null
          employee_id: string
          employee_type_id?: string | null
          father_name?: string | null
          first_name: string
          gender?: string | null
          grade_id?: string | null
          id?: string
          identification_marks?: string | null
          last_name: string
          marital_status?: string | null
          middle_name?: string | null
          mother_name?: string | null
          mother_tongue?: string | null
          nationality?: string
          notice_period_days?: number
          offer_letter_validity_days?: number
          permanent_address_line1?: string | null
          permanent_address_line2?: string | null
          permanent_city?: string | null
          permanent_country?: string
          permanent_district?: string | null
          permanent_pincode?: string | null
          permanent_state?: string | null
          photo_url?: string | null
          place_of_birth?: string | null
          present_address_line1?: string | null
          present_address_line2?: string | null
          present_city?: string | null
          present_country?: string
          present_district?: string | null
          present_pincode?: string | null
          present_state?: string | null
          probation_period_months?: number
          religion?: string | null
          reporting_manager_id?: string | null
          same_address?: boolean
          section?: string | null
          service_book_no?: string | null
          shift_id?: string | null
          signature_url?: string | null
          status?: string
          thumb_impression_url?: string | null
          total_experience_months?: number
          total_experience_years?: number
          updated_at?: string
          work_location_id?: string | null
        }
        Update: {
          blood_group?: string | null
          caste?: string | null
          created_at?: string
          current_employee_id?: string | null
          date_of_birth?: string | null
          date_of_confirmation?: string | null
          date_of_joining?: string | null
          department_id?: string | null
          designation_id?: string | null
          employee_category_id?: string | null
          employee_group_id?: string | null
          employee_id?: string
          employee_type_id?: string | null
          father_name?: string | null
          first_name?: string
          gender?: string | null
          grade_id?: string | null
          id?: string
          identification_marks?: string | null
          last_name?: string
          marital_status?: string | null
          middle_name?: string | null
          mother_name?: string | null
          mother_tongue?: string | null
          nationality?: string
          notice_period_days?: number
          offer_letter_validity_days?: number
          permanent_address_line1?: string | null
          permanent_address_line2?: string | null
          permanent_city?: string | null
          permanent_country?: string
          permanent_district?: string | null
          permanent_pincode?: string | null
          permanent_state?: string | null
          photo_url?: string | null
          place_of_birth?: string | null
          present_address_line1?: string | null
          present_address_line2?: string | null
          present_city?: string | null
          present_country?: string
          present_district?: string | null
          present_pincode?: string | null
          present_state?: string | null
          probation_period_months?: number
          religion?: string | null
          reporting_manager_id?: string | null
          same_address?: boolean
          section?: string | null
          service_book_no?: string | null
          shift_id?: string | null
          signature_url?: string | null
          status?: string
          thumb_impression_url?: string | null
          total_experience_months?: number
          total_experience_years?: number
          updated_at?: string
          work_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_employee_category_id_fkey"
            columns: ["employee_category_id"]
            isOneToOne: false
            referencedRelation: "employee_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_employee_group_id_fkey"
            columns: ["employee_group_id"]
            isOneToOne: false
            referencedRelation: "employee_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_employee_type_id_fkey"
            columns: ["employee_type_id"]
            isOneToOne: false
            referencedRelation: "employee_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "employee_grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_reporting_manager_id_fkey"
            columns: ["reporting_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_reporting_manager_id_fkey"
            columns: ["reporting_manager_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_work_location_id_fkey"
            columns: ["work_location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      establishment: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string
          created_at: string
          currency_code: string
          district: string | null
          email: string | null
          entity_type: string | null
          id: string
          incorporation_date: string | null
          industry_type: string | null
          logo_url: string | null
          manager_address_line1: string | null
          manager_address_line2: string | null
          manager_city: string | null
          manager_designation: string | null
          manager_district: string | null
          manager_email: string | null
          manager_name: string | null
          manager_phone: string | null
          manager_pincode: string | null
          manager_state: string | null
          name: string
          occupier_address_line1: string | null
          occupier_address_line2: string | null
          occupier_city: string | null
          occupier_designation: string | null
          occupier_district: string | null
          occupier_email: string | null
          occupier_name: string | null
          occupier_phone: string | null
          occupier_pincode: string | null
          occupier_state: string | null
          phone: string | null
          pincode: string | null
          short_name: string | null
          state: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string
          created_at?: string
          currency_code?: string
          district?: string | null
          email?: string | null
          entity_type?: string | null
          id?: string
          incorporation_date?: string | null
          industry_type?: string | null
          logo_url?: string | null
          manager_address_line1?: string | null
          manager_address_line2?: string | null
          manager_city?: string | null
          manager_designation?: string | null
          manager_district?: string | null
          manager_email?: string | null
          manager_name?: string | null
          manager_phone?: string | null
          manager_pincode?: string | null
          manager_state?: string | null
          name: string
          occupier_address_line1?: string | null
          occupier_address_line2?: string | null
          occupier_city?: string | null
          occupier_designation?: string | null
          occupier_district?: string | null
          occupier_email?: string | null
          occupier_name?: string | null
          occupier_phone?: string | null
          occupier_pincode?: string | null
          occupier_state?: string | null
          phone?: string | null
          pincode?: string | null
          short_name?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string
          created_at?: string
          currency_code?: string
          district?: string | null
          email?: string | null
          entity_type?: string | null
          id?: string
          incorporation_date?: string | null
          industry_type?: string | null
          logo_url?: string | null
          manager_address_line1?: string | null
          manager_address_line2?: string | null
          manager_city?: string | null
          manager_designation?: string | null
          manager_district?: string | null
          manager_email?: string | null
          manager_name?: string | null
          manager_phone?: string | null
          manager_pincode?: string | null
          manager_state?: string | null
          name?: string
          occupier_address_line1?: string | null
          occupier_address_line2?: string | null
          occupier_city?: string | null
          occupier_designation?: string | null
          occupier_district?: string | null
          occupier_email?: string | null
          occupier_name?: string | null
          occupier_phone?: string | null
          occupier_pincode?: string | null
          occupier_state?: string | null
          phone?: string | null
          pincode?: string | null
          short_name?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      holiday_lists: {
        Row: {
          created_at: string
          description: string | null
          from_date: string
          id: string
          name: string
          status: string
          to_date: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          from_date: string
          id?: string
          name: string
          status?: string
          to_date: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          description?: string | null
          from_date?: string
          id?: string
          name?: string
          status?: string
          to_date?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          description: string | null
          holiday_date: string
          holiday_list_id: string
          id: string
          is_recurring: boolean
          location: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          holiday_date: string
          holiday_list_id: string
          id?: string
          is_recurring?: boolean
          location?: string
          name: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          holiday_date?: string
          holiday_list_id?: string
          id?: string
          is_recurring?: boolean
          location?: string
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_holiday_list_id_fkey"
            columns: ["holiday_list_id"]
            isOneToOne: false
            referencedRelation: "holiday_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          accrued: number
          closing_balance: number
          created_at: string
          employee_id: string
          encashed: number
          id: string
          lapsed: number
          leave_type_id: string
          opening_balance: number
          pending: number
          updated_at: string
          used: number
          year: number
        }
        Insert: {
          accrued?: number
          closing_balance?: number
          created_at?: string
          employee_id: string
          encashed?: number
          id?: string
          lapsed?: number
          leave_type_id: string
          opening_balance?: number
          pending?: number
          updated_at?: string
          used?: number
          year: number
        }
        Update: {
          accrued?: number
          closing_balance?: number
          created_at?: string
          employee_id?: string
          encashed?: number
          id?: string
          lapsed?: number
          leave_type_id?: string
          opening_balance?: number
          pending?: number
          updated_at?: string
          used?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          applied_on: string
          approved_by: string | null
          approved_on: string | null
          contact_during_leave: string | null
          created_at: string
          days: number
          employee_id: string
          from_date: string
          handover_to: string | null
          id: string
          is_half_day: boolean
          leave_type_id: string
          reason: string | null
          remarks: string | null
          status: string
          to_date: string
          updated_at: string
        }
        Insert: {
          applied_on?: string
          approved_by?: string | null
          approved_on?: string | null
          contact_during_leave?: string | null
          created_at?: string
          days: number
          employee_id: string
          from_date: string
          handover_to?: string | null
          id?: string
          is_half_day?: boolean
          leave_type_id: string
          reason?: string | null
          remarks?: string | null
          status?: string
          to_date: string
          updated_at?: string
        }
        Update: {
          applied_on?: string
          approved_by?: string | null
          approved_on?: string | null
          contact_during_leave?: string | null
          created_at?: string
          days?: number
          employee_id?: string
          from_date?: string
          handover_to?: string | null
          id?: string
          is_half_day?: boolean
          leave_type_id?: string
          reason?: string | null
          remarks?: string | null
          status?: string
          to_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          accrual_basis: string
          accrual_days_per_cycle: number
          accrual_frequency: string
          accrual_start_month: number
          accrual_waiting_period_days: number
          accrue_on_probation: boolean
          advance_notice_days: number
          allow_half_day: boolean
          applicable_categories: string[]
          applicable_to_contractors: boolean
          applicable_to_part_time: boolean
          carry_forward_expiry_months: number
          carry_forward_policy: string
          carry_forward_to_next_year: boolean
          category: string
          code: string
          color: string
          created_at: string
          description: string | null
          documentation_after_days: number
          encashment_multiplier: number
          encashment_policy: string
          encashment_taxable: boolean
          gender_applicability: string
          id: string
          is_active: boolean
          is_paid: boolean
          max_accrual_per_year: number
          max_consecutive_days: number
          max_days_carry_forward: number
          max_days_per_year: number
          max_encashment_days_per_year: number
          min_balance_after_encashment: number
          min_days_per_application: number
          min_service_months: number
          name: string
          percentage_carry_forward: number
          requires_documentation: boolean
          updated_at: string
        }
        Insert: {
          accrual_basis?: string
          accrual_days_per_cycle?: number
          accrual_frequency?: string
          accrual_start_month?: number
          accrual_waiting_period_days?: number
          accrue_on_probation?: boolean
          advance_notice_days?: number
          allow_half_day?: boolean
          applicable_categories?: string[]
          applicable_to_contractors?: boolean
          applicable_to_part_time?: boolean
          carry_forward_expiry_months?: number
          carry_forward_policy?: string
          carry_forward_to_next_year?: boolean
          category: string
          code: string
          color?: string
          created_at?: string
          description?: string | null
          documentation_after_days?: number
          encashment_multiplier?: number
          encashment_policy?: string
          encashment_taxable?: boolean
          gender_applicability?: string
          id?: string
          is_active?: boolean
          is_paid?: boolean
          max_accrual_per_year?: number
          max_consecutive_days?: number
          max_days_carry_forward?: number
          max_days_per_year?: number
          max_encashment_days_per_year?: number
          min_balance_after_encashment?: number
          min_days_per_application?: number
          min_service_months?: number
          name: string
          percentage_carry_forward?: number
          requires_documentation?: boolean
          updated_at?: string
        }
        Update: {
          accrual_basis?: string
          accrual_days_per_cycle?: number
          accrual_frequency?: string
          accrual_start_month?: number
          accrual_waiting_period_days?: number
          accrue_on_probation?: boolean
          advance_notice_days?: number
          allow_half_day?: boolean
          applicable_categories?: string[]
          applicable_to_contractors?: boolean
          applicable_to_part_time?: boolean
          carry_forward_expiry_months?: number
          carry_forward_policy?: string
          carry_forward_to_next_year?: boolean
          category?: string
          code?: string
          color?: string
          created_at?: string
          description?: string | null
          documentation_after_days?: number
          encashment_multiplier?: number
          encashment_policy?: string
          encashment_taxable?: boolean
          gender_applicability?: string
          id?: string
          is_active?: boolean
          is_paid?: boolean
          max_accrual_per_year?: number
          max_consecutive_days?: number
          max_days_carry_forward?: number
          max_days_per_year?: number
          max_encashment_days_per_year?: number
          min_balance_after_encashment?: number
          min_days_per_application?: number
          min_service_months?: number
          name?: string
          percentage_carry_forward?: number
          requires_documentation?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      letterheads: {
        Row: {
          footer_bg_color: string
          footer_custom_html: string | null
          footer_divider_color: string
          footer_divider_enabled: boolean
          footer_divider_thickness: string
          footer_enabled: boolean
          footer_image_height: string
          footer_image_url: string | null
          footer_line1: string | null
          footer_line1_alignment: string
          footer_line1_color: string
          footer_line2: string | null
          footer_line2_alignment: string
          footer_line2_color: string
          footer_page_number_align: string
          footer_show_page_number: boolean
          footer_use_custom_html: boolean
          header_address_alignment: string
          header_address_line: string | null
          header_bg_color: string
          header_company_name: string | null
          header_company_name_align: string
          header_company_name_color: string
          header_company_name_size: string
          header_contact_alignment: string
          header_contact_line: string | null
          header_custom_html: string | null
          header_divider_color: string
          header_divider_enabled: boolean
          header_divider_thickness: string
          header_enabled: boolean
          header_image_height: string
          header_image_url: string | null
          header_logo_position: string
          header_logo_size: string
          header_logo_url: string | null
          header_tagline: string | null
          header_tagline_alignment: string
          header_tagline_color: string
          header_use_custom_html: boolean
          header_website_alignment: string
          header_website_line: string | null
          id: string
          is_active: boolean
          location_id: string
          margin_bottom: number
          margin_left: number
          margin_right: number
          margin_top: number
          paper_size: string
          updated_at: string
          use_for_appointment_letter: boolean
          use_for_experience_letter: boolean
          use_for_memo: boolean
          use_for_offer_letter: boolean
          use_for_payslip: boolean
          use_for_relieving_letter: boolean
          use_for_transfer_letter: boolean
          use_for_warning_letter: boolean
        }
        Insert: {
          footer_bg_color?: string
          footer_custom_html?: string | null
          footer_divider_color?: string
          footer_divider_enabled?: boolean
          footer_divider_thickness?: string
          footer_enabled?: boolean
          footer_image_height?: string
          footer_image_url?: string | null
          footer_line1?: string | null
          footer_line1_alignment?: string
          footer_line1_color?: string
          footer_line2?: string | null
          footer_line2_alignment?: string
          footer_line2_color?: string
          footer_page_number_align?: string
          footer_show_page_number?: boolean
          footer_use_custom_html?: boolean
          header_address_alignment?: string
          header_address_line?: string | null
          header_bg_color?: string
          header_company_name?: string | null
          header_company_name_align?: string
          header_company_name_color?: string
          header_company_name_size?: string
          header_contact_alignment?: string
          header_contact_line?: string | null
          header_custom_html?: string | null
          header_divider_color?: string
          header_divider_enabled?: boolean
          header_divider_thickness?: string
          header_enabled?: boolean
          header_image_height?: string
          header_image_url?: string | null
          header_logo_position?: string
          header_logo_size?: string
          header_logo_url?: string | null
          header_tagline?: string | null
          header_tagline_alignment?: string
          header_tagline_color?: string
          header_use_custom_html?: boolean
          header_website_alignment?: string
          header_website_line?: string | null
          id?: string
          is_active?: boolean
          location_id: string
          margin_bottom?: number
          margin_left?: number
          margin_right?: number
          margin_top?: number
          paper_size?: string
          updated_at?: string
          use_for_appointment_letter?: boolean
          use_for_experience_letter?: boolean
          use_for_memo?: boolean
          use_for_offer_letter?: boolean
          use_for_payslip?: boolean
          use_for_relieving_letter?: boolean
          use_for_transfer_letter?: boolean
          use_for_warning_letter?: boolean
        }
        Update: {
          footer_bg_color?: string
          footer_custom_html?: string | null
          footer_divider_color?: string
          footer_divider_enabled?: boolean
          footer_divider_thickness?: string
          footer_enabled?: boolean
          footer_image_height?: string
          footer_image_url?: string | null
          footer_line1?: string | null
          footer_line1_alignment?: string
          footer_line1_color?: string
          footer_line2?: string | null
          footer_line2_alignment?: string
          footer_line2_color?: string
          footer_page_number_align?: string
          footer_show_page_number?: boolean
          footer_use_custom_html?: boolean
          header_address_alignment?: string
          header_address_line?: string | null
          header_bg_color?: string
          header_company_name?: string | null
          header_company_name_align?: string
          header_company_name_color?: string
          header_company_name_size?: string
          header_contact_alignment?: string
          header_contact_line?: string | null
          header_custom_html?: string | null
          header_divider_color?: string
          header_divider_enabled?: boolean
          header_divider_thickness?: string
          header_enabled?: boolean
          header_image_height?: string
          header_image_url?: string | null
          header_logo_position?: string
          header_logo_size?: string
          header_logo_url?: string | null
          header_tagline?: string | null
          header_tagline_alignment?: string
          header_tagline_color?: string
          header_use_custom_html?: boolean
          header_website_alignment?: string
          header_website_line?: string | null
          id?: string
          is_active?: boolean
          location_id?: string
          margin_bottom?: number
          margin_left?: number
          margin_right?: number
          margin_top?: number
          paper_size?: string
          updated_at?: string
          use_for_appointment_letter?: boolean
          use_for_experience_letter?: boolean
          use_for_memo?: boolean
          use_for_offer_letter?: boolean
          use_for_payslip?: boolean
          use_for_relieving_letter?: boolean
          use_for_transfer_letter?: boolean
          use_for_warning_letter?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "letterheads_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_emi_schedule: {
        Row: {
          created_at: string
          due_date: string
          emi_amount: number
          id: string
          interest_component: number
          is_paid: boolean
          loan_id: string
          month_number: number
          paid_amount: number
          paid_date: string | null
          principal_component: number
        }
        Insert: {
          created_at?: string
          due_date: string
          emi_amount: number
          id?: string
          interest_component?: number
          is_paid?: boolean
          loan_id: string
          month_number: number
          paid_amount?: number
          paid_date?: string | null
          principal_component?: number
        }
        Update: {
          created_at?: string
          due_date?: string
          emi_amount?: number
          id?: string
          interest_component?: number
          is_paid?: boolean
          loan_id?: string
          month_number?: number
          paid_amount?: number
          paid_date?: string | null
          principal_component?: number
        }
        Relationships: [
          {
            foreignKeyName: "loan_emi_schedule_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_emi_schedule_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "v_active_loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_types: {
        Row: {
          code: string
          created_at: string
          deduction_head: string
          description: string | null
          eligibility_months: number
          id: string
          interest_rate: number
          is_active: boolean
          is_interest_free: boolean
          max_amount: number
          max_amount_multiplier: number
          max_tenure_months: number
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          deduction_head?: string
          description?: string | null
          eligibility_months?: number
          id?: string
          interest_rate?: number
          is_active?: boolean
          is_interest_free?: boolean
          max_amount?: number
          max_amount_multiplier?: number
          max_tenure_months?: number
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          deduction_head?: string
          description?: string | null
          eligibility_months?: number
          id?: string
          interest_rate?: number
          is_active?: boolean
          is_interest_free?: boolean
          max_amount?: number
          max_amount_multiplier?: number
          max_tenure_months?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      loans: {
        Row: {
          applied_date: string
          approved_by: string | null
          approved_on: string | null
          created_at: string
          disbursed_date: string | null
          emi_amount: number
          employee_id: string
          id: string
          interest_rate: number
          loan_type_id: string
          outstanding_balance: number
          paid_emis: number
          principal_amount: number
          purpose: string | null
          remarks: string | null
          status: string
          tenure_months: number
          updated_at: string
        }
        Insert: {
          applied_date?: string
          approved_by?: string | null
          approved_on?: string | null
          created_at?: string
          disbursed_date?: string | null
          emi_amount?: number
          employee_id: string
          id?: string
          interest_rate?: number
          loan_type_id: string
          outstanding_balance?: number
          paid_emis?: number
          principal_amount: number
          purpose?: string | null
          remarks?: string | null
          status?: string
          tenure_months: number
          updated_at?: string
        }
        Update: {
          applied_date?: string
          approved_by?: string | null
          approved_on?: string | null
          created_at?: string
          disbursed_date?: string | null
          emi_amount?: number
          employee_id?: string
          id?: string
          interest_rate?: number
          loan_type_id?: string
          outstanding_balance?: number
          paid_emis?: number
          principal_amount?: number
          purpose?: string | null
          remarks?: string | null
          status?: string
          tenure_months?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_loan_type_id_fkey"
            columns: ["loan_type_id"]
            isOneToOne: false
            referencedRelation: "loan_types"
            referencedColumns: ["id"]
          },
        ]
      }
      location_bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          account_type: string
          bank_name: string
          branch_address: string | null
          branch_name: string | null
          created_at: string
          id: string
          ifsc_code: string
          is_primary: boolean
          location_id: string
          micr_code: string | null
          status: string
          swift_code: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          account_type?: string
          bank_name: string
          branch_address?: string | null
          branch_name?: string | null
          created_at?: string
          id?: string
          ifsc_code: string
          is_primary?: boolean
          location_id: string
          micr_code?: string | null
          status?: string
          swift_code?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          account_type?: string
          bank_name?: string
          branch_address?: string | null
          branch_name?: string | null
          created_at?: string
          id?: string
          ifsc_code?: string
          is_primary?: boolean
          location_id?: string
          micr_code?: string | null
          status?: string
          swift_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_bank_accounts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_documents: {
        Row: {
          description: string | null
          document_category: string
          document_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          location_id: string
          uploaded_at: string
        }
        Insert: {
          description?: string | null
          document_category: string
          document_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          location_id: string
          uploaded_at?: string
        }
        Update: {
          description?: string | null
          document_category?: string
          document_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          location_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_documents_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "work_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_heads: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          ledger_group: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          ledger_group: string
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          ledger_group?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      payroll_entries: {
        Row: {
          absent_days: number
          advance_recovery: number
          basic_salary: number
          conveyance_allowance: number
          created_at: string
          employee_id: string
          esi_employee: number
          esi_employer: number
          gross_salary: number
          hra: number
          id: string
          leave_days: number
          loan_emi: number
          lta: number
          medical_allowance: number
          net_salary: number
          other_deductions: number
          other_earnings: number
          overtime_hours: number
          payroll_period_id: string
          payroll_run_id: string
          pf_employee: number
          pf_employer: number
          present_days: number
          professional_tax: number
          remarks: string | null
          special_allowance: number
          status: string
          tds: number
          total_deductions: number
          updated_at: string
          working_days: number
        }
        Insert: {
          absent_days?: number
          advance_recovery?: number
          basic_salary?: number
          conveyance_allowance?: number
          created_at?: string
          employee_id: string
          esi_employee?: number
          esi_employer?: number
          gross_salary?: number
          hra?: number
          id?: string
          leave_days?: number
          loan_emi?: number
          lta?: number
          medical_allowance?: number
          net_salary?: number
          other_deductions?: number
          other_earnings?: number
          overtime_hours?: number
          payroll_period_id: string
          payroll_run_id: string
          pf_employee?: number
          pf_employer?: number
          present_days?: number
          professional_tax?: number
          remarks?: string | null
          special_allowance?: number
          status?: string
          tds?: number
          total_deductions?: number
          updated_at?: string
          working_days?: number
        }
        Update: {
          absent_days?: number
          advance_recovery?: number
          basic_salary?: number
          conveyance_allowance?: number
          created_at?: string
          employee_id?: string
          esi_employee?: number
          esi_employer?: number
          gross_salary?: number
          hra?: number
          id?: string
          leave_days?: number
          loan_emi?: number
          lta?: number
          medical_allowance?: number
          net_salary?: number
          other_deductions?: number
          other_earnings?: number
          overtime_hours?: number
          payroll_period_id?: string
          payroll_run_id?: string
          pf_employee?: number
          pf_employer?: number
          present_days?: number
          professional_tax?: number
          remarks?: string | null
          special_allowance?: number
          status?: string
          tds?: number
          total_deductions?: number
          updated_at?: string
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "v_payroll_period_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "v_payroll_period_summary"
            referencedColumns: ["run_id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          code: string
          created_at: string
          description: string | null
          financial_year: string
          frequency: string
          from_date: string
          id: string
          is_default: boolean
          name: string
          payment_date: string
          status: string
          to_date: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          code: string
          created_at?: string
          description?: string | null
          financial_year: string
          frequency?: string
          from_date: string
          id?: string
          is_default?: boolean
          name: string
          payment_date: string
          status?: string
          to_date: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          code?: string
          created_at?: string
          description?: string | null
          financial_year?: string
          frequency?: string
          from_date?: string
          id?: string
          is_default?: boolean
          name?: string
          payment_date?: string
          status?: string
          to_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          payroll_period_id: string
          processed_by: string | null
          remarks: string | null
          run_date: string
          status: string
          total_deductions: number
          total_employees: number
          total_employer_esi: number
          total_employer_pf: number
          total_gross: number
          total_net: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          payroll_period_id: string
          processed_by?: string | null
          remarks?: string | null
          run_date?: string
          status?: string
          total_deductions?: number
          total_employees?: number
          total_employer_esi?: number
          total_employer_pf?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          payroll_period_id?: string
          processed_by?: string | null
          remarks?: string | null
          run_date?: string
          status?: string
          total_deductions?: number
          total_employees?: number
          total_employer_esi?: number
          total_employer_pf?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "v_payroll_period_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_runs_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
        ]
      }
      pf_esi_config: {
        Row: {
          esi_employee_rate: number
          esi_employer_rate: number
          esi_enabled: boolean
          esi_wage_ceiling: number
          gratuity_enabled: boolean
          gratuity_formula: string
          gratuity_min_years: number
          id: string
          nps_employee_rate: number
          nps_employer_rate: number
          nps_enabled: boolean
          pf_admin_charges: number
          pf_apply_on: string
          pf_edli_charges: number
          pf_employee_rate: number
          pf_employer_rate: number
          pf_enabled: boolean
          pf_wage_ceiling: number
          updated_at: string
          vpf_enabled: boolean
          vpf_max_percentage: number
        }
        Insert: {
          esi_employee_rate?: number
          esi_employer_rate?: number
          esi_enabled?: boolean
          esi_wage_ceiling?: number
          gratuity_enabled?: boolean
          gratuity_formula?: string
          gratuity_min_years?: number
          id?: string
          nps_employee_rate?: number
          nps_employer_rate?: number
          nps_enabled?: boolean
          pf_admin_charges?: number
          pf_apply_on?: string
          pf_edli_charges?: number
          pf_employee_rate?: number
          pf_employer_rate?: number
          pf_enabled?: boolean
          pf_wage_ceiling?: number
          updated_at?: string
          vpf_enabled?: boolean
          vpf_max_percentage?: number
        }
        Update: {
          esi_employee_rate?: number
          esi_employer_rate?: number
          esi_enabled?: boolean
          esi_wage_ceiling?: number
          gratuity_enabled?: boolean
          gratuity_formula?: string
          gratuity_min_years?: number
          id?: string
          nps_employee_rate?: number
          nps_employer_rate?: number
          nps_enabled?: boolean
          pf_admin_charges?: number
          pf_apply_on?: string
          pf_edli_charges?: number
          pf_employee_rate?: number
          pf_employer_rate?: number
          pf_enabled?: boolean
          pf_wage_ceiling?: number
          updated_at?: string
          vpf_enabled?: boolean
          vpf_max_percentage?: number
        }
        Relationships: []
      }
      salary_components: {
        Row: {
          calculation_basis: string
          code: string
          created_at: string
          description: string | null
          esi_applicability: string
          formula: string | null
          id: string
          is_active: boolean
          is_system_defined: boolean
          name: string
          pf_applicability: string
          taxability: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          calculation_basis?: string
          code: string
          created_at?: string
          description?: string | null
          esi_applicability?: string
          formula?: string | null
          id?: string
          is_active?: boolean
          is_system_defined?: boolean
          name: string
          pf_applicability?: string
          taxability?: string
          type: string
          updated_at?: string
          value?: number
        }
        Update: {
          calculation_basis?: string
          code?: string
          created_at?: string
          description?: string | null
          esi_applicability?: string
          formula?: string | null
          id?: string
          is_active?: boolean
          is_system_defined?: boolean
          name?: string
          pf_applicability?: string
          taxability?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      salary_structure_components: {
        Row: {
          calculation_basis: string | null
          created_at: string
          id: string
          salary_component_id: string
          salary_structure_id: string
          sort_order: number
          value: number
        }
        Insert: {
          calculation_basis?: string | null
          created_at?: string
          id?: string
          salary_component_id: string
          salary_structure_id: string
          sort_order?: number
          value?: number
        }
        Update: {
          calculation_basis?: string | null
          created_at?: string
          id?: string
          salary_component_id?: string
          salary_structure_id?: string
          sort_order?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_structure_components_salary_component_id_fkey"
            columns: ["salary_component_id"]
            isOneToOne: false
            referencedRelation: "salary_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_structure_components_salary_structure_id_fkey"
            columns: ["salary_structure_id"]
            isOneToOne: false
            referencedRelation: "salary_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_structures: {
        Row: {
          applicable_to: string[]
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          applicable_to?: string[]
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          applicable_to?: string[]
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          applicable_days: number[]
          break_duration_minutes: number
          break_end_time: string | null
          break_start_time: string | null
          category: string
          code: string
          color: string
          created_at: string
          description: string | null
          end_time: string
          grace_period_minutes: number
          half_day_hours: number
          id: string
          minimum_hours_full_day: number
          name: string
          overtime_daily_limit_hours: number
          overtime_max_hours_per_day: number
          overtime_multiplier: number
          overtime_policy: string
          overtime_requires_approval: boolean
          overtime_weekly_limit_hours: number
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          applicable_days?: number[]
          break_duration_minutes?: number
          break_end_time?: string | null
          break_start_time?: string | null
          category?: string
          code: string
          color?: string
          created_at?: string
          description?: string | null
          end_time: string
          grace_period_minutes?: number
          half_day_hours?: number
          id?: string
          minimum_hours_full_day?: number
          name: string
          overtime_daily_limit_hours?: number
          overtime_max_hours_per_day?: number
          overtime_multiplier?: number
          overtime_policy?: string
          overtime_requires_approval?: boolean
          overtime_weekly_limit_hours?: number
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          applicable_days?: number[]
          break_duration_minutes?: number
          break_end_time?: string | null
          break_start_time?: string | null
          category?: string
          code?: string
          color?: string
          created_at?: string
          description?: string | null
          end_time?: string
          grace_period_minutes?: number
          half_day_hours?: number
          id?: string
          minimum_hours_full_day?: number
          name?: string
          overtime_daily_limit_hours?: number
          overtime_max_hours_per_day?: number
          overtime_multiplier?: number
          overtime_policy?: string
          overtime_requires_approval?: boolean
          overtime_weekly_limit_hours?: number
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_users: {
        Row: {
          auth_user_id: string | null
          avatar: string | null
          created_at: string
          department: string | null
          email: string
          employee_id: string | null
          id: string
          last_login: string | null
          name: string
          phone: string | null
          role: string
          status: string
          two_factor_enabled: boolean
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar?: string | null
          created_at?: string
          department?: string | null
          email: string
          employee_id?: string | null
          id?: string
          last_login?: string | null
          name: string
          phone?: string | null
          role?: string
          status?: string
          two_factor_enabled?: boolean
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          avatar?: string | null
          created_at?: string
          department?: string | null
          email?: string
          employee_id?: string | null
          id?: string
          last_login?: string | null
          name?: string
          phone?: string | null
          role?: string
          status?: string
          two_factor_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_users_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_users_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      tds_slabs: {
        Row: {
          cess_rate: number
          created_at: string
          description: string | null
          financial_year: string
          from_amount: number
          gender: string
          id: string
          regime: string
          surcharge_rate: number
          tax_rate: number
          to_amount: number
        }
        Insert: {
          cess_rate?: number
          created_at?: string
          description?: string | null
          financial_year: string
          from_amount: number
          gender?: string
          id?: string
          regime: string
          surcharge_rate?: number
          tax_rate?: number
          to_amount: number
        }
        Update: {
          cess_rate?: number
          created_at?: string
          description?: string | null
          financial_year?: string
          from_amount?: number
          gender?: string
          id?: string
          regime?: string
          surcharge_rate?: number
          tax_rate?: number
          to_amount?: number
        }
        Relationships: []
      }
      user_privileges: {
        Row: {
          can_approve: boolean
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_export: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          system_user_id: string
          updated_at: string
        }
        Insert: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          system_user_id: string
          updated_at?: string
        }
        Update: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          system_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_privileges_system_user_id_fkey"
            columns: ["system_user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
        ]
      }
      work_locations: {
        Row: {
          address: string | null
          cin_no: string | null
          city: string | null
          code: string
          country: string
          created_at: string
          email: string | null
          employee_count: number
          epf_code_no: string | null
          esi_code_no: string | null
          factory_commencement_date: string | null
          factory_full_postal_address: string | null
          factory_gps_latitude: string | null
          factory_gps_longitude: string | null
          factory_license_limit: number | null
          factory_manager_address_line1: string | null
          factory_manager_address_line2: string | null
          factory_manager_city: string | null
          factory_manager_designation: string | null
          factory_manager_district: string | null
          factory_manager_email: string | null
          factory_manager_name: string | null
          factory_manager_phone: string | null
          factory_manager_pincode: string | null
          factory_manager_state: string | null
          factory_max_workers_per_day: number | null
          factory_nic_code: string | null
          factory_occupier_address_line1: string | null
          factory_occupier_address_line2: string | null
          factory_occupier_city: string | null
          factory_occupier_designation: string | null
          factory_occupier_district: string | null
          factory_occupier_email: string | null
          factory_occupier_name: string | null
          factory_occupier_phone: string | null
          factory_occupier_pincode: string | null
          factory_occupier_state: string | null
          factory_registration_date: string | null
          factory_validity_from: string | null
          factory_validity_to: string | null
          gst_code: string | null
          id: string
          is_factory: boolean
          lin_no: string | null
          name: string
          pan_no: string | null
          phone: string | null
          pt_no: string | null
          state: string | null
          status: string
          tan_no: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cin_no?: string | null
          city?: string | null
          code: string
          country?: string
          created_at?: string
          email?: string | null
          employee_count?: number
          epf_code_no?: string | null
          esi_code_no?: string | null
          factory_commencement_date?: string | null
          factory_full_postal_address?: string | null
          factory_gps_latitude?: string | null
          factory_gps_longitude?: string | null
          factory_license_limit?: number | null
          factory_manager_address_line1?: string | null
          factory_manager_address_line2?: string | null
          factory_manager_city?: string | null
          factory_manager_designation?: string | null
          factory_manager_district?: string | null
          factory_manager_email?: string | null
          factory_manager_name?: string | null
          factory_manager_phone?: string | null
          factory_manager_pincode?: string | null
          factory_manager_state?: string | null
          factory_max_workers_per_day?: number | null
          factory_nic_code?: string | null
          factory_occupier_address_line1?: string | null
          factory_occupier_address_line2?: string | null
          factory_occupier_city?: string | null
          factory_occupier_designation?: string | null
          factory_occupier_district?: string | null
          factory_occupier_email?: string | null
          factory_occupier_name?: string | null
          factory_occupier_phone?: string | null
          factory_occupier_pincode?: string | null
          factory_occupier_state?: string | null
          factory_registration_date?: string | null
          factory_validity_from?: string | null
          factory_validity_to?: string | null
          gst_code?: string | null
          id?: string
          is_factory?: boolean
          lin_no?: string | null
          name: string
          pan_no?: string | null
          phone?: string | null
          pt_no?: string | null
          state?: string | null
          status?: string
          tan_no?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cin_no?: string | null
          city?: string | null
          code?: string
          country?: string
          created_at?: string
          email?: string | null
          employee_count?: number
          epf_code_no?: string | null
          esi_code_no?: string | null
          factory_commencement_date?: string | null
          factory_full_postal_address?: string | null
          factory_gps_latitude?: string | null
          factory_gps_longitude?: string | null
          factory_license_limit?: number | null
          factory_manager_address_line1?: string | null
          factory_manager_address_line2?: string | null
          factory_manager_city?: string | null
          factory_manager_designation?: string | null
          factory_manager_district?: string | null
          factory_manager_email?: string | null
          factory_manager_name?: string | null
          factory_manager_phone?: string | null
          factory_manager_pincode?: string | null
          factory_manager_state?: string | null
          factory_max_workers_per_day?: number | null
          factory_nic_code?: string | null
          factory_occupier_address_line1?: string | null
          factory_occupier_address_line2?: string | null
          factory_occupier_city?: string | null
          factory_occupier_designation?: string | null
          factory_occupier_district?: string | null
          factory_occupier_email?: string | null
          factory_occupier_name?: string | null
          factory_occupier_phone?: string | null
          factory_occupier_pincode?: string | null
          factory_occupier_state?: string | null
          factory_registration_date?: string | null
          factory_validity_from?: string | null
          factory_validity_to?: string | null
          gst_code?: string | null
          id?: string
          is_factory?: boolean
          lin_no?: string | null
          name?: string
          pan_no?: string | null
          phone?: string | null
          pt_no?: string | null
          state?: string | null
          status?: string
          tan_no?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_active_loans: {
        Row: {
          department: string | null
          disbursed_date: string | null
          emi_amount: number | null
          employee_code: string | null
          employee_id: string | null
          employee_name: string | null
          id: string | null
          interest_rate: number | null
          loan_type: string | null
          outstanding_balance: number | null
          paid_emis: number | null
          principal_amount: number | null
          purpose: string | null
          status: string | null
          tenure_months: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      v_employee_summary: {
        Row: {
          current_employee_id: string | null
          date_of_birth: string | null
          date_of_joining: string | null
          department_code: string | null
          department_name: string | null
          designation_code: string | null
          designation_name: string | null
          employee_category_name: string | null
          employee_grade_code: string | null
          employee_grade_name: string | null
          employee_group_name: string | null
          employee_id: string | null
          employee_type_name: string | null
          full_name: string | null
          gender: string | null
          id: string | null
          reporting_manager_name: string | null
          shift_name: string | null
          status: string | null
          work_location_code: string | null
          work_location_name: string | null
        }
        Relationships: []
      }
      v_leave_balance_summary: {
        Row: {
          accrued: number | null
          closing_balance: number | null
          department: string | null
          employee_code: string | null
          employee_id: string | null
          employee_name: string | null
          encashed: number | null
          lapsed: number | null
          leave_type_code: string | null
          leave_type_name: string | null
          opening_balance: number | null
          pending: number | null
          used: number | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      v_payroll_period_summary: {
        Row: {
          approved_at: string | null
          financial_year: string | null
          from_date: string | null
          id: string | null
          payment_date: string | null
          period_code: string | null
          period_name: string | null
          period_status: string | null
          run_date: string | null
          run_id: string | null
          run_status: string | null
          to_date: string | null
          total_deductions: number | null
          total_employees: number | null
          total_employer_esi: number | null
          total_employer_pf: number | null
          total_gross: number | null
          total_net: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_emi: {
        Args: { p_annual_rate: number; p_principal: number; p_tenure: number }
        Returns: number
      }
      generate_employee_id: {
        Args: { p_prefix?: string; p_year?: number }
        Returns: string
      }
      get_leave_balance: {
        Args: {
          p_employee_id: string
          p_leave_type_id: string
          p_year?: number
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
