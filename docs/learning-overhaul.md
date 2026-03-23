# Learning & Development Module — Full Overhaul Handover Document

> **Created:** 19 March 2026
> **Author:** Abdulmuiz Adaranijo + Claude Code
> **Branch:** `feature/learning-overhaul`
> **Plan file:** `.claude/plans/virtual-splashing-hippo.md`
> **Status:** Implementation in progress (Phase 1 + Phase 2 complete — schema, utilities, actions, admin UI)
> **Branch:** `feature/learning-overhaul-migrations`
> **Commits:** 5 commits (Phase 1: 3,168 lines, Phase 2: ~1,500 lines)

---

## Why This Exists

MCR Pathways currently uses **LearnDash** (a WordPress LMS plugin) alongside the custom-built Next.js intranet. This creates friction:
- **Two separate platforms** — staff switch between the intranet and a WordPress site for learning
- **Inconsistent UX** — LearnDash looks/feels nothing like the intranet
- **Poor HR integration** — learning data doesn't connect to profiles, compliance, or team views
- **Limited reporting** — LearnDash's reporting is basic and siloed
- **WordPress overhead** — maintaining a separate WordPress instance for one function

The L&D team manages **50+ courses** for all ~60 staff (internal staff + external Pathways Coordinators).

**Goal:** Replace LearnDash entirely with a production-grade LMS built into the intranet.

---

## What We're Building (All Decisions Finalised)

### 1. Course → Sections → Lessons Hierarchy
- Courses contain **sections** (e.g. "Module 1: Introduction to Safeguarding")
- Sections contain **lessons** (text or video)
- Each section can have a **section quiz** at the end that gates access to the next section
- This matches the LearnDash structure MCR currently uses (Course → Sections → Lessons)

### 2. Section Quizzes
- **Single choice + multi choice only** — no fill-in-blank, matching, or essay
- Quiz at the **end of each section**, not per-lesson
- Quiz **gates progression** to the next section until passed
- Admin sets passing score per quiz (default 80%)
- Clean slate — no real users exist, so old quiz data was deleted (not migrated)

### 3. Certificate System
- Auto-generated **PDF certificate** when a course is completed
- Certificate includes: learner name, course title, completion date, score, certificate number (`MCR-YYYY-XXXXX`)
- **Certificate wall** at `/learning/certificates` shows both:
  - Internal certificates (from completed courses)
  - External certificates (from `external_courses.certificate_url`)
- PDF uses MCR Pathways branding, generated via `@react-pdf/renderer`

### 4. Course Assignment
- L&D can assign courses to: **teams**, **user types** (staff/external), or **individual users**
- Auto-enrolment on assignment
- Notification sent on assignment (in-app + email)
- Existing `course_assignments` table has CHECK constraint `('team', 'user_type')` — migration adds `'user'`

### 5. Course Feedback (Private to L&D)
- After completing a course, staff see a feedback dialog (once, dismissible)
- **5 structured fields:**
  1. Overall rating (1-5 stars)
  2. "How relevant was this to your role?" (1-5 stars)
  3. "How clear and well-structured was the content?" (1-5 stars)
  4. "Was the duration appropriate?" (Too short / About right / Too long)
  5. "What could be improved?" (free text)
- **Anonymous** — user_id stored for dedup but hidden from L&D reports
- **Not public** — no star ratings on course cards, no "would you recommend"
- L&D admin dashboard shows aggregate scores + individual anonymous comments + CSV export

### 6. Tool Shed — Social Learning Framework
This is **NOT a resource library**. It's a peer-to-peer knowledge sharing system based on the MCR Pathways Social Learning Framework document.

**How it works:**
1. Staff attend external training/conferences/events
2. They share insights via one of **3 structured formats**:
   - **Digital Learning Postcard**: Elevator Pitch, Lightbulb Moment, Impact on Programme, Golden Nugget
   - **3-2-1 Model**: 3 things learned, 2 things to change, 1 question raised
   - **10-Minute Takeover**: 3 most useful things (for team meeting sharing)
3. All entries visible **organisation-wide** in a social learning feed
4. Entries optionally linked to external course logs (gentle prompt after logging, not required)

**Current state:** Tool Shed page has 12 hardcoded static resources — completely wrong. Needs full database-backed rewrite.

**Manager workflow (future):** Plan schema but defer implementation. Future: manager logs event attendance → system prompts staff → L&D dashboard tracks pending entries.

