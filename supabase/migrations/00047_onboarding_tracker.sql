-- ===========================================
-- Migration 00047: Onboarding Progress Tracker
-- ===========================================
-- Configurable onboarding checklists for new starters.
-- HR admins create templates; checklists are instantiated per employee.
-- Line managers can tick items. Mirrors staff_leaving_forms pattern.

-- ===========================================
-- 1. ONBOARDING TEMPLATES
-- ===========================================

CREATE TABLE IF NOT EXISTS public.onboarding_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- 2. ONBOARDING TEMPLATE ITEMS
-- ===========================================

CREATE TABLE IF NOT EXISTS public.onboarding_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  description TEXT,
  section TEXT NOT NULL DEFAULT 'general'
    CHECK (section IN ('before_start', 'day_one', 'first_week', 'first_month', 'general')),
  assignee_role TEXT NOT NULL DEFAULT 'hr_admin'
    CHECK (assignee_role IN ('hr_admin', 'line_manager', 'employee', 'other')),
  due_day_offset INTEGER NOT NULL DEFAULT 0,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_items_template
  ON public.onboarding_template_items(template_id);

-- ===========================================
-- 3. ONBOARDING CHECKLISTS (per employee instance)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.onboarding_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id),
  template_id UUID REFERENCES public.onboarding_templates(id) ON DELETE SET NULL,
  initiated_by UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  start_date DATE NOT NULL,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active checklist per employee at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_active_per_profile
  ON public.onboarding_checklists(profile_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_onboarding_checklists_profile
  ON public.onboarding_checklists(profile_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_checklists_status
  ON public.onboarding_checklists(status);

-- updated_at trigger (reuses existing function from migration 00002)
DROP TRIGGER IF EXISTS update_onboarding_checklists_updated_at ON public.onboarding_checklists;
CREATE TRIGGER update_onboarding_checklists_updated_at
  BEFORE UPDATE ON public.onboarding_checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- 4. ONBOARDING CHECKLIST ITEMS (concrete tasks)
-- ===========================================

CREATE TABLE IF NOT EXISTS public.onboarding_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.onboarding_checklists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  section TEXT NOT NULL DEFAULT 'general'
    CHECK (section IN ('before_start', 'day_one', 'first_week', 'first_month', 'general')),
  assignee_role TEXT NOT NULL DEFAULT 'hr_admin'
    CHECK (assignee_role IN ('hr_admin', 'line_manager', 'employee', 'other')),
  assignee_id UUID REFERENCES public.profiles(id),
  due_date DATE,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist
  ON public.onboarding_checklist_items(checklist_id);

-- ===========================================
-- 5. ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklist_items ENABLE ROW LEVEL SECURITY;

-- --- Templates: all authenticated can read, HR admin can mutate ---

CREATE POLICY "onboarding_templates_select"
  ON public.onboarding_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "onboarding_templates_insert"
  ON public.onboarding_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_admin_effective());

CREATE POLICY "onboarding_templates_update"
  ON public.onboarding_templates FOR UPDATE
  TO authenticated
  USING (public.is_hr_admin_effective());

CREATE POLICY "onboarding_templates_delete"
  ON public.onboarding_templates FOR DELETE
  TO authenticated
  USING (public.is_hr_admin_effective());

-- --- Template items: all authenticated can read, HR admin can mutate ---

CREATE POLICY "onboarding_template_items_select"
  ON public.onboarding_template_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "onboarding_template_items_insert"
  ON public.onboarding_template_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_admin_effective());

CREATE POLICY "onboarding_template_items_update"
  ON public.onboarding_template_items FOR UPDATE
  TO authenticated
  USING (public.is_hr_admin_effective());

CREATE POLICY "onboarding_template_items_delete"
  ON public.onboarding_template_items FOR DELETE
  TO authenticated
  USING (public.is_hr_admin_effective());

-- --- Checklists: HR admin + employee + line manager can read; HR admin can mutate ---

CREATE POLICY "onboarding_checklists_select"
  ON public.onboarding_checklists FOR SELECT
  TO authenticated
  USING (
    public.is_hr_admin_effective()
    OR auth.uid() = profile_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = onboarding_checklists.profile_id
      AND p.line_manager_id = auth.uid()
    )
  );

CREATE POLICY "onboarding_checklists_insert"
  ON public.onboarding_checklists FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_admin_effective());

CREATE POLICY "onboarding_checklists_update"
  ON public.onboarding_checklists FOR UPDATE
  TO authenticated
  USING (public.is_hr_admin_effective());

-- --- Checklist items: same SELECT as checklists; UPDATE for HR admin + line manager ---

CREATE POLICY "onboarding_checklist_items_select"
  ON public.onboarding_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.onboarding_checklists oc
      WHERE oc.id = onboarding_checklist_items.checklist_id
      AND (
        public.is_hr_admin_effective()
        OR auth.uid() = oc.profile_id
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = oc.profile_id
          AND p.line_manager_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "onboarding_checklist_items_insert"
  ON public.onboarding_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_hr_admin_effective());

CREATE POLICY "onboarding_checklist_items_update"
  ON public.onboarding_checklist_items FOR UPDATE
  TO authenticated
  USING (
    public.is_hr_admin_effective()
    OR EXISTS (
      SELECT 1 FROM public.onboarding_checklists oc
      JOIN public.profiles p ON p.id = oc.profile_id
      WHERE oc.id = onboarding_checklist_items.checklist_id
      AND p.line_manager_id = auth.uid()
    )
  );

-- Checklist items DELETE only by HR admin (no accidental removal by managers)
CREATE POLICY "onboarding_checklist_items_delete"
  ON public.onboarding_checklist_items FOR DELETE
  TO authenticated
  USING (public.is_hr_admin_effective());

-- ===========================================
-- 6. AUDIT TRIGGER (reuses existing audit function)
-- ===========================================

-- Only audit checklists and checklist items (not templates — they're config)
DROP TRIGGER IF EXISTS audit_onboarding_checklists ON public.onboarding_checklists;
CREATE TRIGGER audit_onboarding_checklists
  AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_checklists
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_onboarding_checklist_items ON public.onboarding_checklist_items;
CREATE TRIGGER audit_onboarding_checklist_items
  AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
