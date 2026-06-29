export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      asset_allocations: {
        Row: {
          action: string
          asset_id: string
          created_at: string
          employee_id: string | null
          id: string
          on_date: string
          org_id: string | null
          remarks: string | null
        }
        Insert: {
          action: string
          asset_id: string
          created_at?: string
          employee_id?: string | null
          id?: string
          on_date?: string
          org_id?: string | null
          remarks?: string | null
        }
        Update: {
          action?: string
          asset_id?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          on_date?: string
          org_id?: string | null
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_allocations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_allocations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_allocations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_categories: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string | null
          status: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id?: string | null
          status?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          allocated_on: string | null
          allocated_to: string | null
          category_id: string | null
          condition: string | null
          created_at: string
          id: string
          make_model: string | null
          mobile_number: string | null
          name: string
          org_id: string | null
          product_id: string
          purchase_cost: number | null
          purchase_date: string | null
          remarks: string | null
          serial_number: string | null
          specifications: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          allocated_on?: string | null
          allocated_to?: string | null
          category_id?: string | null
          condition?: string | null
          created_at?: string
          id?: string
          make_model?: string | null
          mobile_number?: string | null
          name: string
          org_id?: string | null
          product_id: string
          purchase_cost?: number | null
          purchase_date?: string | null
          remarks?: string | null
          serial_number?: string | null
          specifications?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          allocated_on?: string | null
          allocated_to?: string | null
          category_id?: string | null
          condition?: string | null
          created_at?: string
          id?: string
          make_model?: string | null
          mobile_number?: string | null
          name?: string
          org_id?: string | null
          product_id?: string
          purchase_cost?: number | null
          purchase_date?: string | null
          remarks?: string | null
          serial_number?: string | null
          specifications?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_allocated_to_fkey"
            columns: ["allocated_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          approval_status: string
          attendance_date: string
          check_in: string | null
          check_out: string | null
          created_at: string
          employee_id: string
          hours_worked: number
          id: string
          org_id: string | null
          overtime_hours: number
          remarks: string | null
          shift_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approval_status?: string
          attendance_date: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          employee_id: string
          hours_worked?: number
          id?: string
          org_id?: string | null
          overtime_hours?: number
          remarks?: string | null
          shift_id?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          attendance_date?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          employee_id?: string
          hours_worked?: number
          id?: string
          org_id?: string | null
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
            foreignKeyName: "attendance_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      deduction_entries: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: string
          created_at: string
          description: string | null
          employee_approval_at: string | null
          employee_approval_required: boolean
          employee_approval_status: string | null
          employee_id: string | null
          employee_rejection_reason: string | null
          id: string
          notification_sent_at: string | null
          org_id: string | null
          payroll_period_id: string | null
          reference_no: string | null
          remarks: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category: string
          created_at?: string
          description?: string | null
          employee_approval_at?: string | null
          employee_approval_required?: boolean
          employee_approval_status?: string | null
          employee_id?: string | null
          employee_rejection_reason?: string | null
          id?: string
          notification_sent_at?: string | null
          org_id?: string | null
          payroll_period_id?: string | null
          reference_no?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          created_at?: string
          description?: string | null
          employee_approval_at?: string | null
          employee_approval_required?: boolean
          employee_approval_status?: string | null
          employee_id?: string | null
          employee_rejection_reason?: string | null
          id?: string
          notification_sent_at?: string | null
          org_id?: string | null
          payroll_period_id?: string | null
          reference_no?: string | null
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deduction_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deduction_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deduction_entries_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "departments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "designations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signatures: {
        Row: {
          aadhaar_last4: string | null
          created_at: string
          document_category: string | null
          document_name: string | null
          document_ref: string
          id: string
          org_id: string | null
          signature_hash: string | null
          signed_at: string | null
          signed_by: string | null
          signed_timestamp: string
          signer_employee_id: string | null
          signer_name: string | null
          source: string | null
          transaction_id: string | null
        }
        Insert: {
          aadhaar_last4?: string | null
          created_at?: string
          document_category?: string | null
          document_name?: string | null
          document_ref: string
          id?: string
          org_id?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signed_timestamp?: string
          signer_employee_id?: string | null
          signer_name?: string | null
          source?: string | null
          transaction_id?: string | null
        }
        Update: {
          aadhaar_last4?: string | null
          created_at?: string
          document_category?: string | null
          document_name?: string | null
          document_ref?: string
          id?: string
          org_id?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signed_timestamp?: string
          signer_employee_id?: string | null
          signer_name?: string | null
          source?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          bucket: string
          category: string | null
          created_at: string
          entity_ref: string
          entity_type: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          org_id: string | null
          signature: Json | null
          signed: boolean
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          bucket?: string
          category?: string | null
          created_at?: string
          entity_ref: string
          entity_type: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          org_id?: string | null
          signature?: Json | null
          signed?: boolean
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          category?: string | null
          created_at?: string
          entity_ref?: string
          entity_type?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          org_id?: string | null
          signature?: Json | null
          signed?: boolean
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_deliveries: {
        Row: {
          body_html: string | null
          category: string
          confirmed_at: string | null
          created_at: string
          doc_opened_at: string | null
          doc_path: string | null
          document_title: string | null
          employee_id: string | null
          error: string | null
          id: string
          message_id: string | null
          opened_at: string | null
          org_id: string | null
          provider: string
          sent_at: string | null
          status: string
          subject: string | null
          to_email: string | null
          token: string
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          category?: string
          confirmed_at?: string | null
          created_at?: string
          doc_opened_at?: string | null
          doc_path?: string | null
          document_title?: string | null
          employee_id?: string | null
          error?: string | null
          id?: string
          message_id?: string | null
          opened_at?: string | null
          org_id?: string | null
          provider?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          to_email?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          category?: string
          confirmed_at?: string | null
          created_at?: string
          doc_opened_at?: string | null
          doc_path?: string | null
          document_title?: string | null
          employee_id?: string | null
          error?: string | null
          id?: string
          message_id?: string | null
          opened_at?: string | null
          org_id?: string | null
          provider?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          to_email?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_deliveries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_deliveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "employee_bank_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_classifications: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_classifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "employee_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "employee_education_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_exits: {
        Row: {
          acceptance_issued: boolean
          created_at: string
          employee_id: string
          exit_type: string
          id: string
          last_working_day: string | null
          notice_days: number
          notice_served: boolean
          notice_waived: boolean
          org_id: string | null
          reason: string | null
          rehire_eligible: boolean
          remarks: string | null
          report_deadline: string | null
          resignation_date: string | null
          status: string
          step_flags: Json
          submitted_by: string
          updated_at: string
        }
        Insert: {
          acceptance_issued?: boolean
          created_at?: string
          employee_id: string
          exit_type?: string
          id?: string
          last_working_day?: string | null
          notice_days?: number
          notice_served?: boolean
          notice_waived?: boolean
          org_id?: string | null
          reason?: string | null
          rehire_eligible?: boolean
          remarks?: string | null
          report_deadline?: string | null
          resignation_date?: string | null
          status?: string
          step_flags?: Json
          submitted_by?: string
          updated_at?: string
        }
        Update: {
          acceptance_issued?: boolean
          created_at?: string
          employee_id?: string
          exit_type?: string
          id?: string
          last_working_day?: string | null
          notice_days?: number
          notice_served?: boolean
          notice_waived?: boolean
          org_id?: string | null
          reason?: string | null
          rehire_eligible?: boolean
          remarks?: string | null
          report_deadline?: string | null
          resignation_date?: string | null
          status?: string
          step_flags?: Json
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_exits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "employee_family_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_grades_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_groups: {
        Row: {
          code: string
          created_at: string
          description: string | null
          group_type: string
          id: string
          name: string
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_languages: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          language: string
          org_id: string | null
          read_level: string
          speak_level: string
          write_level: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          language: string
          org_id?: string | null
          read_level?: string
          speak_level?: string
          write_level?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          language?: string
          org_id?: string | null
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
            foreignKeyName: "employee_languages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_assignments: {
        Row: {
          component_values: Json | null
          created_at: string
          ctc_annual: number
          ctc_monthly: number
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          is_current: boolean
          org_id: string | null
          salary_structure_id: string
          statutory_overrides: Json | null
          updated_at: string
          vpf_percentage: number
        }
        Insert: {
          component_values?: Json | null
          created_at?: string
          ctc_annual?: number
          ctc_monthly?: number
          effective_from: string
          effective_to?: string | null
          employee_id: string
          id?: string
          is_current?: boolean
          org_id?: string | null
          salary_structure_id: string
          statutory_overrides?: Json | null
          updated_at?: string
          vpf_percentage?: number
        }
        Update: {
          component_values?: Json | null
          created_at?: string
          ctc_annual?: number
          ctc_monthly?: number
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          is_current?: boolean
          org_id?: string | null
          salary_structure_id?: string
          statutory_overrides?: Json | null
          updated_at?: string
          vpf_percentage?: number
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
            foreignKeyName: "employee_salary_assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          parent_section?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_sections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "employee_statutory_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "employee_work_experience_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          anniversary_date: string | null
          attendance_system_id: string | null
          blood_group: string | null
          caste: string | null
          created_at: string
          current_employee_id: string | null
          date_of_birth: string | null
          date_of_confirmation: string | null
          date_of_joining: string | null
          department_id: string | null
          designation_id: string | null
          email: string | null
          employee_category_id: string | null
          employee_classification: string | null
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
          mobile_number: string | null
          mother_name: string | null
          mother_tongue: string | null
          nationality: string
          notice_period_days: number
          offer_letter_validity_days: number
          org_id: string | null
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
          relieving_date: string | null
          religion: string | null
          reporting_manager_id: string | null
          same_address: boolean
          section: string | null
          service_book_no: string | null
          shift_id: string | null
          signature_url: string | null
          status: string
          tax_regime: string
          thumb_impression_url: string | null
          total_experience_months: number
          total_experience_years: number
          updated_at: string
          work_location_id: string | null
        }
        Insert: {
          anniversary_date?: string | null
          attendance_system_id?: string | null
          blood_group?: string | null
          caste?: string | null
          created_at?: string
          current_employee_id?: string | null
          date_of_birth?: string | null
          date_of_confirmation?: string | null
          date_of_joining?: string | null
          department_id?: string | null
          designation_id?: string | null
          email?: string | null
          employee_category_id?: string | null
          employee_classification?: string | null
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
          mobile_number?: string | null
          mother_name?: string | null
          mother_tongue?: string | null
          nationality?: string
          notice_period_days?: number
          offer_letter_validity_days?: number
          org_id?: string | null
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
          relieving_date?: string | null
          religion?: string | null
          reporting_manager_id?: string | null
          same_address?: boolean
          section?: string | null
          service_book_no?: string | null
          shift_id?: string | null
          signature_url?: string | null
          status?: string
          tax_regime?: string
          thumb_impression_url?: string | null
          total_experience_months?: number
          total_experience_years?: number
          updated_at?: string
          work_location_id?: string | null
        }
        Update: {
          anniversary_date?: string | null
          attendance_system_id?: string | null
          blood_group?: string | null
          caste?: string | null
          created_at?: string
          current_employee_id?: string | null
          date_of_birth?: string | null
          date_of_confirmation?: string | null
          date_of_joining?: string | null
          department_id?: string | null
          designation_id?: string | null
          email?: string | null
          employee_category_id?: string | null
          employee_classification?: string | null
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
          mobile_number?: string | null
          mother_name?: string | null
          mother_tongue?: string | null
          nationality?: string
          notice_period_days?: number
          offer_letter_validity_days?: number
          org_id?: string | null
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
          relieving_date?: string | null
          religion?: string | null
          reporting_manager_id?: string | null
          same_address?: boolean
          section?: string | null
          service_book_no?: string | null
          shift_id?: string | null
          signature_url?: string | null
          status?: string
          tax_regime?: string
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
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          employee_id_pattern: Json | null
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
          net_roundoff: string
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
          org_id: string | null
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
          employee_id_pattern?: Json | null
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
          net_roundoff?: string
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
          org_id?: string | null
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
          employee_id_pattern?: Json | null
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
          net_roundoff?: string
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
          org_id?: string | null
          phone?: string | null
          pincode?: string | null
          short_name?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "establishment_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exit_approvals: {
        Row: {
          acted_at: string | null
          approver_employee_id: string | null
          approver_name: string | null
          created_at: string
          exit_id: string
          id: string
          level: number
          org_id: string | null
          remarks: string | null
          role: string | null
          status: string
        }
        Insert: {
          acted_at?: string | null
          approver_employee_id?: string | null
          approver_name?: string | null
          created_at?: string
          exit_id: string
          id?: string
          level?: number
          org_id?: string | null
          remarks?: string | null
          role?: string | null
          status?: string
        }
        Update: {
          acted_at?: string | null
          approver_employee_id?: string | null
          approver_name?: string | null
          created_at?: string
          exit_id?: string
          id?: string
          level?: number
          org_id?: string | null
          remarks?: string | null
          role?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "exit_approvals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exit_clearances: {
        Row: {
          cleared_at: string | null
          created_at: string
          department: string
          exit_id: string
          id: string
          org_id: string | null
          remarks: string | null
          status: string
        }
        Insert: {
          cleared_at?: string | null
          created_at?: string
          department: string
          exit_id: string
          id?: string
          org_id?: string | null
          remarks?: string | null
          status?: string
        }
        Update: {
          cleared_at?: string | null
          created_at?: string
          department?: string
          exit_id?: string
          id?: string
          org_id?: string | null
          remarks?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "exit_clearances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exit_settlements: {
        Row: {
          bonus_amount: number
          created_at: string
          exit_id: string
          gratuity_amount: number
          id: string
          leave_encash_amount: number
          leave_encash_days: number
          loan_recovery: number
          net_settlement: number
          notice_recovery: number
          org_id: string | null
          other_additions: number
          other_deductions: number
          pending_salary: number
          remarks: string | null
          settled_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bonus_amount?: number
          created_at?: string
          exit_id: string
          gratuity_amount?: number
          id?: string
          leave_encash_amount?: number
          leave_encash_days?: number
          loan_recovery?: number
          net_settlement?: number
          notice_recovery?: number
          org_id?: string | null
          other_additions?: number
          other_deductions?: number
          pending_salary?: number
          remarks?: string | null
          settled_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bonus_amount?: number
          created_at?: string
          exit_id?: string
          gratuity_amount?: number
          id?: string
          leave_encash_amount?: number
          leave_encash_days?: number
          loan_recovery?: number
          net_settlement?: number
          notice_recovery?: number
          org_id?: string | null
          other_additions?: number
          other_deductions?: number
          pending_salary?: number
          remarks?: string | null
          settled_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exit_settlements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_letters: {
        Row: {
          acknowledged_at: string | null
          body_html: string
          category: string
          created_at: string
          employee_id: string | null
          id: string
          org_id: string | null
          ref_no: string | null
          sent_at: string | null
          signature: Json | null
          status: string
          template_id: string | null
          title: string
          updated_at: string
          use_letterhead: boolean
        }
        Insert: {
          acknowledged_at?: string | null
          body_html?: string
          category: string
          created_at?: string
          employee_id?: string | null
          id?: string
          org_id?: string | null
          ref_no?: string | null
          sent_at?: string | null
          signature?: Json | null
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          use_letterhead?: boolean
        }
        Update: {
          acknowledged_at?: string | null
          body_html?: string
          category?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          org_id?: string | null
          ref_no?: string | null
          sent_at?: string | null
          signature?: Json | null
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          use_letterhead?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "generated_letters_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_letters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_letters_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "letter_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      gratuity_settlements: {
        Row: {
          created_at: string
          employee_id: string
          formula: string | null
          gratuity_amount: number
          id: string
          last_basic: number
          org_id: string | null
          remarks: string | null
          settlement_date: string
          years_of_service: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          formula?: string | null
          gratuity_amount?: number
          id?: string
          last_basic?: number
          org_id?: string | null
          remarks?: string | null
          settlement_date: string
          years_of_service?: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          formula?: string | null
          gratuity_amount?: number
          id?: string
          last_basic?: number
          org_id?: string | null
          remarks?: string | null
          settlement_date?: string
          years_of_service?: number
        }
        Relationships: [
          {
            foreignKeyName: "gratuity_settlements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gratuity_settlements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_lists: {
        Row: {
          created_at: string
          description: string | null
          from_date: string
          id: string
          name: string
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          status?: string
          to_date?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "holiday_lists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          description: string | null
          half_day_session: string | null
          holiday_date: string
          holiday_list_id: string
          id: string
          is_half_day: boolean
          is_recurring: boolean
          location: string
          name: string
          org_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          half_day_session?: string | null
          holiday_date: string
          holiday_list_id: string
          id?: string
          is_half_day?: boolean
          is_recurring?: boolean
          location?: string
          name: string
          org_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          half_day_session?: string | null
          holiday_date?: string
          holiday_list_id?: string
          id?: string
          is_half_day?: boolean
          is_recurring?: boolean
          location?: string
          name?: string
          org_id?: string | null
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
          {
            foreignKeyName: "holidays_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_policies: {
        Row: {
          code: string
          created_at: string
          description: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          org_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          org_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_policies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_policy_allocations: {
        Row: {
          allocated_employees: Json
          created_at: string
          effective_from: string | null
          effective_to: string | null
          filter_criteria: Json
          id: string
          org_id: string | null
          policy_code: string | null
          policy_id: string | null
          policy_name: string
          remarks: string | null
          status: string
          updated_at: string
        }
        Insert: {
          allocated_employees?: Json
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          filter_criteria?: Json
          id?: string
          org_id?: string | null
          policy_code?: string | null
          policy_id?: string | null
          policy_name: string
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          allocated_employees?: Json
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          filter_criteria?: Json
          id?: string
          org_id?: string | null
          policy_code?: string | null
          policy_id?: string | null
          policy_name?: string
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_policy_allocations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_policy_allocations_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "leave_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_policy_entitlements: {
        Row: {
          accrual_days_per_cycle: number
          accrual_frequency: string
          accrue_on_probation: boolean
          advance_notice_days: number
          allow_half_day: boolean
          carry_forward_expiry_months: number
          carry_forward_percentage: number
          carry_forward_policy: string
          created_at: string
          days_per_year: number
          encashment_multiplier: number
          encashment_policy: string
          encashment_taxable: boolean
          id: string
          leave_type_code: string | null
          leave_type_color: string | null
          leave_type_id: string | null
          leave_type_name: string | null
          max_carry_forward_days: number
          max_consecutive_days: number
          max_encashment_days_per_year: number
          min_days_per_application: number
          org_id: string | null
          policy_id: string
          sort_order: number
          waiting_period_days: number
        }
        Insert: {
          accrual_days_per_cycle?: number
          accrual_frequency?: string
          accrue_on_probation?: boolean
          advance_notice_days?: number
          allow_half_day?: boolean
          carry_forward_expiry_months?: number
          carry_forward_percentage?: number
          carry_forward_policy?: string
          created_at?: string
          days_per_year?: number
          encashment_multiplier?: number
          encashment_policy?: string
          encashment_taxable?: boolean
          id?: string
          leave_type_code?: string | null
          leave_type_color?: string | null
          leave_type_id?: string | null
          leave_type_name?: string | null
          max_carry_forward_days?: number
          max_consecutive_days?: number
          max_encashment_days_per_year?: number
          min_days_per_application?: number
          org_id?: string | null
          policy_id: string
          sort_order?: number
          waiting_period_days?: number
        }
        Update: {
          accrual_days_per_cycle?: number
          accrual_frequency?: string
          accrue_on_probation?: boolean
          advance_notice_days?: number
          allow_half_day?: boolean
          carry_forward_expiry_months?: number
          carry_forward_percentage?: number
          carry_forward_policy?: string
          created_at?: string
          days_per_year?: number
          encashment_multiplier?: number
          encashment_policy?: string
          encashment_taxable?: boolean
          id?: string
          leave_type_code?: string | null
          leave_type_color?: string | null
          leave_type_id?: string | null
          leave_type_name?: string | null
          max_carry_forward_days?: number
          max_consecutive_days?: number
          max_encashment_days_per_year?: number
          min_days_per_application?: number
          org_id?: string | null
          policy_id?: string
          sort_order?: number
          waiting_period_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_policy_entitlements_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_policy_entitlements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_policy_entitlements_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "leave_policies"
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
          manager_acted_on: string | null
          manager_id: string | null
          manager_remarks: string | null
          manager_status: string
          org_id: string | null
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
          manager_acted_on?: string | null
          manager_id?: string | null
          manager_remarks?: string | null
          manager_status?: string
          org_id?: string | null
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
          manager_acted_on?: string | null
          manager_id?: string | null
          manager_remarks?: string | null
          manager_status?: string
          org_id?: string | null
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
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          allow_negative_balance: boolean
          allow_override: boolean
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
          max_negative_balance: number
          min_balance_after_encashment: number
          min_days_per_application: number
          min_service_months: number
          name: string
          org_id: string | null
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
          allow_negative_balance?: boolean
          allow_override?: boolean
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
          max_negative_balance?: number
          min_balance_after_encashment?: number
          min_days_per_application?: number
          min_service_months?: number
          name: string
          org_id?: string | null
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
          allow_negative_balance?: boolean
          allow_override?: boolean
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
          max_negative_balance?: number
          min_balance_after_encashment?: number
          min_days_per_application?: number
          min_service_months?: number
          name?: string
          org_id?: string | null
          percentage_carry_forward?: number
          requires_documentation?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_categories: {
        Row: {
          activity: string
          created_at: string
          id: string
          key: string
          label: string
          org_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          activity: string
          created_at?: string
          id?: string
          key: string
          label: string
          org_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          activity?: string
          created_at?: string
          id?: string
          key?: string
          label?: string
          org_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "letter_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_template_models: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          is_builtin: boolean
          language: string
          name: string
          org_id: string | null
          sort_order: number
          subject: string | null
          updated_at: string
          use_letterhead: boolean
        }
        Insert: {
          body?: string
          category: string
          created_at?: string
          id?: string
          is_builtin?: boolean
          language?: string
          name: string
          org_id?: string | null
          sort_order?: number
          subject?: string | null
          updated_at?: string
          use_letterhead?: boolean
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_builtin?: boolean
          language?: string
          name?: string
          org_id?: string | null
          sort_order?: number
          subject?: string | null
          updated_at?: string
          use_letterhead?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "letter_template_models_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      letter_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          language: string
          name: string
          org_id: string | null
          subject: string | null
          updated_at: string
          use_letterhead: boolean
        }
        Insert: {
          body?: string
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          language?: string
          name: string
          org_id?: string | null
          subject?: string | null
          updated_at?: string
          use_letterhead?: boolean
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          language?: string
          name?: string
          org_id?: string | null
          subject?: string | null
          updated_at?: string
          use_letterhead?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "letter_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
          {
            foreignKeyName: "letterheads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "loan_emi_schedule_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_emi_skip_requests: {
        Row: {
          created_at: string
          emi_month_number: number | null
          employee_id: string | null
          hr_acted_on: string | null
          hr_id: string | null
          hr_remarks: string | null
          hr_status: string
          id: string
          loan_id: string
          manager_acted_on: string | null
          manager_id: string | null
          manager_remarks: string | null
          manager_status: string
          org_id: string | null
          payroll_period_id: string | null
          reason: string
          requested_on: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          emi_month_number?: number | null
          employee_id?: string | null
          hr_acted_on?: string | null
          hr_id?: string | null
          hr_remarks?: string | null
          hr_status?: string
          id?: string
          loan_id: string
          manager_acted_on?: string | null
          manager_id?: string | null
          manager_remarks?: string | null
          manager_status?: string
          org_id?: string | null
          payroll_period_id?: string | null
          reason: string
          requested_on?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          emi_month_number?: number | null
          employee_id?: string | null
          hr_acted_on?: string | null
          hr_id?: string | null
          hr_remarks?: string | null
          hr_status?: string
          id?: string
          loan_id?: string
          manager_acted_on?: string | null
          manager_id?: string | null
          manager_remarks?: string | null
          manager_status?: string
          org_id?: string | null
          payroll_period_id?: string | null
          reason?: string
          requested_on?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_emi_skip_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_emi_skip_requests_hr_id_fkey"
            columns: ["hr_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_emi_skip_requests_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_emi_skip_requests_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_emi_skip_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_emi_skip_requests_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_types: {
        Row: {
          approval_workflow: string
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
          org_id: string | null
          updated_at: string
        }
        Insert: {
          approval_workflow?: string
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
          org_id?: string | null
          updated_at?: string
        }
        Update: {
          approval_workflow?: string
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
          org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          applied_date: string
          approved_by: string | null
          approved_on: string | null
          auto_approved: boolean
          created_at: string
          disbursed_date: string | null
          emi_amount: number
          employee_id: string
          hr_acted_on: string | null
          hr_id: string | null
          hr_remarks: string | null
          hr_status: string
          id: string
          interest_rate: number
          loan_type_id: string
          manager_acted_on: string | null
          manager_id: string | null
          manager_remarks: string | null
          manager_status: string
          org_id: string | null
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
          auto_approved?: boolean
          created_at?: string
          disbursed_date?: string | null
          emi_amount?: number
          employee_id: string
          hr_acted_on?: string | null
          hr_id?: string | null
          hr_remarks?: string | null
          hr_status?: string
          id?: string
          interest_rate?: number
          loan_type_id: string
          manager_acted_on?: string | null
          manager_id?: string | null
          manager_remarks?: string | null
          manager_status?: string
          org_id?: string | null
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
          auto_approved?: boolean
          created_at?: string
          disbursed_date?: string | null
          emi_amount?: number
          employee_id?: string
          hr_acted_on?: string | null
          hr_id?: string | null
          hr_remarks?: string | null
          hr_status?: string
          id?: string
          interest_rate?: number
          loan_type_id?: string
          manager_acted_on?: string | null
          manager_id?: string | null
          manager_remarks?: string | null
          manager_status?: string
          org_id?: string | null
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
            foreignKeyName: "loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_hr_id_fkey"
            columns: ["hr_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_loan_type_id_fkey"
            columns: ["loan_type_id"]
            isOneToOne: false
            referencedRelation: "loan_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
          {
            foreignKeyName: "location_bank_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
          {
            foreignKeyName: "location_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lookup_values: {
        Row: {
          category: string
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          label: string
          metadata: Json | null
          org_id: string | null
          sort_order: number
        }
        Insert: {
          category: string
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          metadata?: Json | null
          org_id?: string | null
          sort_order?: number
        }
        Update: {
          category?: string
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          metadata?: Json | null
          org_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lookup_values_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id?: string | null
          role: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          plan: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          plan?: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          plan?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_heads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_arrears: {
        Row: {
          arrears_amount: number
          breakdown: Json | null
          computed_at: string
          created_at: string
          employee_id: string
          id: string
          org_id: string | null
          payroll_period_id: string
          payroll_run_id: string | null
          previous_net: number
          revised_net: number
        }
        Insert: {
          arrears_amount?: number
          breakdown?: Json | null
          computed_at?: string
          created_at?: string
          employee_id: string
          id?: string
          org_id?: string | null
          payroll_period_id: string
          payroll_run_id?: string | null
          previous_net?: number
          revised_net?: number
        }
        Update: {
          arrears_amount?: number
          breakdown?: Json | null
          computed_at?: string
          created_at?: string
          employee_id?: string
          id?: string
          org_id?: string | null
          payroll_period_id?: string
          payroll_run_id?: string | null
          previous_net?: number
          revised_net?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_arrears_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_arrears_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_arrears_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_arrears_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_entries: {
        Row: {
          absent_days: number
          advance_recovery: number
          arrears: number
          basic_salary: number
          conveyance_allowance: number
          created_at: string
          deduction_breakdown: Json | null
          employee_acknowledged: boolean
          employee_acknowledged_at: string | null
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
          org_id: string | null
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
          arrears?: number
          basic_salary?: number
          conveyance_allowance?: number
          created_at?: string
          deduction_breakdown?: Json | null
          employee_acknowledged?: boolean
          employee_acknowledged_at?: string | null
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
          org_id?: string | null
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
          arrears?: number
          basic_salary?: number
          conveyance_allowance?: number
          created_at?: string
          deduction_breakdown?: Json | null
          employee_acknowledged?: boolean
          employee_acknowledged_at?: string | null
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
          org_id?: string | null
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
            foreignKeyName: "payroll_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            foreignKeyName: "payroll_entries_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
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
          {
            foreignKeyName: "payroll_periods_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_precheck_stages: {
        Row: {
          closed_at: string | null
          created_at: string
          id: string
          notes: string | null
          org_id: string | null
          payroll_period_id: string
          stage: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string | null
          payroll_period_id: string
          stage: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string | null
          payroll_period_id?: string
          stage?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_precheck_stages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_precheck_stages_payroll_period_id_fkey"
            columns: ["payroll_period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
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
          org_id: string | null
          paid_at: string | null
          payment_mode: string | null
          payment_reference: string | null
          payment_status: string
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
          org_id?: string | null
          paid_at?: string | null
          payment_mode?: string | null
          payment_reference?: string | null
          payment_status?: string
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
          org_id?: string | null
          paid_at?: string | null
          payment_mode?: string | null
          payment_reference?: string | null
          payment_status?: string
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
            foreignKeyName: "payroll_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          bonus_eligibility_limit: number
          bonus_enabled: boolean
          bonus_max_percentage: number
          bonus_min_percentage: number
          bonus_percentage: number
          bonus_wage_ceiling: number
          bonus_wage_components: Json
          esi_employee_rate: number
          esi_employer_rate: number
          esi_enabled: boolean
          esi_wage_ceiling: number
          esi_wage_components: Json
          gratuity_accrual_enabled: boolean
          gratuity_enabled: boolean
          gratuity_formula: string
          gratuity_min_years: number
          id: string
          nps_employee_rate: number
          nps_employer_rate: number
          nps_enabled: boolean
          org_id: string | null
          pf_admin_charges: number
          pf_apply_on: string
          pf_edli_charges: number
          pf_employee_rate: number
          pf_employer_rate: number
          pf_enabled: boolean
          pf_wage_ceiling: number
          pf_wage_components: Json
          professional_tax_enabled: boolean
          updated_at: string
          vpf_enabled: boolean
          vpf_max_percentage: number
        }
        Insert: {
          bonus_eligibility_limit?: number
          bonus_enabled?: boolean
          bonus_max_percentage?: number
          bonus_min_percentage?: number
          bonus_percentage?: number
          bonus_wage_ceiling?: number
          bonus_wage_components?: Json
          esi_employee_rate?: number
          esi_employer_rate?: number
          esi_enabled?: boolean
          esi_wage_ceiling?: number
          esi_wage_components?: Json
          gratuity_accrual_enabled?: boolean
          gratuity_enabled?: boolean
          gratuity_formula?: string
          gratuity_min_years?: number
          id?: string
          nps_employee_rate?: number
          nps_employer_rate?: number
          nps_enabled?: boolean
          org_id?: string | null
          pf_admin_charges?: number
          pf_apply_on?: string
          pf_edli_charges?: number
          pf_employee_rate?: number
          pf_employer_rate?: number
          pf_enabled?: boolean
          pf_wage_ceiling?: number
          pf_wage_components?: Json
          professional_tax_enabled?: boolean
          updated_at?: string
          vpf_enabled?: boolean
          vpf_max_percentage?: number
        }
        Update: {
          bonus_eligibility_limit?: number
          bonus_enabled?: boolean
          bonus_max_percentage?: number
          bonus_min_percentage?: number
          bonus_percentage?: number
          bonus_wage_ceiling?: number
          bonus_wage_components?: Json
          esi_employee_rate?: number
          esi_employer_rate?: number
          esi_enabled?: boolean
          esi_wage_ceiling?: number
          esi_wage_components?: Json
          gratuity_accrual_enabled?: boolean
          gratuity_enabled?: boolean
          gratuity_formula?: string
          gratuity_min_years?: number
          id?: string
          nps_employee_rate?: number
          nps_employer_rate?: number
          nps_enabled?: boolean
          org_id?: string | null
          pf_admin_charges?: number
          pf_apply_on?: string
          pf_edli_charges?: number
          pf_employee_rate?: number
          pf_employer_rate?: number
          pf_enabled?: boolean
          pf_wage_ceiling?: number
          pf_wage_components?: Json
          professional_tax_enabled?: boolean
          updated_at?: string
          vpf_enabled?: boolean
          vpf_max_percentage?: number
        }
        Relationships: [
          {
            foreignKeyName: "pf_esi_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          created_at: string
          id: string
          org_id: string | null
          poll_id: string
          sort_order: number
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id?: string | null
          poll_id: string
          sort_order?: number
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string | null
          poll_id?: string
          sort_order?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          option_id: string | null
          org_id: string | null
          poll_id: string
          rating: number | null
          text_response: string | null
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          option_id?: string | null
          org_id?: string | null
          poll_id: string
          rating?: number | null
          text_response?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          option_id?: string | null
          org_id?: string | null
          poll_id?: string
          rating?: number | null
          text_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          end_time: string | null
          id: string
          is_anonymous: boolean
          org_id: string | null
          start_date: string | null
          status: string
          title: string
          total_recipients: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          is_anonymous?: boolean
          org_id?: string | null
          start_date?: string | null
          status?: string
          title: string
          total_recipients?: number
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          is_anonymous?: boolean
          org_id?: string | null
          start_date?: string | null
          status?: string
          title?: string
          total_recipients?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_tax_slabs: {
        Row: {
          created_at: string
          from_amount: number
          gender: string
          id: string
          is_active: boolean
          monthly_amount: number
          org_id: string | null
          special_note: string | null
          state: string
          to_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_amount?: number
          gender?: string
          id?: string
          is_active?: boolean
          monthly_amount?: number
          org_id?: string | null
          special_note?: string | null
          state: string
          to_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_amount?: number
          gender?: string
          id?: string
          is_active?: boolean
          monthly_amount?: number
          org_id?: string | null
          special_note?: string | null
          state?: string
          to_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_tax_slabs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursement_claims: {
        Row: {
          amount: number
          bill_reference: string | null
          category: string
          created_at: string
          description: string | null
          employee_id: string
          has_bill: boolean
          id: string
          manager_acted_on: string | null
          manager_id: string | null
          manager_remarks: string | null
          manager_status: string
          org_id: string | null
          payroll_period_id: string | null
          raised_by: string
          reference_no: string | null
          rejection_reason: string | null
          remarks: string | null
          salary_component_id: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount?: number
          bill_reference?: string | null
          category?: string
          created_at?: string
          description?: string | null
          employee_id: string
          has_bill?: boolean
          id?: string
          manager_acted_on?: string | null
          manager_id?: string | null
          manager_remarks?: string | null
          manager_status?: string
          org_id?: string | null
          payroll_period_id?: string | null
          raised_by?: string
          reference_no?: string | null
          rejection_reason?: string | null
          remarks?: string | null
          salary_component_id?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          bill_reference?: string | null
          category?: string
          created_at?: string
          description?: string | null
          employee_id?: string
          has_bill?: boolean
          id?: string
          manager_acted_on?: string | null
          manager_id?: string | null
          manager_remarks?: string | null
          manager_status?: string
          org_id?: string | null
          payroll_period_id?: string | null
          raised_by?: string
          reference_no?: string | null
          rejection_reason?: string | null
          remarks?: string | null
          salary_component_id?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reimbursement_claims_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_components: {
        Row: {
          bonus_type: string
          calculation_basis: string
          code: string
          created_at: string
          deduction_source: string | null
          description: string | null
          esi_applicability: string
          formula: string | null
          id: string
          is_active: boolean
          is_arrears: boolean
          is_income_tax: boolean
          is_overtime: boolean
          is_reimbursement: boolean
          is_system_defined: boolean
          name: string
          org_id: string | null
          overtime_hours_per_month: number
          overtime_multiplier: number
          pf_applicability: string
          round_off: string
          statutory_type: string
          taxability: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          bonus_type?: string
          calculation_basis?: string
          code: string
          created_at?: string
          deduction_source?: string | null
          description?: string | null
          esi_applicability?: string
          formula?: string | null
          id?: string
          is_active?: boolean
          is_arrears?: boolean
          is_income_tax?: boolean
          is_overtime?: boolean
          is_reimbursement?: boolean
          is_system_defined?: boolean
          name: string
          org_id?: string | null
          overtime_hours_per_month?: number
          overtime_multiplier?: number
          pf_applicability?: string
          round_off?: string
          statutory_type?: string
          taxability?: string
          type: string
          updated_at?: string
          value?: number
        }
        Update: {
          bonus_type?: string
          calculation_basis?: string
          code?: string
          created_at?: string
          deduction_source?: string | null
          description?: string | null
          esi_applicability?: string
          formula?: string | null
          id?: string
          is_active?: boolean
          is_arrears?: boolean
          is_income_tax?: boolean
          is_overtime?: boolean
          is_reimbursement?: boolean
          is_system_defined?: boolean
          name?: string
          org_id?: string | null
          overtime_hours_per_month?: number
          overtime_multiplier?: number
          pf_applicability?: string
          round_off?: string
          statutory_type?: string
          taxability?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_components_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_revision_arrears: {
        Row: {
          arrears_amount: number
          created_at: string
          employee_id: string
          id: string
          org_id: string | null
          paid_gross: number
          paid_run_id: string | null
          period_id: string | null
          period_name: string | null
          revised_gross: number
          revision_id: string
          status: string
          target_period_id: string | null
        }
        Insert: {
          arrears_amount?: number
          created_at?: string
          employee_id: string
          id?: string
          org_id?: string | null
          paid_gross?: number
          paid_run_id?: string | null
          period_id?: string | null
          period_name?: string | null
          revised_gross?: number
          revision_id: string
          status?: string
          target_period_id?: string | null
        }
        Update: {
          arrears_amount?: number
          created_at?: string
          employee_id?: string
          id?: string
          org_id?: string | null
          paid_gross?: number
          paid_run_id?: string | null
          period_id?: string | null
          period_name?: string | null
          revised_gross?: number
          revision_id?: string
          status?: string
          target_period_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_revision_arrears_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_revision_items: {
        Row: {
          applied_at: string | null
          created_at: string
          employee_id: string
          id: string
          new_component_values: Json | null
          new_ctc_monthly: number
          new_gross: number
          new_net: number
          new_takehome: number
          old_ctc_monthly: number
          old_gross: number
          old_net: number
          old_takehome: number
          org_id: string | null
          revision_id: string
          status: string
          structure_id: string | null
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          new_component_values?: Json | null
          new_ctc_monthly?: number
          new_gross?: number
          new_net?: number
          new_takehome?: number
          old_ctc_monthly?: number
          old_gross?: number
          old_net?: number
          old_takehome?: number
          org_id?: string | null
          revision_id: string
          status?: string
          structure_id?: string | null
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          new_component_values?: Json | null
          new_ctc_monthly?: number
          new_gross?: number
          new_net?: number
          new_takehome?: number
          old_ctc_monthly?: number
          old_gross?: number
          old_net?: number
          old_takehome?: number
          org_id?: string | null
          revision_id?: string
          status?: string
          structure_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_revision_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_revisions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          basis: string
          created_at: string
          effective_from: string | null
          id: string
          method: string
          org_id: string | null
          payroll_period_id: string | null
          proposed_by: string | null
          remarks: string | null
          scope: string
          scope_ref: Json | null
          status: string
          title: string
          updated_at: string
          value: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          basis?: string
          created_at?: string
          effective_from?: string | null
          id?: string
          method?: string
          org_id?: string | null
          payroll_period_id?: string | null
          proposed_by?: string | null
          remarks?: string | null
          scope?: string
          scope_ref?: Json | null
          status?: string
          title?: string
          updated_at?: string
          value?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          basis?: string
          created_at?: string
          effective_from?: string | null
          id?: string
          method?: string
          org_id?: string | null
          payroll_period_id?: string | null
          proposed_by?: string | null
          remarks?: string | null
          scope?: string
          scope_ref?: Json | null
          status?: string
          title?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_revisions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_structure_components: {
        Row: {
          calculation_basis: string | null
          created_at: string
          custom_values: number[]
          formula: string | null
          id: string
          org_id: string | null
          salary_component_id: string
          salary_structure_id: string
          selected_custom_value: number
          sort_order: number
          value: number
          value_type: string
        }
        Insert: {
          calculation_basis?: string | null
          created_at?: string
          custom_values?: number[]
          formula?: string | null
          id?: string
          org_id?: string | null
          salary_component_id: string
          salary_structure_id: string
          selected_custom_value?: number
          sort_order?: number
          value?: number
          value_type?: string
        }
        Update: {
          calculation_basis?: string | null
          created_at?: string
          custom_values?: number[]
          formula?: string | null
          id?: string
          org_id?: string | null
          salary_component_id?: string
          salary_structure_id?: string
          selected_custom_value?: number
          sort_order?: number
          value?: number
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_structure_components_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_structures_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          applicable_days: number[]
          break_duration_minutes: number
          break_end_time: string | null
          break_start_time: string | null
          breaks: Json
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
          org_id: string | null
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
          breaks?: Json
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
          org_id?: string | null
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
          breaks?: Json
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
          org_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          login_id: string | null
          must_change_password: boolean
          name: string
          org_id: string | null
          password: string | null
          password_changed_at: string | null
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
          login_id?: string | null
          must_change_password?: boolean
          name: string
          org_id?: string | null
          password?: string | null
          password_changed_at?: string | null
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
          login_id?: string | null
          must_change_password?: boolean
          name?: string
          org_id?: string | null
          password?: string | null
          password_changed_at?: string | null
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
            foreignKeyName: "system_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          regime?: string
          surcharge_rate?: number
          tax_rate?: number
          to_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "tds_slabs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_preferences: {
        Row: {
          hidden_widgets: string[]
          org_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          hidden_widgets?: string[]
          org_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          hidden_widgets?: string[]
          org_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_dashboard_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          system_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_privileges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          org_id: string | null
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
          org_id?: string | null
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
          org_id?: string | null
          pan_no?: string | null
          phone?: string | null
          pt_no?: string | null
          state?: string | null
          status?: string
          tan_no?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_user_org_ids: { Args: never; Returns: string[] }
      is_org_admin: { Args: { p_org: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