### 7. Global Search (Cmd+K)
- **Search icon** (magnifying glass) in the header, next to notification bell
- Click or press **Cmd+K** → centered command palette overlay
- Searches across **Resources** (existing `resources_articles` index) + **Courses** (new `learning_courses` index)
- Results grouped by type, each result links to the item
- Uses Algolia multi-index query (extending existing infrastructure)
- Posts index deferred to future phase

### 8. Notifications (In-App + Email)
- **In-app:** course_assigned, certificate_earned, course_overdue notifications via existing notification system
- **Email:** Resend integration for critical events (course assigned, overdue 7d/1d, certificate earned)
- Email queue table with Vercel Cron processing
- New env var: `RESEND_API_KEY`

### 9. What We're NOT Building
- No learning paths or course prerequisites
- No gamification (badges, points, streaks, leaderboards)
- No SCORM/xAPI
- No drip content
- No assignments/file uploads
- No quiz timers
- No question banks or randomisation
- No public star ratings on course cards

---

## Design Direction

### Principles
- **Not jarring** — uses existing design system tokens, no new visual language
- **Welcoming** — clear labels, helpful empty states, friendly copy for non-tech-savvy staff
- **Accessible** — WCAG patterns (underlined links, tonal badges, contrast), keyboard-navigable
- **Consistent** — same card styles (`bg-card shadow-md rounded-xl`), same badge patterns (tonal fills), same tabs (`variant="line"`), same Lucide icons

### Key Design Decisions
- **Dashboard:** List-first (LinkedIn Learning pattern) — compliance alert → continue learning list → Tool Shed preview → action links. Not card grid.
- **Catalogue:** Algolia search bar above existing category tabs. Tabs act as facet refinements.
- **Lesson player sidebar:** Section-grouped with collapsible modules. Completed modules auto-collapse. LinkedIn-style checkmarks (green check done, blue dot current, grey circle pending, lock for locked).
- **Status badges:** Consistent tonal badges for section status (Complete=green, In Progress=blue, Locked=grey). Not mixed text+badge.
- **Lesson type indicators:** Text labels ("Video · 5 min", "Text · 4 min") with Lucide icons, not emoji.
- **Tool Shed feed:** Vertical card list (like Home news feed), format badges, filter pills.
- **Certificate wall:** Card grid with MCR-branded header strips.
- **Feedback dialog:** Modal with X close button + "Maybe later" dismiss. Shows once per course, never nags.

### Mockups
Interactive HTML mockups were created during planning:
- Part 1: Dashboard, Catalogue, Tool Shed, Certificates, Global Search
- Part 2: Course Detail, Lesson Player, Create Tool Shed, Feedback Dialog
- Available at `/tmp/mcr-learning-mockups.html` and `/tmp/mcr-learning-mockups-2.html` (serve via `python3 -m http.server 8899 --directory /tmp`)

---

## How It Integrates With the Wider Intranet

| Touchpoint | Change | Risk |
|------------|--------|------|
| **Header** (`src/components/layout/header.tsx`) | Add search icon → Cmd+K overlay | LOW |
| **Sidebar** (`src/components/layout/sidebar.tsx`) | Update Learning children: My Learning, Catalogue, Certificates, Tool Shed | LOW |
| **Home Feed** | Tool Shed entries cross-post as summary cards | LOW |
| **Profile** (`src/app/(protected)/hr/profile/page.tsx`) | Add "Learning" tab with certificates + progress | MEDIUM |
| **Manager Team View** (`src/app/(protected)/hr/team/page.tsx`) | Add compliance summary section | MEDIUM |
| **Notifications** | New notification types + Resend email integration | LOW-MEDIUM |
| **Algolia** (`src/lib/algolia.ts`) | Add COURSES_INDEX + multi-index search | LOW |

---

## Database Schema

### New Tables (8)
1. **`course_sections`** — Groups of lessons. FK→courses CASCADE. Has sort_order, is_active.
2. **`section_quizzes`** — One per section (UNIQUE section_id). Has passing_score.
3. **`section_quiz_questions`** — Questions with question_type (single/multi).
4. **`section_quiz_options`** — Answer options with is_correct flag.
5. **`section_quiz_attempts`** — User attempts with score, passed, answers JSONB.
6. **`certificates`** — Auto-generated. Snapshot of learner_name + course_title. certificate_number (MCR-YYYY-XXXXX). pdf_storage_path.
7. **`course_feedback`** — 5 structured fields. Anonymous (user_id hidden from L&D). UNIQUE(user_id, course_id).
8. **`tool_shed_entries`** — format (postcard/three_two_one/takeover), content JSONB, event_name, tags TEXT[], external_course_id FK.
9. **`email_notifications`** — Queue table for Resend. status (pending/sent/failed).

