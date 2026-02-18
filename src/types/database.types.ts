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
export type LessonType = "video" | "text" | "quiz";
export type CourseStatus = "draft" | "published";
export type ReactionType = "like" | "love" | "celebrate" | "insightful" | "curious";
export type AttachmentType = "image" | "document" | "link";

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
          is_ld_admin: boolean;
          line_manager_id: string | null;
          team_id: string | null;
          google_calendar_connected: boolean;
          google_refresh_token: string | null;
          induction_completed_at: string | null;
          last_sign_in_at: string | null;
          last_sign_in_date: string | null;
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
          is_ld_admin?: boolean;
          line_manager_id?: string | null;
          team_id?: string | null;
          google_calendar_connected?: boolean;
          google_refresh_token?: string | null;
          induction_completed_at?: string | null;
          last_sign_in_at?: string | null;
          last_sign_in_date?: string | null;
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
          is_ld_admin?: boolean;
          line_manager_id?: string | null;
          team_id?: string | null;
          google_calendar_connected?: boolean;
          google_refresh_token?: string | null;
          induction_completed_at?: string | null;
          last_sign_in_at?: string | null;
          last_sign_in_date?: string | null;
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
          status: CourseStatus;
          created_by: string | null;
          updated_by: string | null;
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
          status?: CourseStatus;
          created_by?: string | null;
          updated_by?: string | null;
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
          status?: CourseStatus;
          created_by?: string | null;
          updated_by?: string | null;
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
      posts: {
        Row: {
          id: string;
          author_id: string;
          content: string;
          is_pinned: boolean;
          is_weekly_roundup: boolean;
          weekly_roundup_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          content: string;
          is_pinned?: boolean;
          is_weekly_roundup?: boolean;
          weekly_roundup_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          content?: string;
          is_pinned?: boolean;
          is_weekly_roundup?: boolean;
          weekly_roundup_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      post_attachments: {
        Row: {
          id: string;
          post_id: string;
          attachment_type: AttachmentType;
          file_url: string | null;
          file_name: string | null;
          file_size: number | null;
          mime_type: string | null;
          link_url: string | null;
          link_title: string | null;
          link_description: string | null;
          link_image_url: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          attachment_type: AttachmentType;
          file_url?: string | null;
          file_name?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          link_url?: string | null;
          link_title?: string | null;
          link_description?: string | null;
          link_image_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          attachment_type?: AttachmentType;
          file_url?: string | null;
          file_name?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          link_url?: string | null;
          link_title?: string | null;
          link_description?: string | null;
          link_image_url?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      post_reactions: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          reaction_type: ReactionType;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          reaction_type: ReactionType;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          reaction_type?: ReactionType;
          created_at?: string;
        };
      };
      post_comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          content: string;
          parent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          content: string;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          content?: string;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      comment_reactions: {
        Row: {
          id: string;
          comment_id: string;
          user_id: string;
          reaction_type: ReactionType;
          created_at: string;
        };
        Insert: {
          id?: string;
          comment_id: string;
          user_id: string;
          reaction_type: ReactionType;
          created_at?: string;
        };
        Update: {
          id?: string;
          comment_id?: string;
          user_id?: string;
          reaction_type?: ReactionType;
          created_at?: string;
        };
      };
      weekly_roundups: {
        Row: {
          id: string;
          week_start: string;
          week_end: string;
          title: string;
          summary: string | null;
          post_ids: string[];
          pinned_until: string | null;
          generated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          week_start: string;
          week_end: string;
          title: string;
          summary?: string | null;
          post_ids?: string[];
          pinned_until?: string | null;
          generated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          week_start?: string;
          week_end?: string;
          title?: string;
          summary?: string | null;
          post_ids?: string[];
          pinned_until?: string | null;
          generated_at?: string;
          created_at?: string;
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
      course_lessons: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          content: string | null;
          video_url: string | null;
          video_storage_path: string | null;
          lesson_type: LessonType;
          passing_score: number | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          content?: string | null;
          video_url?: string | null;
          video_storage_path?: string | null;
          lesson_type?: LessonType;
          passing_score?: number | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          title?: string;
          content?: string | null;
          video_url?: string | null;
          video_storage_path?: string | null;
          lesson_type?: LessonType;
          passing_score?: number | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      lesson_completions: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          completed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lesson_id: string;
          completed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          lesson_id?: string;
          completed_at?: string;
        };
      };
      course_assignments: {
        Row: {
          id: string;
          course_id: string;
          assign_type: string;
          assign_value: string;
          assigned_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          assign_type: string;
          assign_value: string;
          assigned_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          assign_type?: string;
          assign_value?: string;
          assigned_by?: string | null;
          created_at?: string;
        };
      };
      lesson_images: {
        Row: {
          id: string;
          lesson_id: string;
          file_name: string;
          file_url: string;
          storage_path: string;
          file_size: number;
          mime_type: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          file_name: string;
          file_url: string;
          storage_path: string;
          file_size: number;
          mime_type: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          lesson_id?: string;
          file_name?: string;
          file_url?: string;
          storage_path?: string;
          file_size?: number;
          mime_type?: string;
          sort_order?: number;
          created_at?: string;
        };
      };
      quiz_questions: {
        Row: {
          id: string;
          lesson_id: string;
          question_text: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lesson_id: string;
          question_text: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lesson_id?: string;
          question_text?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      quiz_options: {
        Row: {
          id: string;
          question_id: string;
          option_text: string;
          is_correct: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          option_text: string;
          is_correct?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          option_text?: string;
          is_correct?: boolean;
          sort_order?: number;
          created_at?: string;
        };
      };
      quiz_attempts: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          score: number;
          passed: boolean;
          answers: Json | null;
          attempted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lesson_id: string;
          score: number;
          passed?: boolean;
          answers?: Json | null;
          attempted_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          lesson_id?: string;
          score?: number;
          passed?: boolean;
          answers?: Json | null;
          attempted_at?: string;
        };
      };
      sign_ins: {
        Row: {
          id: string;
          user_id: string;
          sign_in_date: string;
          location: WorkLocation;
          other_location: string | null;
          signed_in_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          sign_in_date?: string;
          location: WorkLocation;
          other_location?: string | null;
          signed_in_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          sign_in_date?: string;
          location?: WorkLocation;
          other_location?: string | null;
          signed_in_at?: string;
          created_at?: string;
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
      is_ld_admin: {
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
      generate_weekly_roundup: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      };
      unpin_expired_roundups: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      };
      complete_lesson_and_update_progress: {
        Args: {
          p_user_id: string;
          p_lesson_id: string;
          p_course_id: string;
        };
        Returns: number;
      };
      submit_quiz_attempt: {
        Args: {
          p_user_id: string;
          p_lesson_id: string;
          p_course_id: string;
          p_answers: Json;
        };
        Returns: Json;
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
export type CourseLesson = Database["public"]["Tables"]["course_lessons"]["Row"];
export type LessonCompletion = Database["public"]["Tables"]["lesson_completions"]["Row"];
export type CourseAssignment = Database["public"]["Tables"]["course_assignments"]["Row"];
export type LessonImage = Database["public"]["Tables"]["lesson_images"]["Row"];
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

export interface CourseWithEnrollment extends Course {
  enrollment?: CourseEnrollment | null;
}

export interface EnrollmentWithCourse extends CourseEnrollment {
  course: Course;
}

// Sign-in types
export type SignIn = Database["public"]["Tables"]["sign_ins"]["Row"];

export interface TeamMemberSignInEntry {
  location: string;
  other_location: string | null;
  signed_in_at: string;
}

export interface TeamMemberSignIn {
  id: string;
  full_name: string;
  preferred_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  sign_ins: TeamMemberSignInEntry[];
}

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

export interface PostWithRelations extends Post {
  author: PostAuthor;
  attachments: PostAttachment[];
  reactions: PostReaction[];
  comments: CommentWithAuthor[];
  reaction_counts: Record<ReactionType, number>;
  user_reaction: ReactionType | null;
  comment_count: number;
}
