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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      absence_records: {
        Row: {
          absence_type: string
          created_at: string | null
          end_date: string
          fit_note_file_name: string | null
          fit_note_path: string | null
          id: string
          is_long_term: boolean | null
          leave_request_id: string | null
          profile_id: string
          reason: string | null
          recorded_by: string | null
          sickness_category: string | null
          start_date: string
          total_days: number
          updated_at: string | null
        }
        Insert: {
          absence_type: string
          created_at?: string | null
          end_date: string
          fit_note_file_name?: string | null
          fit_note_path?: string | null
          id?: string
          is_long_term?: boolean | null
          leave_request_id?: string | null
          profile_id: string
          reason?: string | null
          recorded_by?: string | null
          sickness_category?: string | null
          start_date: string
          total_days: number
          updated_at?: string | null
        }
        Update: {
          absence_type?: string
          created_at?: string | null
          end_date?: string
          fit_note_file_name?: string | null
          fit_note_path?: string | null
          id?: string
          is_long_term?: boolean | null
          leave_request_id?: string | null
          profile_id?: string
          reason?: string | null
          recorded_by?: string | null
          sickness_category?: string | null
          start_date?: string
          total_days?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absence_records_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_records_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_assignments: {
        Row: {
          asset_id: string
          assigned_by: string | null
          assigned_date: string
          condition_on_assignment: string | null
          condition_on_return: string | null
          created_at: string | null
          id: string
          notes: string | null
          profile_id: string
          returned_date: string | null
          updated_at: string | null
        }
        Insert: {
          asset_id: string
          assigned_by?: string | null
          assigned_date?: string
          condition_on_assignment?: string | null
          condition_on_return?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          profile_id: string
          returned_date?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_id?: string
          assigned_by?: string | null
          assigned_date?: string
          condition_on_assignment?: string | null
          condition_on_return?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          profile_id?: string
          returned_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_tag: string
          asset_type_id: string
          created_at: string | null
          id: string
          make: string | null
          model: string | null
          notes: string | null
          purchase_cost: number | null
          purchase_date: string | null
          serial_number: string | null
          status: string
          updated_at: string | null
          warranty_expiry_date: string | null
        }
        Insert: {
          asset_tag: string
          asset_type_id: string
          created_at?: string | null
          id?: string
          make?: string | null
          model?: string | null
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string | null
          warranty_expiry_date?: string | null
        }
        Update: {
          asset_tag?: string
          asset_type_id?: string
          created_at?: string | null
          id?: string
          make?: string | null
          model?: string | null
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string | null
          warranty_expiry_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: "INSERT" | "UPDATE" | "DELETE"
          changed_by: string | null
          changed_fields: string[] | null
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: "INSERT" | "UPDATE" | "DELETE"
          changed_by?: string | null
          changed_fields?: string[] | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: "INSERT" | "UPDATE" | "DELETE"
          changed_by?: string | null
          changed_fields?: string[] | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_number: string
          course_id: string
          created_at: string
          id: string
          issued_at: string
          pdf_url: string | null
          user_id: string
        }
        Insert: {
          certificate_number: string
          course_id: string
          created_at?: string
          id?: string
          issued_at?: string
          pdf_url?: string | null
          user_id: string
        }
        Update: {
          certificate_number?: string
          course_id?: string
          created_at?: string
          id?: string
          issued_at?: string
          pdf_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_mentions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          mentioned_user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          mentioned_user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          mentioned_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reaction_type: "like" | "love" | "celebrate" | "insightful" | "curious"
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reaction_type: "like" | "love" | "celebrate" | "insightful" | "curious"
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reaction_type?: "like" | "love" | "celebrate" | "insightful" | "curious"
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_document_types: {
        Row: {
          alert_days_before_expiry: number[] | null
          applies_to: string[] | null
          created_at: string | null
          default_validity_months: number | null
          description: string | null
          id: string
          is_active: boolean | null
          is_mandatory: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          alert_days_before_expiry?: number[] | null
          applies_to?: string[] | null
          created_at?: string | null
          default_validity_months?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          alert_days_before_expiry?: number[] | null
          applies_to?: string[] | null
          created_at?: string | null
          default_validity_months?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_mandatory?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      compliance_documents: {
        Row: {
          created_at: string | null
          document_type_id: string
          expiry_date: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          issue_date: string | null
          mime_type: string | null
          notes: string | null
          profile_id: string
          reference_number: string | null
          status: "valid" | "expiring_soon" | "expired" | "missing"
          updated_at: string | null
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_type_id: string
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          issue_date?: string | null
          mime_type?: string | null
          notes?: string | null
          profile_id: string
          reference_number?: string | null
          status?: "valid" | "expiring_soon" | "expired" | "missing"
          updated_at?: string | null
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_type_id?: string
          expiry_date?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          issue_date?: string | null
          mime_type?: string | null
          notes?: string | null
          profile_id?: string
          reference_number?: string | null
          status?: "valid" | "expiring_soon" | "expired" | "missing"
          updated_at?: string | null
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "compliance_document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_assignments: {
        Row: {
          assign_type: "team" | "user_type" | "is_external" | "user"
          assign_value: string
          assigned_by: string | null
          course_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          assign_type: "team" | "user_type" | "is_external" | "user"
          assign_value: string
          assigned_by?: string | null
          course_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          assign_type?: "team" | "user_type" | "is_external" | "user"
          assign_value?: string
          assigned_by?: string | null
          course_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrolments: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string | null
          due_date: string | null
          enrolled_at: string | null
          id: string
          progress_percent: number | null
          score: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["enrolment_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string | null
          due_date?: string | null
          enrolled_at?: string | null
          id?: string
          progress_percent?: number | null
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["enrolment_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string | null
          due_date?: string | null
          enrolled_at?: string | null
          id?: string
          progress_percent?: number | null
          score?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["enrolment_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_feedback: {
        Row: {
          clarity_rating: number
          course_id: string
          created_at: string
          duration_feedback: "too_short" | "about_right" | "too_long"
          id: string
          improvement_text: string | null
          overall_rating: number
          relevance_rating: number
          user_id: string
        }
        Insert: {
          clarity_rating: number
          course_id: string
          created_at?: string
          duration_feedback: "too_short" | "about_right" | "too_long"
          id?: string
          improvement_text?: string | null
          overall_rating: number
          relevance_rating: number
          user_id: string
        }
        Update: {
          clarity_rating?: number
          course_id?: string
          created_at?: string
          duration_feedback?: "too_short" | "about_right" | "too_long"
          id?: string
          improvement_text?: string | null
          overall_rating?: number
          relevance_rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_feedback_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          content: string | null
          content_json: Json | null
          course_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          lesson_type: "video" | "text" | "slides" | "rich_text"
          passing_score: number | null
          section_id: string | null
          slides_url: string | null
          sort_order: number
          title: string
          updated_at: string | null
          video_storage_path: string | null
          video_url: string | null
        }
        Insert: {
          content?: string | null
          content_json?: Json | null
          course_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          lesson_type?: "video" | "text" | "slides" | "rich_text"
          passing_score?: number | null
          section_id?: string | null
          slides_url?: string | null
          sort_order?: number
          title: string
          updated_at?: string | null
          video_storage_path?: string | null
          video_url?: string | null
        }
        Update: {
          content?: string | null
          content_json?: Json | null
          course_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          lesson_type?: "video" | "text" | "slides" | "rich_text"
          passing_score?: number | null
          section_id?: string | null
          slides_url?: string | null
          sort_order?: number
          title?: string
          updated_at?: string | null
          video_storage_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_lessons_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sections: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: Database["public"]["Enums"]["course_category"]
          content_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_days_from_start: number | null
          duration_minutes: number | null
          feedback_avg: number | null
          feedback_count: number
          id: string
          is_active: boolean | null
          is_required: boolean | null
          issue_certificate: boolean
          passing_score: number | null
          status: "draft" | "published"
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["course_category"]
          content_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_days_from_start?: number | null
          duration_minutes?: number | null
          feedback_avg?: number | null
          feedback_count?: number
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          issue_certificate?: boolean
          passing_score?: number | null
          status?: "draft" | "published"
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["course_category"]
          content_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_days_from_start?: number | null
          duration_minutes?: number | null
          feedback_avg?: number | null
          feedback_count?: number
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          issue_certificate?: boolean
          passing_score?: number | null
          status?: "draft" | "published"
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dei_responses: {
        Row: {
          age_band: string | null
          created_at: string | null
          disability: boolean | null
          ethnicity: string | null
          id: string
          religion: string | null
          sexual_orientation: string | null
          survey_period: string
        }
        Insert: {
          age_band?: string | null
          created_at?: string | null
          disability?: boolean | null
          ethnicity?: string | null
          id?: string
          religion?: string | null
          sexual_orientation?: string | null
          survey_period: string
        }
        Update: {
          age_band?: string | null
          created_at?: string | null
          disability?: boolean | null
          ethnicity?: string | null
          id?: string
          religion?: string | null
          sexual_orientation?: string | null
          survey_period?: string
        }
        Relationships: []
      }
      cron_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          job_name: string
          result: Json | null
          started_at: string
          status: "running" | "success" | "failed"
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          result?: Json | null
          started_at?: string
          status: "running" | "success" | "failed"
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          result?: Json | null
          started_at?: string
          status?: "running" | "success" | "failed"
        }
        Relationships: []
      }
      departments: {
        Row: {
          colour: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          colour?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          colour?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      drive_folders: {
        Row: {
          created_at: string
          folder_id: string
          folder_url: string
          id: string
          name: string
          registered_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          folder_id: string
          folder_url: string
          id?: string
          name: string
          registered_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          folder_id?: string
          folder_url?: string
          id?: string
          name?: string
          registered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_folders_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notifications: {
        Row: {
          created_at: string
          email_type: string
          id: string
          metadata: Json | null
          sent_at: string | null
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_type: string
          id?: string
          metadata?: Json | null
          sent_at?: string | null
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_type?: string
          id?: string
          metadata?: Json | null
          sent_at?: string | null
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          phone_primary: string
          phone_secondary: string | null
          profile_id: string
          relationship: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone_primary: string
          phone_secondary?: string | null
          profile_id: string
          relationship: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone_primary?: string
          phone_secondary?: string | null
          profile_id?: string
          relationship?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_details: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country: string | null
          created_at: string | null
          date_of_birth: string | null
          gender: string | null
          id: string
          nationality: string | null
          ni_number: string | null
          personal_email: string | null
          personal_phone: string | null
          postcode: string | null
          profile_id: string
          pronouns: string | null
          updated_at: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          gender?: string | null
          id?: string
          nationality?: string | null
          ni_number?: string | null
          personal_email?: string | null
          personal_phone?: string | null
          postcode?: string | null
          profile_id: string
          pronouns?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          gender?: string | null
          id?: string
          nationality?: string | null
          ni_number?: string | null
          personal_email?: string | null
          personal_phone?: string | null
          postcode?: string | null
          profile_id?: string
          pronouns?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_history: {
        Row: {
          created_at: string | null
          effective_date: string
          event_type: string
          id: string
          new_value: string | null
          notes: string | null
          previous_value: string | null
          profile_id: string
          recorded_by: string | null
        }
        Insert: {
          created_at?: string | null
          effective_date: string
          event_type: string
          id?: string
          new_value?: string | null
          notes?: string | null
          previous_value?: string | null
          profile_id: string
          recorded_by?: string | null
        }
        Update: {
          created_at?: string | null
          effective_date?: string
          event_type?: string
          id?: string
          new_value?: string | null
          notes?: string | null
          previous_value?: string | null
          profile_id?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employment_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_history_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_courses: {
        Row: {
          category: string | null
          certificate_url: string | null
          completed_at: string
          created_at: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          provider: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          certificate_url?: string | null
          completed_at: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          provider?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          certificate_url?: string | null
          completed_at?: string
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          provider?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_courses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flexible_working_requests: {
        Row: {
          consultation_alternatives: string | null
          consultation_attendees: string | null
          consultation_date: string | null
          consultation_format:
            | "in_person"
            | "video"
            | "phone"
            | null
          consultation_summary: string | null
          created_at: string | null
          current_working_pattern: string
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          id: string
          manager_id: string | null
          previous_work_pattern: string | null
          profile_id: string
          proposed_start_date: string
          reason: string | null
          rejection_explanation: string | null
          rejection_grounds: string[] | null
          request_type:
            | "flexible_hours"
            | "compressed_hours"
            | "reduced_hours"
            | "job_sharing"
            | "remote_hybrid"
            | "annualised_hours"
            | "staggered_hours"
            | "term_time"
            | "other"
          requested_working_pattern: string
          response_deadline: string
          status:
            | "submitted"
            | "under_review"
            | "approved"
            | "approved_trial"
            | "rejected"
            | "withdrawn"
            | "appealed"
            | "appeal_upheld"
            | "appeal_overturned"
          trial_end_date: string | null
          trial_outcome: "confirmed" | "extended" | "reverted" | null
          trial_outcome_at: string | null
          trial_outcome_by: string | null
          updated_at: string | null
        }
        Insert: {
          consultation_alternatives?: string | null
          consultation_attendees?: string | null
          consultation_date?: string | null
          consultation_format?:
            | "in_person"
            | "video"
            | "phone"
            | null
          consultation_summary?: string | null
          created_at?: string | null
          current_working_pattern: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          id?: string
          manager_id?: string | null
          previous_work_pattern?: string | null
          profile_id: string
          proposed_start_date: string
          reason?: string | null
          rejection_explanation?: string | null
          rejection_grounds?: string[] | null
          request_type:
            | "flexible_hours"
            | "compressed_hours"
            | "reduced_hours"
            | "job_sharing"
            | "remote_hybrid"
            | "annualised_hours"
            | "staggered_hours"
            | "term_time"
            | "other"
          requested_working_pattern: string
          response_deadline: string
          status?:
            | "submitted"
            | "under_review"
            | "approved"
            | "approved_trial"
            | "rejected"
            | "withdrawn"
            | "appealed"
            | "appeal_upheld"
            | "appeal_overturned"
          trial_end_date?: string | null
          trial_outcome?: "confirmed" | "extended" | "reverted" | null
          trial_outcome_at?: string | null
          trial_outcome_by?: string | null
          updated_at?: string | null
        }
        Update: {
          consultation_alternatives?: string | null
          consultation_attendees?: string | null
          consultation_date?: string | null
          consultation_format?:
            | "in_person"
            | "video"
            | "phone"
            | null
          consultation_summary?: string | null
          created_at?: string | null
          current_working_pattern?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          id?: string
          manager_id?: string | null
          previous_work_pattern?: string | null
          profile_id?: string
          proposed_start_date?: string
          reason?: string | null
          rejection_explanation?: string | null
          rejection_grounds?: string[] | null
          request_type?:
            | "flexible_hours"
            | "compressed_hours"
            | "reduced_hours"
            | "job_sharing"
            | "remote_hybrid"
            | "annualised_hours"
            | "staggered_hours"
            | "term_time"
            | "other"
          requested_working_pattern?: string
          response_deadline?: string
          status?:
            | "submitted"
            | "under_review"
            | "approved"
            | "approved_trial"
            | "rejected"
            | "withdrawn"
            | "appealed"
            | "appeal_upheld"
            | "appeal_overturned"
          trial_end_date?: string | null
          trial_outcome?: "confirmed" | "extended" | "reverted" | null
          trial_outcome_at?: string | null
          trial_outcome_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flexible_working_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flexible_working_requests_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flexible_working_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flexible_working_requests_trial_outcome_by_fkey"
            columns: ["trial_outcome_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fwr_appeals: {
        Row: {
          appeal_reason: string
          appealed_at: string | null
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          id: string
          meeting_date: string | null
          meeting_notes: string | null
          outcome: "upheld" | "overturned" | null
          outcome_notes: string | null
          request_id: string
          updated_at: string | null
        }
        Insert: {
          appeal_reason: string
          appealed_at?: string | null
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          meeting_date?: string | null
          meeting_notes?: string | null
          outcome?: "upheld" | "overturned" | null
          outcome_notes?: string | null
          request_id: string
          updated_at?: string | null
        }
        Update: {
          appeal_reason?: string
          appealed_at?: string | null
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          meeting_date?: string | null
          meeting_notes?: string | null
          outcome?: "upheld" | "overturned" | null
          outcome_notes?: string | null
          request_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fwr_appeals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "flexible_working_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fwr_appeals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      induction_progress: {
        Row: {
          completed_at: string | null
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "induction_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      key_dates: {
        Row: {
          alert_days_before: number[] | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          date_type: string
          description: string | null
          due_date: string
          id: string
          is_completed: boolean | null
          profile_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          alert_days_before?: number[] | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          date_type: string
          description?: string | null
          due_date: string
          id?: string
          is_completed?: boolean | null
          profile_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          alert_days_before?: number[] | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          date_type?: string
          description?: string | null
          due_date?: string
          id?: string
          is_completed?: boolean | null
          profile_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_dates_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_dates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_entitlements: {
        Row: {
          adjustments_days: number | null
          base_entitlement_days: number
          created_at: string | null
          fte_at_calculation: number
          id: string
          leave_type: string
          leave_year_end: string
          leave_year_start: string
          notes: string | null
          profile_id: string
          updated_at: string | null
        }
        Insert: {
          adjustments_days?: number | null
          base_entitlement_days: number
          created_at?: string | null
          fte_at_calculation: number
          id?: string
          leave_type: string
          leave_year_end: string
          leave_year_start: string
          notes?: string | null
          profile_id: string
          updated_at?: string | null
        }
        Update: {
          adjustments_days?: number | null
          base_entitlement_days?: number
          created_at?: string | null
          fte_at_calculation?: number
          id?: string
          leave_type?: string
          leave_year_end?: string
          leave_year_start?: string
          notes?: string | null
          profile_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_entitlements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          decision_notes: string | null
          end_date: string
          end_half_day: boolean | null
          id: string
          leave_type: "annual" | "sick" | "compassionate" | "parental" | "unpaid" | "toil" | "other"
          ooo_calendar_event_id: string | null
          profile_id: string
          reason: string | null
          rejection_reason: string | null
          start_date: string
          start_half_day: boolean | null
          status: "pending" | "approved" | "rejected" | "cancelled"
          total_days: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          end_date: string
          end_half_day?: boolean | null
          id?: string
          leave_type: "annual" | "sick" | "compassionate" | "parental" | "unpaid" | "toil" | "other"
          ooo_calendar_event_id?: string | null
          profile_id: string
          reason?: string | null
          rejection_reason?: string | null
          start_date: string
          start_half_day?: boolean | null
          status?: "pending" | "approved" | "rejected" | "cancelled"
          total_days: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_notes?: string | null
          end_date?: string
          end_half_day?: boolean | null
          id?: string
          leave_type?: "annual" | "sick" | "compassionate" | "parental" | "unpaid" | "toil" | "other"
          ooo_calendar_event_id?: string | null
          profile_id?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date?: string
          start_half_day?: boolean | null
          status?: "pending" | "approved" | "rejected" | "cancelled"
          total_days?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_completions: {
        Row: {
          completed_at: string | null
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_images: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_url: string
          id: string
          lesson_id: string
          mime_type: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_url: string
          id?: string
          lesson_id: string
          mime_type: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          lesson_id?: string
          mime_type?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_images_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_teams: {
        Row: {
          created_at: string | null
          id: string
          manager_id: string
          team_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          manager_id: string
          team_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          manager_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      news_feed_media: {
        Row: {
          id: string
          file_id: string
          original_name: string
          mime_type: string
          file_size: number
          image_width: number | null
          image_height: number | null
          page_count: number | null
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          file_id: string
          original_name: string
          mime_type: string
          file_size: number
          image_width?: number | null
          image_height?: number | null
          page_count?: number | null
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          file_id?: string
          original_name?: string
          mime_type?: string
          file_size?: number
          image_width?: number | null
          image_height?: number | null
          page_count?: number | null
          uploaded_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_feed_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          category: "personal" | "team" | "organisational" | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          id: string
          profile_id: string
          review_period_end: string | null
          review_period_start: string | null
          status: string
          target_date: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: "personal" | "team" | "organisational" | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          profile_id: string
          review_period_end?: string | null
          review_period_start?: string | null
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: "personal" | "team" | "organisational" | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          profile_id?: string
          review_period_end?: string | null
          review_period_start?: string | null
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objectives_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklist_items: {
        Row: {
          assignee_id: string | null
          assignee_role: "hr_admin" | "line_manager" | "employee" | "other"
          checklist_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean
          section: "before_start" | "day_one" | "first_week" | "first_month" | "general"
          sort_order: number
          title: string
        }
        Insert: {
          assignee_id?: string | null
          assignee_role?: "hr_admin" | "line_manager" | "employee" | "other"
          checklist_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          section?: "before_start" | "day_one" | "first_week" | "first_month" | "general"
          sort_order?: number
          title: string
        }
        Update: {
          assignee_id?: string | null
          assignee_role?: "hr_admin" | "line_manager" | "employee" | "other"
          checklist_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean
          section?: "before_start" | "day_one" | "first_week" | "first_month" | "general"
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklist_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "onboarding_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklist_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklists: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          initiated_by: string
          notes: string | null
          profile_id: string
          start_date: string
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          initiated_by: string
          notes?: string | null
          profile_id: string
          start_date: string
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          initiated_by?: string
          notes?: string | null
          profile_id?: string
          start_date?: string
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklists_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklists_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklists_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklists_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_template_items: {
        Row: {
          assignee_role: "hr_admin" | "line_manager" | "employee" | "other"
          created_at: string
          description: string | null
          due_day_offset: number
          id: string
          section: "before_start" | "day_one" | "first_week" | "first_month" | "general"
          sort_order: number
          template_id: string
          title: string
        }
        Insert: {
          assignee_role?: "hr_admin" | "line_manager" | "employee" | "other"
          created_at?: string
          description?: string | null
          due_day_offset?: number
          id?: string
          section?: "before_start" | "day_one" | "first_week" | "first_month" | "general"
          sort_order?: number
          template_id: string
          title: string
        }
        Update: {
          assignee_role?: "hr_admin" | "line_manager" | "employee" | "other"
          created_at?: string
          description?: string | null
          due_day_offset?: number
          id?: string
          section?: "before_start" | "day_one" | "first_week" | "first_month" | "general"
          sort_order?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      one_to_one_records: {
        Row: {
          action_items: Json | null
          created_at: string | null
          employee_id: string
          id: string
          is_private: boolean | null
          manager_id: string
          meeting_date: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          action_items?: Json | null
          created_at?: string | null
          employee_id: string
          id?: string
          is_private?: boolean | null
          manager_id: string
          meeting_date: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          action_items?: Json | null
          created_at?: string | null
          employee_id?: string
          id?: string
          is_private?: boolean | null
          manager_id?: string
          meeting_date?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "one_to_one_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_to_one_records_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          created_at: string
          display_order: number
          id: string
          option_text: string
          post_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          option_text: string
          post_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          option_text?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_attachments: {
        Row: {
          attachment_type: "image" | "document" | "link"
          created_at: string
          drive_file_id: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          image_height: number | null
          image_width: number | null
          link_description: string | null
          link_image_url: string | null
          link_title: string | null
          link_url: string | null
          mime_type: string | null
          page_count: number | null
          post_id: string
          sort_order: number
        }
        Insert: {
          attachment_type: "image" | "document" | "link"
          created_at?: string
          drive_file_id?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          image_height?: number | null
          image_width?: number | null
          link_description?: string | null
          link_image_url?: string | null
          link_title?: string | null
          link_url?: string | null
          mime_type?: string | null
          page_count?: number | null
          post_id: string
          sort_order?: number
        }
        Update: {
          attachment_type?: "image" | "document" | "link"
          created_at?: string
          drive_file_id?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          image_height?: number | null
          image_width?: number | null
          link_description?: string | null
          link_image_url?: string | null
          link_title?: string | null
          link_url?: string | null
          mime_type?: string | null
          page_count?: number | null
          post_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_attachments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          content: string
          content_json: Json | null
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          content_json?: Json | null
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          content_json?: Json | null
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_mentions: {
        Row: {
          created_at: string
          id: string
          mentioned_user_id: string
          post_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentioned_user_id: string
          post_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mentioned_user_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_mentions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: "like" | "love" | "celebrate" | "insightful" | "curious"
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type: "like" | "love" | "celebrate" | "insightful" | "curious"
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: "like" | "love" | "celebrate" | "insightful" | "curious"
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          content: string
          content_json: Json | null
          created_at: string
          id: string
          is_pinned: boolean
          is_weekly_roundup: boolean
          poll_allow_multiple: boolean
          poll_closes_at: string | null
          poll_question: string | null
          updated_at: string
          weekly_roundup_id: string | null
        }
        Insert: {
          author_id: string
          content: string
          content_json?: Json | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_weekly_roundup?: boolean
          poll_allow_multiple?: boolean
          poll_closes_at?: string | null
          poll_question?: string | null
          updated_at?: string
          weekly_roundup_id?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          content_json?: Json | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          is_weekly_roundup?: boolean
          poll_allow_multiple?: boolean
          poll_closes_at?: string | null
          poll_question?: string | null
          updated_at?: string
          weekly_roundup_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_posts_weekly_roundup"
            columns: ["weekly_roundup_id"]
            isOneToOne: false
            referencedRelation: "weekly_roundups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      praise: {
        Row: {
          created_at: string | null
          from_profile_id: string
          id: string
          is_public: boolean | null
          message: string
          to_profile_id: string
          value: string | null
        }
        Insert: {
          created_at?: string | null
          from_profile_id: string
          id?: string
          is_public?: boolean | null
          message: string
          to_profile_id: string
          value?: string | null
        }
        Update: {
          created_at?: string | null
          from_profile_id?: string
          id?: string
          is_public?: boolean | null
          message?: string
          to_profile_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "praise_from_profile_id_fkey"
            columns: ["from_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "praise_to_profile_id_fkey"
            columns: ["to_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          calendar_last_synced_at: string | null
          calendar_sync_token: string | null
          contract_end_date: string | null
          contract_type: "permanent" | "fixed_term" | "casual" | "secondment" | null
          created_at: string | null
          department: string | null
          email: string
          fte: number | null
          full_name: string
          google_calendar_connected: boolean | null
          google_refresh_token: string | null
          id: string
          induction_completed_at: string | null
          is_content_editor: boolean
          is_external: boolean | null
          is_hr_admin: boolean | null
          is_ld_admin: boolean | null
          is_line_manager: boolean | null
          is_systems_admin: boolean
          job_title: string | null
          last_sign_in_at: string | null
          line_manager_id: string | null
          phone: string | null
          preferred_name: string | null
          probation_end_date: string | null
          region: "west" | "east" | "north" | "england" | "central" | "national" | null
          start_date: string | null
          status: "active" | "inactive" | "pending_induction"
          team_id: string | null
          updated_at: string | null
          user_type: "staff" | "new_user"
          work_pattern: string | null
        }
        Insert: {
          avatar_url?: string | null
          calendar_last_synced_at?: string | null
          calendar_sync_token?: string | null
          contract_end_date?: string | null
          contract_type?: "permanent" | "fixed_term" | "casual" | "secondment" | null
          created_at?: string | null
          department?: string | null
          email: string
          fte?: number | null
          full_name: string
          google_calendar_connected?: boolean | null
          google_refresh_token?: string | null
          id: string
          induction_completed_at?: string | null
          is_content_editor?: boolean
          is_external?: boolean | null
          is_hr_admin?: boolean | null
          is_ld_admin?: boolean | null
          is_line_manager?: boolean | null
          is_systems_admin?: boolean
          job_title?: string | null
          last_sign_in_at?: string | null
          line_manager_id?: string | null
          phone?: string | null
          preferred_name?: string | null
          probation_end_date?: string | null
          region?: "west" | "east" | "north" | "england" | "central" | "national" | null
          start_date?: string | null
          status?: "active" | "inactive" | "pending_induction"
          team_id?: string | null
          updated_at?: string | null
          user_type?: "staff" | "new_user"
          work_pattern?: string | null
        }
        Update: {
          avatar_url?: string | null
          calendar_last_synced_at?: string | null
          calendar_sync_token?: string | null
          contract_end_date?: string | null
          contract_type?: "permanent" | "fixed_term" | "casual" | "secondment" | null
          created_at?: string | null
          department?: string | null
          email?: string
          fte?: number | null
          full_name?: string
          google_calendar_connected?: boolean | null
          google_refresh_token?: string | null
          id?: string
          induction_completed_at?: string | null
          is_content_editor?: boolean
          is_external?: boolean | null
          is_hr_admin?: boolean | null
          is_ld_admin?: boolean | null
          is_line_manager?: boolean | null
          is_systems_admin?: boolean
          job_title?: string | null
          last_sign_in_at?: string | null
          line_manager_id?: string | null
          phone?: string | null
          preferred_name?: string | null
          probation_end_date?: string | null
          region?: "west" | "east" | "north" | "england" | "central" | "national" | null
          start_date?: string | null
          status?: "active" | "inactive" | "pending_induction"
          team_id?: string | null
          updated_at?: string | null
          user_type?: "staff" | "new_user"
          work_pattern?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_line_manager_id_fkey"
            columns: ["line_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      public_holidays: {
        Row: {
          created_at: string | null
          holiday_date: string
          id: string
          name: string
          region: string
          year: number
        }
        Insert: {
          created_at?: string | null
          holiday_date: string
          id?: string
          name: string
          region: string
          year: number
        }
        Update: {
          created_at?: string | null
          holiday_date?: string
          id?: string
          name?: string
          region?: string
          year?: number
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json | null
          attempted_at: string | null
          id: string
          lesson_id: string
          passed: boolean
          score: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          attempted_at?: string | null
          id?: string
          lesson_id: string
          passed?: boolean
          score: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          attempted_at?: string | null
          id?: string
          lesson_id?: string
          passed?: boolean
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_options: {
        Row: {
          created_at: string | null
          id: string
          is_correct: boolean
          option_text: string
          question_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_correct?: boolean
          option_text: string
          question_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_correct?: boolean
          option_text?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          created_at: string | null
          id: string
          lesson_id: string
          question_text: string
          question_type: "single" | "multi"
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lesson_id: string
          question_text: string
          question_type?: "single" | "multi"
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lesson_id?: string
          question_text?: string
          question_type?: "single" | "multi"
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "course_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_bookmarks: {
        Row: {
          id: string
          user_id: string
          article_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          article_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          article_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_bookmarks_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "resource_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_articles: {
        Row: {
          author_id: string
          category_id: string
          component_name: string | null
          content: string
          content_json: Json | null
          content_type: "google_doc" | "component" | "native"
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          editing_at: string | null
          editing_by: string | null
          google_doc_id: string | null
          google_doc_modified_at: string | null
          google_doc_url: string | null
          google_watch_channel_id: string | null
          google_watch_expires_at: string | null
          google_watch_resource_id: string | null
          id: string
          last_published_at: string | null
          last_sync_error: string | null
          last_synced_at: string | null
          published_at: string | null
          slug: string
          status: "draft" | "published"
          synced_html: string | null
          title: string
          updated_at: string
          visibility: "all" | "internal" | null
        }
        Insert: {
          author_id: string
          category_id: string
          component_name?: string | null
          content?: string
          content_json?: Json | null
          content_type?: "google_doc" | "component" | "native"
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          editing_at?: string | null
          editing_by?: string | null
          google_doc_id?: string | null
          google_doc_modified_at?: string | null
          google_doc_url?: string | null
          google_watch_channel_id?: string | null
          google_watch_expires_at?: string | null
          google_watch_resource_id?: string | null
          id?: string
          last_published_at?: string | null
          last_sync_error?: string | null
          last_synced_at?: string | null
          published_at?: string | null
          slug: string
          status?: "draft" | "published"
          synced_html?: string | null
          title: string
          updated_at?: string
          visibility?: "all" | "internal" | null
        }
        Update: {
          author_id?: string
          category_id?: string
          component_name?: string | null
          content?: string
          content_json?: Json | null
          content_type?: "google_doc" | "component" | "native"
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          editing_at?: string | null
          editing_by?: string | null
          google_doc_id?: string | null
          google_doc_modified_at?: string | null
          google_doc_url?: string | null
          google_watch_channel_id?: string | null
          google_watch_expires_at?: string | null
          google_watch_resource_id?: string | null
          id?: string
          last_published_at?: string | null
          last_sync_error?: string | null
          last_synced_at?: string | null
          published_at?: string | null
          slug?: string
          status?: "draft" | "published"
          synced_html?: string | null
          title?: string
          updated_at?: string
          visibility?: "all" | "internal" | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "resource_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_articles_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_articles_editing_by_fkey"
            columns: ["editing_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_media: {
        Row: {
          id: string
          file_id: string
          article_id: string | null
          original_name: string
          mime_type: string
          file_size: number
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          file_id: string
          article_id?: string | null
          original_name: string
          mime_type: string
          file_size: number
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          file_id?: string
          article_id?: string | null
          original_name?: string
          mime_type?: string
          file_size?: number
          uploaded_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_media_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "resource_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          icon: string | null
          icon_colour: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
          visibility: "all" | "internal"
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          icon?: string | null
          icon_colour?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          visibility?: "all" | "internal"
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          icon?: string | null
          icon_colour?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          visibility?: "all" | "internal"
        }
        Relationships: [
          {
            foreignKeyName: "resource_categories_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "resource_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      return_to_work_forms: {
        Row: {
          absence_end_date: string
          absence_record_id: string
          absence_start_date: string
          additional_notes: string | null
          adjustments_needed: string | null
          completed_at: string | null
          completed_by: string
          created_at: string | null
          discussion_date: string | null
          employee_comments: string | null
          employee_confirmed: boolean | null
          employee_confirmed_at: string | null
          employee_id: string
          follow_up_date: string | null
          gp_clearance_received: boolean | null
          has_underlying_cause: boolean | null
          id: string
          is_pregnancy_related: boolean | null
          is_work_related: boolean | null
          medical_advice_details: string | null
          phased_return_agreed: boolean | null
          phased_return_details: string | null
          procedures_followed: boolean | null
          procedures_not_followed_reason: string | null
          reason_for_absence: string | null
          status: "draft" | "submitted" | "confirmed" | "locked" | null
          trigger_point_details: string | null
          trigger_point_reached: boolean | null
          updated_at: string | null
          wellbeing_discussion: string | null
        }
        Insert: {
          absence_end_date: string
          absence_record_id: string
          absence_start_date: string
          additional_notes?: string | null
          adjustments_needed?: string | null
          completed_at?: string | null
          completed_by: string
          created_at?: string | null
          discussion_date?: string | null
          employee_comments?: string | null
          employee_confirmed?: boolean | null
          employee_confirmed_at?: string | null
          employee_id: string
          follow_up_date?: string | null
          gp_clearance_received?: boolean | null
          has_underlying_cause?: boolean | null
          id?: string
          is_pregnancy_related?: boolean | null
          is_work_related?: boolean | null
          medical_advice_details?: string | null
          phased_return_agreed?: boolean | null
          phased_return_details?: string | null
          procedures_followed?: boolean | null
          procedures_not_followed_reason?: string | null
          reason_for_absence?: string | null
          status?: "draft" | "submitted" | "confirmed" | "locked" | null
          trigger_point_details?: string | null
          trigger_point_reached?: boolean | null
          updated_at?: string | null
          wellbeing_discussion?: string | null
        }
        Update: {
          absence_end_date?: string
          absence_record_id?: string
          absence_start_date?: string
          additional_notes?: string | null
          adjustments_needed?: string | null
          completed_at?: string | null
          completed_by?: string
          created_at?: string | null
          discussion_date?: string | null
          employee_comments?: string | null
          employee_confirmed?: boolean | null
          employee_confirmed_at?: string | null
          employee_id?: string
          follow_up_date?: string | null
          gp_clearance_received?: boolean | null
          has_underlying_cause?: boolean | null
          id?: string
          is_pregnancy_related?: boolean | null
          is_work_related?: boolean | null
          medical_advice_details?: string | null
          phased_return_agreed?: boolean | null
          phased_return_details?: string | null
          procedures_followed?: boolean | null
          procedures_not_followed_reason?: string | null
          reason_for_absence?: string | null
          status?: "draft" | "submitted" | "confirmed" | "locked" | null
          trigger_point_details?: string | null
          trigger_point_reached?: boolean | null
          updated_at?: string | null
          wellbeing_discussion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_to_work_forms_absence_record_id_fkey"
            columns: ["absence_record_id"]
            isOneToOne: true
            referencedRelation: "absence_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_to_work_forms_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_to_work_forms_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      section_quiz_attempts: {
        Row: {
          answers: Json | null
          attempted_at: string
          course_id: string | null
          id: string
          passed: boolean
          quiz_id: string
          score: number
          section_id: string | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          attempted_at?: string
          course_id?: string | null
          id?: string
          passed?: boolean
          quiz_id: string
          score: number
          section_id?: string | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          attempted_at?: string
          course_id?: string | null
          id?: string
          passed?: boolean
          quiz_id?: string
          score?: number
          section_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_quiz_attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "section_quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_quiz_attempts_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      section_quiz_options: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          option_text: string
          question_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          option_text: string
          question_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          option_text?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "section_quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "section_quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      section_quiz_questions: {
        Row: {
          created_at: string
          id: string
          question_text: string
          question_type: "single" | "multi"
          quiz_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_text: string
          question_type?: "single" | "multi"
          quiz_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          question_text?: string
          question_type?: "single" | "multi"
          quiz_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "section_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      section_quizzes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          passing_score: number
          section_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          passing_score?: number
          section_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          passing_score?: number
          section_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_quizzes_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: true
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_leaving_forms: {
        Row: {
          access_revoked: boolean | null
          access_revoked_date: string | null
          additional_notes: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          equipment_notes: string | null
          equipment_returned: boolean | null
          exit_interview_completed: boolean | null
          exit_interview_notes: string | null
          final_leave_balance: number | null
          id: string
          initiated_by: string | null
          knowledge_transfer_completed: boolean | null
          knowledge_transfer_notes: string | null
          last_working_date: string | null
          leaving_date: string
          notice_period_end: string | null
          notice_period_start: string | null
          profile_id: string
          reason_details: string | null
          reason_for_leaving: string
          rehire_eligible: boolean | null
          status: "draft" | "submitted" | "in_progress" | "completed" | "cancelled"
          updated_at: string | null
        }
        Insert: {
          access_revoked?: boolean | null
          access_revoked_date?: string | null
          additional_notes?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          equipment_notes?: string | null
          equipment_returned?: boolean | null
          exit_interview_completed?: boolean | null
          exit_interview_notes?: string | null
          final_leave_balance?: number | null
          id?: string
          initiated_by?: string | null
          knowledge_transfer_completed?: boolean | null
          knowledge_transfer_notes?: string | null
          last_working_date?: string | null
          leaving_date: string
          notice_period_end?: string | null
          notice_period_start?: string | null
          profile_id: string
          reason_details?: string | null
          reason_for_leaving: string
          rehire_eligible?: boolean | null
          status?: "draft" | "submitted" | "in_progress" | "completed" | "cancelled"
          updated_at?: string | null
        }
        Update: {
          access_revoked?: boolean | null
          access_revoked_date?: string | null
          additional_notes?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          equipment_notes?: string | null
          equipment_returned?: boolean | null
          exit_interview_completed?: boolean | null
          exit_interview_notes?: string | null
          final_leave_balance?: number | null
          id?: string
          initiated_by?: string | null
          knowledge_transfer_completed?: boolean | null
          knowledge_transfer_notes?: string | null
          last_working_date?: string | null
          leaving_date?: string
          notice_period_end?: string | null
          notice_period_start?: string | null
          profile_id?: string
          reason_details?: string | null
          reason_for_leaving?: string
          rehire_eligible?: boolean | null
          status?: "draft" | "submitted" | "in_progress" | "completed" | "cancelled"
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_leaving_forms_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_leaving_forms_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_leaving_forms_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          created_at: string | null
          id: string
          is_required: boolean | null
          options: Json | null
          question_text: string
          question_type: "rating" | "text" | "single_choice" | "multi_choice"
          sort_order: number
          survey_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          options?: Json | null
          question_text: string
          question_type: "rating" | "text" | "single_choice" | "multi_choice"
          sort_order?: number
          survey_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          options?: Json | null
          question_text?: string
          question_type?: "rating" | "text" | "single_choice" | "multi_choice"
          sort_order?: number
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          answers: Json
          id: string
          respondent_id: string | null
          submitted_at: string | null
          survey_id: string
        }
        Insert: {
          answers: Json
          id?: string
          respondent_id?: string | null
          submitted_at?: string | null
          survey_id: string
        }
        Update: {
          answers?: Json
          id?: string
          respondent_id?: string | null
          submitted_at?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_respondent_id_fkey"
            columns: ["respondent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          is_anonymous: boolean | null
          start_date: string | null
          status: "draft" | "active" | "closed"
          survey_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_anonymous?: boolean | null
          start_date?: string | null
          status?: "draft" | "active" | "closed"
          survey_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_anonymous?: boolean | null
          start_date?: string | null
          status?: "draft" | "active" | "closed"
          survey_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surveys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          parent_team_id: string | null
          team_lead_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          parent_team_id?: string | null
          team_lead_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_team_id?: string | null
          team_lead_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_parent_team_id_fkey"
            columns: ["parent_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_team_lead_id_fkey"
            columns: ["team_lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_shed_entries: {
        Row: {
          content: Json
          created_at: string
          event_date: string | null
          event_name: string | null
          external_course_id: string | null
          format: "postcard" | "three_two_one" | "takeover"
          id: string
          is_published: boolean
          search_text: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          event_date?: string | null
          event_name?: string | null
          external_course_id?: string | null
          format: "postcard" | "three_two_one" | "takeover"
          id?: string
          is_published?: boolean
          search_text?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          event_date?: string | null
          event_name?: string | null
          external_course_id?: string | null
          format?: "postcard" | "three_two_one" | "takeover"
          id?: string
          is_published?: boolean
          search_text?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_shed_entries_external_course_id_fkey"
            columns: ["external_course_id"]
            isOneToOne: false
            referencedRelation: "external_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_patterns: {
        Row: {
          created_at: string | null
          day_of_week: number
          id: string
          location: "home" | "glasgow_office" | "stevenage_office" | "other"
          other_location: string | null
          time_slot: "full_day" | "morning" | "afternoon"
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          id?: string
          location: "home" | "glasgow_office" | "stevenage_office" | "other"
          other_location?: string | null
          time_slot?: "full_day" | "morning" | "afternoon"
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          id?: string
          location?: "home" | "glasgow_office" | "stevenage_office" | "other"
          other_location?: string | null
          time_slot?: "full_day" | "morning" | "afternoon"
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_patterns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_roundups: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          pinned_until: string | null
          post_ids: string[] | null
          summary: string | null
          title: string
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          pinned_until?: string | null
          post_ids?: string[] | null
          summary?: string | null
          title: string
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          pinned_until?: string | null
          post_ids?: string[] | null
          summary?: string | null
          title?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      working_locations: {
        Row: {
          confirmed: boolean
          confirmed_at: string | null
          created_at: string | null
          date: string
          google_event_id: string | null
          id: string
          leave_request_id: string | null
          location: "home" | "glasgow_office" | "stevenage_office" | "other" | "on_leave"
          other_location: string | null
          source: "manual" | "calendar" | "pattern" | "leave"
          time_slot: "full_day" | "morning" | "afternoon"
          updated_at: string | null
          user_id: string
        }
        Insert: {
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string | null
          date: string
          google_event_id?: string | null
          id?: string
          leave_request_id?: string | null
          location: "home" | "glasgow_office" | "stevenage_office" | "other" | "on_leave"
          other_location?: string | null
          source?: "manual" | "calendar" | "pattern" | "leave"
          time_slot: "full_day" | "morning" | "afternoon"
          updated_at?: string | null
          user_id: string
        }
        Update: {
          confirmed?: boolean
          confirmed_at?: string | null
          created_at?: string | null
          date?: string
          google_event_id?: string | null
          id?: string
          leave_request_id?: string | null
          location?: "home" | "glasgow_office" | "stevenage_office" | "other" | "on_leave"
          other_location?: string | null
          source?: "manual" | "calendar" | "pattern" | "leave"
          time_slot?: "full_day" | "morning" | "afternoon"
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "working_locations_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_posts: { Args: never; Returns: boolean }
      complete_lesson_and_update_progress: {
        Args: { p_course_id: string; p_lesson_id: string; p_user_id: string }
        Returns: number
      }
      generate_weekly_roundup: { Args: never; Returns: undefined }
      get_popular_tags: {
        Args: { limit_count?: number }
        Returns: {
          tag: string
          usage_count: number
        }[]
      }
      has_module_access: { Args: { p_module: string }; Returns: boolean }
      is_content_editor: { Args: never; Returns: boolean }
      is_content_editor_effective: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      is_hr_admin: { Args: never; Returns: boolean }
      is_hr_admin_effective: { Args: { p_user_id?: string }; Returns: boolean }
      is_ld_admin: { Args: never; Returns: boolean }
      is_ld_admin_effective: { Args: { p_user_id?: string }; Returns: boolean }
      is_line_manager: { Args: never; Returns: boolean }
      is_senior_manager: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_systems_admin_effective: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      manages_user: { Args: { target_user_id: string }; Returns: boolean }
      manages_user_recursive: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      notify_course_published: {
        Args: { p_course_id: string; p_published_by: string }
        Returns: number
      }
      notify_mention: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_mentioned_user_ids: string[]
          p_post_id: string
        }
        Returns: number
      }
      notify_post_comment:
        | {
            Args: {
              p_actor_id: string
              p_comment_id: string
              p_comment_preview?: string
              p_parent_comment_id?: string
              p_post_id: string
            }
            Returns: number
          }
        | {
            Args: {
              p_comment_id: string
              p_comment_preview?: string
              p_parent_comment_id?: string
              p_post_id: string
            }
            Returns: number
          }
      recalculate_course_progress: {
        Args: { p_course_id: string; p_user_id: string }
        Returns: number
      }
      reset_user_induction: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      resolve_article_visibility: {
        Args: { p_article_visibility: string; p_category_id: string }
        Returns: string
      }
      submit_quiz_attempt: {
        Args: {
          p_answers: Json
          p_course_id: string
          p_lesson_id: string
          p_user_id: string
        }
        Returns: Json
      }
      submit_section_quiz_attempt:
        | {
            Args: {
              p_answers: Json
              p_course_id: string
              p_quiz_id: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_answers: Json
              p_course_id: string
              p_quiz_id: string
              p_section_id: string
              p_user_id: string
            }
            Returns: Json
          }
      unpin_expired_roundups: { Args: never; Returns: undefined }
    }
    Enums: {
      course_category: "compliance" | "upskilling" | "soft_skills"
      enrolment_status: "enrolled" | "in_progress" | "completed" | "dropped"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      leave_type:
        | "annual"
        | "sick"
        | "compassionate"
        | "parental"
        | "toil"
        | "unpaid"
        | "study"
        | "jury_duty"
      work_location: "home" | "glasgow_office" | "stevenage_office" | "other"
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
    Enums: {
      course_category: ["compliance", "upskilling", "soft_skills"],
      enrolment_status: ["enrolled", "in_progress", "completed", "dropped"],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      leave_type: [
        "annual",
        "sick",
        "compassionate",
        "parental",
        "toil",
        "unpaid",
        "study",
        "jury_duty",
      ],
      work_location: ["home", "glasgow_office", "stevenage_office", "other"],
    },
  },
} as const

// Enum types
export type UserType = "staff" | "new_user";
export type UserStatus = "active" | "inactive" | "pending_induction";
export type LeaveType =
  | "annual"
  | "sick"
  | "compassionate"
  | "parental"
  | "toil"
  | "unpaid"
  | "study"
  | "jury_duty";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type WorkLocation =
  | "home"
  | "glasgow_office"
  | "stevenage_office"
  | "other"
  | "on_leave";
export type TimeSlot = "full_day" | "morning" | "afternoon";
export type LocationSource = "manual" | "calendar" | "pattern" | "leave";
export type CourseCategory = "compliance" | "upskilling" | "soft_skills";
export type EnrolmentStatus = "enrolled" | "in_progress" | "completed" | "dropped";
export type LessonType = "video" | "text" | "slides" | "rich_text";
export type CourseStatus = "draft" | "published";
export type QuestionType = "single" | "multi";
export type ReactionType = "like" | "love" | "celebrate" | "insightful" | "curious";
export type AttachmentType = "image" | "document" | "link";
export type ArticleStatus = "draft" | "published";

// Helper types for easier usage
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type ManagerTeam = Database["public"]["Tables"]["manager_teams"]["Row"];
export type Course = Database["public"]["Tables"]["courses"]["Row"];
export type CourseEnrolment = Database["public"]["Tables"]["course_enrolments"]["Row"];
export type CourseLesson = Database["public"]["Tables"]["course_lessons"]["Row"];
export type LessonCompletion = Database["public"]["Tables"]["lesson_completions"]["Row"];
export type CourseAssignment = Database["public"]["Tables"]["course_assignments"]["Row"];
export type LessonImage = Database["public"]["Tables"]["lesson_images"]["Row"];
export type ExternalCourse = Database["public"]["Tables"]["external_courses"]["Row"];
export type QuizQuestion = Database["public"]["Tables"]["quiz_questions"]["Row"];
export type QuizOption = Database["public"]["Tables"]["quiz_options"]["Row"];
export type QuizAttempt = Database["public"]["Tables"]["quiz_attempts"]["Row"];

export interface QuizQuestionWithOptions extends QuizQuestion {
  options: QuizOption[];
}
export type InductionProgress = Database["public"]["Tables"]["induction_progress"]["Row"];

// Extended types with relations
export interface ProfileWithRelations extends Profile {
  team?: Team | null;
  line_manager?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
}

export interface TeamWithRelations extends Team {
  team_lead?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  members?: Pick<Profile, "id" | "full_name" | "avatar_url" | "job_title">[];
  parent_team?: Pick<Team, "id" | "name"> | null;
}

export interface CourseWithEnrolment extends Course {
  enrolment?: CourseEnrolment | null;
}

export interface EnrolmentWithCourse extends CourseEnrolment {
  course: Course;
}

// Working location types
export type WorkingLocation = Database["public"]["Tables"]["working_locations"]["Row"];
export type WeeklyPattern = Database["public"]["Tables"]["weekly_patterns"]["Row"];

// News feed types
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type PostAttachment = Database["public"]["Tables"]["post_attachments"]["Row"];
export type PostReaction = Database["public"]["Tables"]["post_reactions"]["Row"];
export type PostComment = Database["public"]["Tables"]["post_comments"]["Row"];
export type CommentReaction = Database["public"]["Tables"]["comment_reactions"]["Row"];
export type WeeklyRoundup = Database["public"]["Tables"]["weekly_roundups"]["Row"];

export type PostAuthor = Pick<Profile, "id" | "full_name" | "preferred_name" | "avatar_url" | "job_title">;
export type CommentAuthor = Pick<Profile, "id" | "full_name" | "preferred_name" | "avatar_url">;

export interface CommentWithAuthor extends PostComment {
  author: CommentAuthor;
  reactions: CommentReaction[];
  reaction_counts: Record<ReactionType, number>;
  user_reaction: ReactionType | null;
  replies: CommentWithAuthor[];
}

export interface PostPollOption {
  id: string;
  option_text: string;
  display_order: number;
  vote_count: number;
}

export interface PostPoll {
  question: string;
  options: PostPollOption[];
  total_votes: number;
  user_vote_option_id: string | null;
  /** All option IDs the current user voted for (multi-select polls may have multiple). */
  user_vote_option_ids: string[];
  closes_at: string | null;
  is_closed: boolean;
  allow_multiple: boolean;
}

export interface PostWithRelations extends Post {
  author: PostAuthor;
  attachments: PostAttachment[];
  reactions: PostReaction[];
  comments: CommentWithAuthor[];
  reaction_counts: Record<ReactionType, number>;
  user_reaction: ReactionType | null;
  comment_count: number;
  /** Poll data (null for non-poll posts) */
  poll?: PostPoll | null;
}

// Resource / Knowledge Base types
export type ResourceCategory = Database["public"]["Tables"]["resource_categories"]["Row"];
export type ResourceArticle = Database["public"]["Tables"]["resource_articles"]["Row"];

export type ArticleAuthor = Pick<Profile, "id" | "full_name" | "preferred_name" | "avatar_url">;

export interface ArticleWithAuthor extends ResourceArticle {
  author: ArticleAuthor;
}

export interface CategoryWithCount extends ResourceCategory {
  article_count: number;
}

export interface CategoryWithChildren extends CategoryWithCount {
  children: CategoryWithCount[];
}

/** Recursive tree node for the resources sidebar tree (supports 3-level depth). */
export interface CategoryTreeNode extends CategoryWithCount {
  children: CategoryTreeNode[];
  /** Full slug path from root, e.g. "policies/employment-policies" */
  slugPath: string;
}

// Section types
export type CourseSection = Database["public"]["Tables"]["course_sections"]["Row"];

export type SectionQuiz = Database["public"]["Tables"]["section_quizzes"]["Row"];

export type SectionQuizQuestion = Database["public"]["Tables"]["section_quiz_questions"]["Row"];

export type SectionQuizOption = Database["public"]["Tables"]["section_quiz_options"]["Row"];

export interface SectionQuizQuestionWithOptions extends SectionQuizQuestion {
  options: SectionQuizOption[];
}

/** Extended section type with nested data for admin course detail page. */
export interface CourseSectionWithDetails extends CourseSection {
  lessons: CourseLesson[];
  quiz: SectionQuiz | null;
  quizQuestions: SectionQuizQuestionWithOptions[];
  lessonImagesMap: Record<string, LessonImage[]>;
}

// Certificate types
export type Certificate = Database["public"]["Tables"]["certificates"]["Row"];

// Section quiz attempt type
export type SectionQuizAttempt = Database["public"]["Tables"]["section_quiz_attempts"]["Row"];