### Modified Tables
- `course_lessons` — ADD `section_id` UUID FK→course_sections
- `courses` — ADD `feedback_avg` NUMERIC(3,2), `feedback_count` INT
- `course_assignments` — ALTER CHECK to include 'user'

### Migrations (00060–00064)
5 migration files (consolidated from original 8). Clean slate — all old learning seed data deleted since no real users exist. No backward compatibility migration needed.

| Migration | File | Contents |
|-----------|------|----------|
| 00060 | `learning_overhaul_sections.sql` | Clean up old data, course_sections table, section_id on lessons, remove 'quiz' from lesson_type CHECK, section quiz tables (quizzes/questions/options/attempts), all RLS |
| 00061 | `learning_overhaul_certificates_feedback.sql` | Certificates table + number generator function, course_feedback table, feedback aggregate trigger, feedback columns on courses, certificates storage bucket, all RLS |
| 00062 | `learning_overhaul_tool_shed.sql` | tool_shed_entries table with JSONB content, GIN index on tags, all RLS |
| 00063 | `learning_overhaul_email_and_assignments.sql` | email_notifications queue table, ALTER course_assignments CHECK to add 'user', rewrite auto_enroll_from_assignment trigger for 'user' type |
| 00064 | `learning_overhaul_rpcs.sql` | Rewrite complete_lesson_and_update_progress for sections, new submit_section_quiz_attempt RPC, generate_certificate_on_completion trigger |

---

## Implementation Progress

### COMPLETED (Phase 1 — Foundation)
```
✅ 1. Migrations (00060-00064) — 5 files, all schema + RLS + RPCs + triggers
      Applied to production Supabase via SQL Editor (19 Mar 2026).
✅ 2. Shared utilities:
      - learning.ts — expanded: section types, Tool Shed format config, section-aware
        progress logic (getLockedSectionIds, calculateSectionProgress), lesson type
        config, duration formatting, notification type config, postcard field config
      - algolia.ts — extended: COURSES_INDEX, AlgoliaCourseRecord, indexCourse(),
        removeCourseFromIndex()
      - certificates.ts — NEW: CertificateDocument component, generateCertificatePdf()
        using @react-pdf/renderer
      - email.ts — NEW: Resend client, MCR-branded email templates
        (course assigned, overdue, certificate earned), sendEmail()
✅ 3. Section server actions:
      - section-actions.ts — NEW: full CRUD for sections, section quizzes, quiz
        questions, quiz options (with reorder support)
      - actions.ts — MODIFIED: createLesson now requires section_id, publishCourse
        validates sections + section quizzes instead of quiz-as-lesson
```

### COMPLETED (Phase 2 — Admin UI)
```
✅ 4. Admin UI components:
      - section-manager.tsx — NEW (~350 lines): expandable section panels with
        create/edit/delete dialogs, chevron up/down reorder, collapsible body
        containing LessonManager + SectionQuizEditor per section
      - section-quiz-editor.tsx — NEW (~500 lines): per-section quiz editor with
        quiz CRUD, question/option editor (single/multi choice), inline editing,
        quiz metadata row (title, passing score, active toggle)
      - lesson-manager.tsx — MODIFIED: added sectionId prop, removed Card wrapper
        (SectionManager provides container), removed quiz lesson type
      - lesson-edit-dialog.tsx — MODIFIED: added sectionId prop, removed quiz
        Content Type option and passing score field
      - page.tsx (admin course detail) — REWRITTEN: section-based data fetching
        (sections → quizzes → questions → options → images), assembles
        CourseSectionWithDetails[], replaced LessonManager+QuizEditor with
        single SectionManager component
      - section-actions.ts — EXTENDED: added createSectionQuizQuestionWithOptions
        and updateSectionQuizQuestionWithOptions (combined question+options
        insert/update with validation and rollback)
      - database.types.ts — MODIFIED: LessonType "quiz" removed, section_id added
        to CourseLesson, 6 manual section types added (CourseSection, SectionQuiz,
        SectionQuizQuestion, SectionQuizOption, SectionQuizQuestionWithOptions,
        CourseSectionWithDetails)

      Also fixed knock-on effects from LessonType change:
      - lesson-list.tsx — removed quiz from Record<LessonType> maps
      - lesson-sidebar.tsx — removed quiz from icon map, removed HelpCircle import
      - lesson player page.tsx — removed dead quiz code (will be rewritten in PR 3)
      - mark-complete-button.tsx — removed dead quiz branch
      - certificates.ts — fixed @react-pdf/renderer type error (pre-existing)

      Verified: build passes, lint clean, all CRUD tested live (create section,
      create lesson within section, create section quiz, create quiz question
      with options — all working against production Supabase).
```

