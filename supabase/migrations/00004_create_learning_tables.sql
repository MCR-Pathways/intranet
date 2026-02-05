-- MCR Pathways Intranet - Learning Tables
-- This migration creates the courses and course_enrollments tables

-- ===========================================
-- ENROLLMENT STATUS ENUM
-- ===========================================

CREATE TYPE enrollment_status AS ENUM (
  'enrolled',
  'in_progress',
  'completed',
  'dropped'
);

-- ===========================================
-- COURSES TABLE
-- ===========================================

CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category course_category NOT NULL,
  duration_minutes INTEGER, -- Estimated time to complete in minutes
  is_required BOOLEAN DEFAULT FALSE,
  thumbnail_url TEXT,
  content_url TEXT, -- Link to external content (video, SCORM, etc.)
  passing_score INTEGER, -- Minimum score to pass (if applicable)
  due_days_from_start INTEGER, -- For compliance courses, days from user start date
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_courses_category ON public.courses(category);
CREATE INDEX idx_courses_is_required ON public.courses(is_required);
CREATE INDEX idx_courses_is_active ON public.courses(is_active);

-- ===========================================
-- COURSE ENROLLMENTS TABLE
-- ===========================================

CREATE TABLE public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status enrollment_status NOT NULL DEFAULT 'enrolled',
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  score INTEGER, -- Final score if applicable
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  due_date DATE, -- Calculated due date for compliance courses
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Indexes for common queries
CREATE INDEX idx_enrollments_user_id ON public.course_enrollments(user_id);
CREATE INDEX idx_enrollments_course_id ON public.course_enrollments(course_id);
CREATE INDEX idx_enrollments_status ON public.course_enrollments(status);
CREATE INDEX idx_enrollments_due_date ON public.course_enrollments(due_date);
CREATE INDEX idx_enrollments_user_status ON public.course_enrollments(user_id, status);

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Apply updated_at trigger to courses
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to enrollments
CREATE TRIGGER update_course_enrollments_updated_at
  BEFORE UPDATE ON public.course_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

-- Courses policies
-- Everyone can view active courses
CREATE POLICY "Anyone can view active courses"
  ON public.courses
  FOR SELECT
  USING (is_active = TRUE);

-- HR admins can manage courses
CREATE POLICY "HR admins can manage courses"
  ON public.courses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_hr_admin = TRUE
    )
  );

-- Course enrollments policies
-- Users can view their own enrollments
CREATE POLICY "Users can view own enrollments"
  ON public.course_enrollments
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can enroll themselves
CREATE POLICY "Users can enroll themselves"
  ON public.course_enrollments
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own enrollment progress
CREATE POLICY "Users can update own enrollment progress"
  ON public.course_enrollments
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- HR admins can view all enrollments
CREATE POLICY "HR admins can view all enrollments"
  ON public.course_enrollments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND is_hr_admin = TRUE
    )
  );

-- Line managers can view their team's enrollments
CREATE POLICY "Managers can view team enrollments"
  ON public.course_enrollments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = course_enrollments.user_id
      AND profiles.line_manager_id = auth.uid()
    )
  );

-- ===========================================
-- FUNCTION: Auto-enroll users in required courses
-- ===========================================

CREATE OR REPLACE FUNCTION auto_enroll_required_courses()
RETURNS TRIGGER AS $$
DECLARE
  required_course RECORD;
  user_start_date DATE;
BEGIN
  -- Get user's start date
  SELECT start_date INTO user_start_date FROM public.profiles WHERE id = NEW.id;

  -- Loop through all required active courses and enroll user
  FOR required_course IN
    SELECT id, due_days_from_start
    FROM public.courses
    WHERE is_required = TRUE AND is_active = TRUE
  LOOP
    INSERT INTO public.course_enrollments (
      user_id,
      course_id,
      status,
      due_date
    )
    VALUES (
      NEW.id,
      required_course.id,
      'enrolled',
      CASE
        WHEN required_course.due_days_from_start IS NOT NULL AND user_start_date IS NOT NULL
        THEN user_start_date + required_course.due_days_from_start
        ELSE NULL
      END
    )
    ON CONFLICT (user_id, course_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-enroll new users in required courses
CREATE TRIGGER on_profile_created_enroll_required_courses
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_enroll_required_courses();

-- ===========================================
-- SEED DATA: Sample courses
-- ===========================================

INSERT INTO public.courses (title, description, category, duration_minutes, is_required, due_days_from_start)
VALUES
  ('Data Protection & GDPR', 'Understanding data protection laws and GDPR compliance in your role at MCR Pathways.', 'compliance', 45, TRUE, 30),
  ('Safeguarding Children & Young People', 'Essential safeguarding training for all staff working with young people.', 'compliance', 60, TRUE, 14),
  ('Health & Safety Essentials', 'Workplace health and safety fundamentals including fire safety and first aid awareness.', 'compliance', 30, TRUE, 30),
  ('Equality, Diversity & Inclusion', 'Training on creating an inclusive environment and understanding unconscious bias.', 'compliance', 40, TRUE, 30),
  ('Information Security Awareness', 'Best practices for protecting sensitive information and cyber security basics.', 'compliance', 25, TRUE, 30),
  ('Effective Mentoring Techniques', 'Learn strategies and techniques for effective mentoring relationships.', 'upskilling', 90, FALSE, NULL),
  ('Communication Skills for Coordinators', 'Enhance your communication skills for working with schools and young people.', 'upskilling', 60, FALSE, NULL),
  ('Time Management & Productivity', 'Tools and techniques for managing your workload effectively.', 'upskilling', 45, FALSE, NULL),
  ('Presentation Skills', 'Develop confidence and skills in delivering presentations.', 'soft_skills', 60, FALSE, NULL),
  ('Conflict Resolution', 'Strategies for handling difficult conversations and resolving conflicts.', 'soft_skills', 45, FALSE, NULL),
  ('Emotional Intelligence in the Workplace', 'Understanding and developing emotional intelligence for better working relationships.', 'soft_skills', 50, FALSE, NULL),
  ('Trauma-Informed Practice', 'Understanding trauma and its impact on young people, with practical strategies.', 'upskilling', 75, FALSE, NULL);
