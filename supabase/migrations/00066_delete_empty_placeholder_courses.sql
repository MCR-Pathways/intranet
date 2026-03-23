-- Delete 7 empty placeholder courses seeded in migration 00004.
-- These have no lessons (migration 00019 only added content to the 5 compliance courses).
-- Learners see them in the catalogue but cannot take them.
-- The 5 compliance courses (Data Protection, Safeguarding, H&S, EDI, Info Security) are kept.

-- Delete enrolments for these courses first (FK constraint)
DELETE FROM public.course_enrolments
WHERE course_id IN (
  SELECT c.id FROM public.courses c
  LEFT JOIN public.course_lessons cl ON cl.course_id = c.id
  WHERE c.title IN (
    'Effective Mentoring Techniques',
    'Communication Skills for Coordinators',
    'Time Management & Productivity',
    'Presentation Skills',
    'Conflict Resolution',
    'Emotional Intelligence in the Workplace',
    'Trauma-Informed Practice'
  )
  GROUP BY c.id
  HAVING COUNT(cl.id) = 0
);

-- Delete the empty courses themselves
DELETE FROM public.courses
WHERE id IN (
  SELECT c.id FROM public.courses c
  LEFT JOIN public.course_lessons cl ON cl.course_id = c.id
  WHERE c.title IN (
    'Effective Mentoring Techniques',
    'Communication Skills for Coordinators',
    'Time Management & Productivity',
    'Presentation Skills',
    'Conflict Resolution',
    'Emotional Intelligence in the Workplace',
    'Trauma-Informed Practice'
  )
  GROUP BY c.id
  HAVING COUNT(cl.id) = 0
);