### REMAINING (Phase 3 — Learner UI + remaining features)
```
⬜ 5. Learner UI components:
      - section-accordion.tsx — expandable sections in course detail
      - section-quiz-player.tsx — section quiz UI (adapted from quiz-player)
      - lesson-sidebar.tsx — REWRITE: section-grouped, collapsible, LinkedIn-style
        checkmarks (green check done, blue dot current, grey circle pending)
      - section-progress-indicator.tsx
      - Update course detail page, lesson player page
      - New route: /learning/courses/[id]/sections/[sectionId]/quiz

⬜ 6. Certificate system:
      - certificate-card.tsx, certificate-download-button.tsx
      - /learning/certificates page (certificate wall)
      - /learning/certificates/[id] page
      - /api/certificates/[id]/pdf API route
      - certificates/actions.ts

⬜ 7. Course feedback:
      - course-feedback-dialog.tsx (5 structured fields, X close + "Maybe later")
      - feedback-dashboard.tsx (admin: aggregates + anonymous comments + CSV)
      - Show dialog once after course completion, never nag

⬜ 8. Tool Shed rewrite:
      - tool-shed-entry-card.tsx, tool-shed-filter-bar.tsx
      - tool-shed-create-form.tsx + postcard/321/takeover sub-forms
      - tool-shed-entry-detail.tsx
      - /learning/tool-shed page (complete rewrite: social feed)
      - /learning/tool-shed/new, /[id], /[id]/edit pages
      - tool-shed/actions.ts
      - Admin: tool-shed-admin-table.tsx + /learning/admin/tool-shed page

⬜ 9. Algolia course search:
      - course-search.tsx (InstantSearch for catalogue)
      - Update /learning/courses page to include search bar above tabs
      - Index courses on publish, remove on unpublish

⬜ 10. Global Cmd+K search:
      - global-search.tsx (multi-index overlay in header)
      - Update header.tsx to add search icon

⬜ 11. Integrations:
      - sidebar.tsx — update Learning children
      - Profile page — add Learning tab
      - Team page — add compliance summary
      - Notification RPCs for learning events

⬜ 12. Dashboard redesign:
      - /learning page — list-first layout
      - Final polish, consistency pass
```

### PR Strategy (Small PRs)
- **PR 1:** ✅ Migrations + utilities + section actions (DONE, on branch `feature/learning-overhaul-migrations`)
- **PR 2:** ✅ Admin UI (section manager, quiz editor, course detail page) — DONE, same branch
- **PR 3:** Learner UI (section accordion, sidebar rewrite, quiz player)
- **PR 4:** Certificates (pages, PDF, actions)
- **PR 5:** Feedback (dialog, admin dashboard)
- **PR 6:** Tool Shed (full rewrite)
- **PR 7:** Algolia search + global Cmd+K
- **PR 8:** Integrations (profile, team, sidebar, notifications)
- **PR 9:** Dashboard redesign + polish

Steps 5–8 can be parallelised after step 4.

---

## New Dependencies
- `@react-pdf/renderer` — PDF certificate generation
- `resend` — Email delivery

## New Environment Variables
- `RESEND_API_KEY` — Server-only, Resend email API key

---

## Key Architectural Patterns (From CLAUDE.md)

- Server Components fetch data → pass props to Client Components
- Server Actions for all mutations (in `actions.ts` files)
- `getCurrentUser()` for auth, `requireLDAdmin()` for admin actions
- Explicit SELECT columns, never `select("*")`
- Whitelist fields in server actions before DB writes
- Idempotent migrations with IF NOT EXISTS
- TEXT + CHECK constraints, not PostgreSQL ENUMs
- British English in all user-facing text
- `bg-card` for inputs/modals, `bg-background` for page
- Badge tonal fills (success/warning/destructive/muted), not solid
- `set search_path = ''` on SECURITY DEFINER functions

---

## Tool Shed Content JSON Structures

