export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Enum types
export type UserType = "staff" | "pathways_coordinator" | "new_user";
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
  | "other";
export type CourseCategory = "compliance" | "upskilling" | "soft_skills";
export type EnrollmentStatus = "enrolled" | "in_progress" | "completed" | "dropped";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          preferred_name: string | null;
          avatar_url: string | null;
          phone: string | null;
          job_title: string | null;
          user_type: UserType;
          status: UserStatus;
          start_date: string | null;
          is_line_manager: boolean;
          is_hr_admin: boolean;
          line_manager_id: string | null;
          team_id: string | null;
          google_calendar_connected: boolean;
          google_refresh_token: string | null;
          induction_completed_at: string | null;
          last_sign_in_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          preferred_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          job_title?: string | null;
          user_type?: UserType;
          status?: UserStatus;
          start_date?: string | null;
          is_line_manager?: boolean;
          is_hr_admin?: boolean;
          line_manager_id?: string | null;
          team_id?: string | null;
          google_calendar_connected?: boolean;
          google_refresh_token?: string | null;
          induction_completed_at?: string | null;
          last_sign_in_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          preferred_name?: string | null;
          avatar_url?: string | null;
          phone?: string | null;
          job_title?: string | null;
          user_type?: UserType;
          status?: UserStatus;
          start_date?: string | null;
          is_line_manager?: boolean;
          is_hr_admin?: boolean;
          line_manager_id?: string | null;
          team_id?: string | null;
          google_calendar_connected?: boolean;
          google_refresh_token?: string | null;
          induction_completed_at?: string | null;
          last_sign_in_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      teams: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          parent_team_id: string | null;
          team_lead_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          parent_team_id?: string | null;
          team_lead_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          parent_team_id?: string | null;
          team_lead_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      manager_teams: {
        Row: {
          id: string;
          manager_id: string;
          team_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          manager_id: string;
          team_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          manager_id?: string;
          team_id?: string;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          link: string | null;
          is_read: boolean;
          read_at: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          link?: string | null;
          is_read?: boolean;
          read_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          message?: string;
          link?: string | null;
          is_read?: boolean;
          read_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      courses: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          category: CourseCategory;
          duration_minutes: number | null;
          is_required: boolean;
          thumbnail_url: string | null;
          content_url: string | null;
          passing_score: number | null;
          due_days_from_start: number | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          category: CourseCategory;
          duration_minutes?: number | null;
          is_required?: boolean;
          thumbnail_url?: string | null;
          content_url?: string | null;
          passing_score?: number | null;
          due_days_from_start?: number | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          category?: CourseCategory;
          duration_minutes?: number | null;
          is_required?: boolean;
          thumbnail_url?: string | null;
          content_url?: string | null;
          passing_score?: number | null;
          due_days_from_start?: number | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      induction_progress: {
        Row: {
          id: string;
          user_id: string;
          item_id: string;
          completed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_id: string;
          completed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          item_id?: string;
          completed_at?: string;
        };
      };
      course_enrollments: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          status: EnrollmentStatus;
          progress_percent: number;
          score: number | null;
          enrolled_at: string;
          started_at: string | null;
          completed_at: string | null;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id: string;
          status?: EnrollmentStatus;
          progress_percent?: number;
          score?: number | null;
          enrolled_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          course_id?: string;
          status?: EnrollmentStatus;
          progress_percent?: number;
          score?: number | null;
          enrolled_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_hr_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_line_manager: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_staff: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      manages_user: {
        Args: {
          target_user_id: string;
        };
        Returns: boolean;
      };
      has_module_access: {
        Args: {
          p_module: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      // user_type and user_status are now TEXT columns, not enums
      leave_type: LeaveType;
      leave_status: LeaveStatus;
      work_location: WorkLocation;
      course_category: CourseCategory;
      enrollment_status: EnrollmentStatus;
    };
  };
}

// Helper types for easier usage
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type ManagerTeam = Database["public"]["Tables"]["manager_teams"]["Row"];
export type Course = Database["public"]["Tables"]["courses"]["Row"];
export type CourseEnrollment = Database["public"]["Tables"]["course_enrollments"]["Row"];
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

export interface CourseWithEnrollment extends Course {
  enrollment?: CourseEnrollment | null;
}

export interface EnrollmentWithCourse extends CourseEnrollment {
  course: Course;
}