### Digital Postcard
```json
{
  "elevator_pitch": "In two sentences, what was the training about?",
  "lightbulb_moment": "What was the one thing that made you go 'Aha!'?",
  "programme_impact": "How does this help us support young people, mentors, or colleagues better?",
  "golden_nugget": "One resource, website, or technique we should all try."
}
```

### 3-2-1 Model
```json
{
  "three_learned": ["Thing 1", "Thing 2", "Thing 3"],
  "two_changes": ["Change 1", "Change 2"],
  "one_question": "One question the training raised"
}
```

### 10-Minute Takeover
```json
{
  "useful_things": ["Most useful thing 1", "Most useful thing 2", "Most useful thing 3"]
}
```

---

## Key Implementation Details

### Clean Slate Decision
- **No real users exist** — all learning data is seed/test data
- Migration 00060 DELETEs all rows from learning tables before restructuring
- No backward compatibility migration needed (no default sections, no quiz migration)
- Old quiz tables (`quiz_questions`, `quiz_options`, `quiz_attempts`) still exist structurally but are empty and unused
- `lesson_type` CHECK changed from `('video', 'text', 'quiz')` to `('video', 'text')` — quizzes now section-level only

### Files Created/Modified So Far

**New files (PR 1 — Foundation):**
- `supabase/migrations/00060_learning_overhaul_sections.sql`
- `supabase/migrations/00061_learning_overhaul_certificates_feedback.sql`
- `supabase/migrations/00062_learning_overhaul_tool_shed.sql`
- `supabase/migrations/00063_learning_overhaul_email_and_assignments.sql`
- `supabase/migrations/00064_learning_overhaul_rpcs.sql`
- `src/lib/certificates.ts`
- `src/lib/email.ts`
- `src/app/(protected)/learning/admin/courses/section-actions.ts`
- `docs/learning-overhaul.md`

**New files (PR 2 — Admin UI):**
- `src/components/learning-admin/section-manager.tsx` (~350 lines)
- `src/components/learning-admin/section-quiz-editor.tsx` (~500 lines)

**Modified files (PR 1):**
- `src/lib/learning.ts` (55→250 lines: added section logic, Tool Shed config, duration formatting)
- `src/lib/algolia.ts` (162→250 lines: added COURSES_INDEX, course indexing)
- `src/app/(protected)/learning/admin/courses/actions.ts` (createLesson now requires section_id, publishCourse validates sections)
- `package.json` (added @react-pdf/renderer, resend)

**Modified files (PR 2):**
- `src/types/database.types.ts` (LessonType "quiz" removed, section_id added, 6 section types)
- `src/app/(protected)/learning/admin/courses/section-actions.ts` (added 2 combined quiz actions)
- `src/app/(protected)/learning/admin/courses/[id]/page.tsx` (rewritten for section-based data)
- `src/components/learning-admin/lesson-manager.tsx` (sectionId prop, removed Card wrapper)
- `src/components/learning-admin/lesson-edit-dialog.tsx` (sectionId prop, removed quiz option)
- `src/app/(protected)/learning/courses/[id]/lesson-list.tsx` (removed quiz from type maps)
- `src/components/learning/lesson-sidebar.tsx` (removed quiz from icon map)
- `src/app/(protected)/learning/courses/[id]/lessons/[lessonId]/page.tsx` (removed dead quiz code)
- `src/app/(protected)/learning/courses/[id]/lessons/[lessonId]/mark-complete-button.tsx` (removed dead quiz branch)
- `src/lib/certificates.ts` (fixed @react-pdf/renderer type error)

### Existing Files That Still Need Modification
- `src/components/layout/header.tsx` — add search icon for Cmd+K
- `src/components/layout/sidebar.tsx` (lines 103-122) — update Learning children (add Certificates, rename Tool Shed)
- `src/components/learning/lesson-sidebar.tsx` — full rewrite for section-grouped layout with LinkedIn-style checkmarks
- `src/components/learning/quiz-player.tsx` — adapt for section quizzes (or create new `section-quiz-player.tsx`)
- `src/app/(protected)/learning/page.tsx` — dashboard redesign (list-first, compliance alerts, continue learning)
- `src/app/(protected)/learning/courses/page.tsx` — add Algolia search bar above category tabs
- `src/app/(protected)/learning/courses/[id]/page.tsx` — sections accordion (expandable sections with progress)
- `src/app/(protected)/learning/courses/[id]/lessons/[lessonId]/page.tsx` — add section context (which section this lesson belongs to)
- `src/app/(protected)/learning/tool-shed/page.tsx` — complete rewrite (social learning feed, not static resources)
- `src/app/(protected)/learning/my-courses/page.tsx` — add Certificates tab
- `src/app/(protected)/learning/admin/reports/page.tsx` — add feedback/certs/tool shed tabs
- `src/app/(protected)/hr/profile/page.tsx` — add Learning tab (certificates + course progress)
- `src/app/(protected)/hr/team/page.tsx` — add compliance summary for line managers

**Already done (PR 2):**
- ~~`src/components/learning-admin/lesson-manager.tsx`~~ — sectionId prop added, Card wrapper removed
- ~~`src/app/(protected)/learning/admin/courses/[id]/page.tsx`~~ — rewritten with SectionManager

---

## How to Continue (Handover Guide)

### Current State
- **Branch:** `feature/learning-overhaul-migrations` — all Phase 1 + Phase 2 work is here (not yet merged to main)
- **Database:** All 5 migrations (00060-00064) have been applied to production Supabase. All old learning seed data was deleted (no real users existed).
- **What works now:** Admin can create courses, add sections to courses, add lessons to sections, create section quizzes with questions/options. All CRUD verified against live database.
- **What doesn't work yet:** Learner-side course detail page shows flat lesson list (no sections), lesson sidebar has no section grouping, quiz player doesn't support section quizzes, no certificates UI, no feedback dialog, Tool Shed is still hardcoded static content, no global search.
- **Open PRs:** None. The branch has not been submitted as a PR yet — it needs PR 3+ work before the learner experience is functional.

### Recommended Next Steps (in order)

**PR 3: Learner UI** (HIGHEST PRIORITY — makes the section structure visible to learners)
1. Create `section-accordion.tsx` — expandable sections on course detail page with progress indicators
2. Rewrite `lesson-sidebar.tsx` — section-grouped with collapsible modules, LinkedIn-style checkmarks (green check done, blue dot current, grey circle pending, lock icon for locked)
3. Create `section-quiz-player.tsx` — section quiz UI, adapted from existing `quiz-player.tsx` but calling `submit_section_quiz_attempt` RPC
4. Create route `/learning/courses/[id]/sections/[sectionId]/quiz`
5. Update course detail page (`/learning/courses/[id]/page.tsx`) to show sections accordion
6. Update lesson player page to show section context
7. Use existing utilities: `getLockedSectionIds()` and `calculateSectionProgress()` from `src/lib/learning.ts`

**PR 4: Certificates**
1. Create `certificate-card.tsx`, `certificate-download-button.tsx`
2. Create `/learning/certificates` page (certificate wall: internal + external certs)
3. Create `/learning/certificates/[id]` page
4. Create `/api/certificates/[id]/pdf` API route (uses `generateCertificatePdf()` from `src/lib/certificates.ts`)
5. Create `certificates/actions.ts`

**PR 5: Course Feedback**
1. Create `course-feedback-dialog.tsx` — 5 structured fields, shows once after completion
2. Create `feedback-dashboard.tsx` — admin aggregates + anonymous comments + CSV export
3. Wire into course completion flow

**PR 6: Tool Shed** (can be done in parallel with PR 4-5)
1. Complete rewrite of `/learning/tool-shed` page — social learning feed
2. Create entry form with 3 format sub-forms (Postcard, 3-2-1, Takeover)
3. Create admin management page
4. Create `tool-shed/actions.ts`
5. See "Tool Shed Content JSON Structures" section above for JSONB formats

**PR 7: Algolia Search + Global Cmd+K**
1. Create `course-search.tsx` with InstantSearch for catalogue
2. Create `global-search.tsx` (Cmd+K overlay in header)
3. Index courses on publish via `indexCourse()` from `src/lib/algolia.ts`

**PR 8: Integrations**
1. Update sidebar children for Learning module
2. Add Learning tab to HR profile page
3. Add compliance summary to team page for line managers
4. Wire notification RPCs for learning events

**PR 9: Dashboard Redesign + Polish**
1. Redesign `/learning` page — list-first layout (LinkedIn Learning pattern)
2. Final consistency pass across all learning pages

### Key Files to Read First
1. **This document** — you're reading it
2. `CLAUDE.md` — all project-wide patterns, coding conventions, lessons learned (READ THIS THOROUGHLY — it has ~200 lessons)
3. `src/lib/learning.ts` — all section-aware types, configs, utility functions
4. `src/app/(protected)/learning/admin/courses/section-actions.ts` — all section server actions (reference for patterns)
5. `src/components/learning-admin/section-manager.tsx` — the admin UI pattern (reference for building learner UI)
6. `src/components/learning-admin/section-quiz-editor.tsx` — quiz editor pattern
7. `docs/design-system.md` — colour tokens, badge variants, card styles (always read before doing UI work)
8. `src/lib/auth.ts` — auth helpers: `getCurrentUser()`, `requireHRAdmin()`, `requireLDAdmin()`, `isLDAdminEffective()`

### All Section Server Actions (section-actions.ts)
The next developer should know all 16 exported functions:

**Section CRUD:** `createSection`, `updateSection`, `deleteSection`, `reorderSections`
**Quiz CRUD:** `createSectionQuiz`, `updateSectionQuiz`, `deleteSectionQuiz`
**Question CRUD:** `createSectionQuizQuestion`, `updateSectionQuizQuestion`, `deleteSectionQuizQuestion`
**Option CRUD:** `createSectionQuizOption`, `updateSectionQuizOption`, `deleteSectionQuizOption`
**Combined (use these for UI):** `createSectionQuizQuestionWithOptions`, `updateSectionQuizQuestionWithOptions` — insert/update question + all options atomically with validation and rollback
**Reorder:** `reorderSectionQuizQuestions`

All actions use `requireLDAdmin()` for auth, whitelist fields before DB writes, return `{ success, error }`, and call `revalidatePath()` for the admin + learner routes.

### Learning.ts Utilities (critical for PR 3)
These are the functions the next developer MUST use for learner UI:

- `getLockedSectionIds(sections, passedQuizSectionIds, sectionsWithQuizzes)` — determines which sections are locked based on unpassed quizzes. **Use this**, not the deprecated `getLockedLessonIds()`.
- `calculateSectionProgress(completedLessonCount, totalLessonCount, passedQuizCount, totalQuizCount)` — returns progress percentage including quiz completion.
- `lessonProgressIcons` — `{ completed: CheckCircle2, current: Circle, pending: Circle, locked: Lock }` for the sidebar.
- `categoryConfig` — course category labels/icons/colours (compliance, upskilling, soft_skills).
- `lessonTypeConfig` — lesson type labels/icons (video, text). NOTE: "quiz" was removed — quizzes are section-level now.
- `formatDuration(minutes)` — "45 min", "1h 30 min", "2h".

### PR 3 Specific Notes (Learner UI)

**Quiz Player Adaptation:**
The current `src/components/learning/quiz-player.tsx` (285 lines) needs these changes for section quizzes:
- Takes `lessonId` + `courseId` → change to `quizId` (section_quiz ID) + `courseId`
- Calls `submitQuiz()` server action → change to call `submit_section_quiz_attempt` RPC (already in migration 00064)
- Current quiz is optional per lesson → section quiz GATES progression (blocks next section until passed)
- Options are fetched with `is_correct: false` for security (scoring is server-side via the RPC)
- Create as a new `section-quiz-player.tsx`, don't modify the old one (it may be needed for reference)

**Lesson Sidebar Rewrite:**
The current `src/components/learning/lesson-sidebar.tsx` (132 lines) has NO section awareness:
- Flat lesson list, no section grouping
- Uses deprecated `getLockedLessonIds()` — must switch to `getLockedSectionIds()`
- No concept of "sections are collapsible" or "LinkedIn-style checkmarks"
- This is a **complete structural rewrite**, not a patch — build from scratch

**Course Detail Page Changes (Learner):**
The current `src/app/(protected)/learning/courses/[id]/page.tsx` fetches: `courses`, `course_enrolments`, `course_lessons`, `lesson_completions`.
For PR 3, also fetch: `course_sections`, `section_quizzes`, `section_quiz_attempts`.
Group lessons by `section_id`, calculate per-section progress, determine locked sections.

### RLS Access Model for Section Tables
- **course_sections:** Authenticated users see active sections in active courses. L&D + HR admins manage all.
- **section_quizzes:** Authenticated users see active quizzes in active sections/courses. L&D + HR admins manage all.
- **section_quiz_questions/options:** Authenticated users see questions for active quizzes. L&D + HR admins manage all.
- **section_quiz_attempts:** Users see own attempts, can insert own. L&D + HR admins see all.

### Database Migration Notes
- **Migrations 00060-00064 are already applied to production Supabase** (applied 19 Mar 2026 via SQL Editor).
- If setting up a fresh local Supabase instance, run these migrations first before testing any learning features.
- The Supabase PostgREST schema cache may need refreshing after applying migrations — use the Supabase dashboard to reload schema if `.select()` queries return null for new columns/tables.
- All old learning seed data was deleted in migration 00060. The database is clean — no legacy courses/lessons/quizzes exist.

### Important Patterns
- **Server Components fetch data → pass props to Client Components** (never fetch in client)
- **Server Actions for all mutations** — in `actions.ts` or `section-actions.ts` files with `"use server"` directive
- **`getCurrentUser()` for auth**, `requireLDAdmin()` for admin-only actions (from `src/lib/auth.ts`)
- **Whitelist fields before DB writes** — never pass raw input to `.update()`
- **British English** in all user-facing text (colour, organise, catalogue, etc.)
- **Tonal badges** — `bg-{colour}-50 text-{colour}-700`, never solid fills
- **Chrome MCP for browser verification**, preview tools only for starting/stopping dev server
- **Always run `npm run build` before committing** — catches type errors that lint misses
- **All exports in "use server" files must be async** — sync exports cause Vercel deployment failures
- **Never use `select("*")`** — always use explicit column lists. Use `PROFILE_SELECT` for profile queries.
- **Changing a union type breaks downstream files** — grep entire `src/` before modifying union types like `LessonType`

### Environment Variables Needed
- `NEXT_PUBLIC_SUPABASE_URL` — already set
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — already set
- `SUPABASE_SERVICE_ROLE_KEY` — already set
- `RESEND_API_KEY` — **NOT YET SET** (needed for email notifications in PR 8)
- `NEXT_PUBLIC_ALGOLIA_APP_ID` — already set (`CFRPCC52U5`)
- `NEXT_PUBLIC_ALGOLIA_SEARCH_KEY` — already set
- `ALGOLIA_ADMIN_KEY` — already set

## Verification Checklist

- [x] All 5 migrations run successfully on Supabase (applied 19 Mar 2026)
- [x] Create course with sections (admin)
- [x] Create lessons within sections (admin)
- [x] Create section quiz with questions + options (admin)
- [x] Build passes with no type errors
- [x] Lint passes with no new errors
- [ ] Enrol, complete sections, verify quiz gates progression
- [ ] Complete course → certificate auto-generates
- [ ] Download certificate PDF
- [ ] Submit course feedback (verify anonymous)
- [ ] Create Tool Shed entries in all 3 formats
- [ ] Browse + filter Tool Shed feed
- [ ] Assign course to individual user → verify notification
- [ ] Cmd+K search across courses + resources
- [ ] Certificate wall shows internal + external certs
- [ ] Profile Learning tab shows data
- [ ] Manager team compliance view works
- [ ] All components keyboard-navigable
- [ ] WCAG AA contrast passes

## Lessons Learned During This Session

1. **No real users simplifies everything.** Migration complexity dropped by 60% when we confirmed no real users exist — no backward compat, no data migration, clean slate.
2. **Separate action files for large features.** Created `section-actions.ts` alongside `actions.ts` rather than growing the 888-line file further.
3. **Mockups must mirror the real app.** Standalone HTML mockups were rejected — had to use the real intranet's sidebar, header, and design tokens for the user to evaluate direction.
4. **Consistency audit before implementation.** Found 6 inconsistencies across mockups (mixed text/badge status, broken emoji icons, naming mismatches). Catching these during design prevented code rework.
5. **The user wants research-backed decisions.** Don't present options without explaining what top platforms do. Always cite LinkedIn Learning, Coursera, etc. when recommending UI patterns.
6. **Changing a union type has widespread knock-on effects.** Removing `"quiz"` from `LessonType` broke 4 learner-side files that had `Record<LessonType>` maps or `=== "quiz"` comparisons. Always grep for the type across the entire `src/` directory before changing a union.
7. **Combined server actions prevent orphaned DB records.** Creating a quiz question and its options in separate calls risks orphaned questions if the options call fails. Adding `createSectionQuizQuestionWithOptions` (question + options in one call with rollback) matches the existing `createQuizQuestion` pattern and avoids multi-call orchestration in the client.
8. **Run migrations immediately after writing admin UI, not after merging.** The admin UI couldn't be tested until migrations were applied. Running them via Supabase SQL Editor enabled end-to-end verification before committing.
9. **Simple state-driven expand/collapse beats Radix Accordion.** A `Set<string>` for expanded section IDs + `ChevronRight` rotation is simpler than adding `@radix-ui/react-accordion` as a dependency. Works well for the section manager's needs.
