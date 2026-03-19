# Learning & Development Module — Full Overhaul Handover Document

> **Created:** 19 March 2026
> **Author:** Abdulmuiz Adaranijo + Claude Code
> **Branch:** `feature/learning-overhaul`
> **Plan file:** `.claude/plans/virtual-splashing-hippo.md`
> **Status:** Implementation in progress (Phase 1 complete — schema + utilities + actions)
> **Branch:** `feature/learning-overhaul-migrations`
> **Commits:** 2 commits (3,168 lines added)

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

### REMAINING (Phase 2 — UI Components, need new session)
```
⬜ 4. Admin UI components:
      - section-manager.tsx — CRUD sections with drag-reorder
      - section-lesson-manager.tsx — manage lessons within a section
      - section-quiz-editor.tsx — section quiz question/option editor
      - Update admin course detail page to use sections layout

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
- **PR 2:** Admin UI (section manager, quiz editor, course detail page)
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
**New files:**
- `supabase/migrations/00060_learning_overhaul_sections.sql`
- `supabase/migrations/00061_learning_overhaul_certificates_feedback.sql`
- `supabase/migrations/00062_learning_overhaul_tool_shed.sql`
- `supabase/migrations/00063_learning_overhaul_email_and_assignments.sql`
- `supabase/migrations/00064_learning_overhaul_rpcs.sql`
- `src/lib/certificates.ts`
- `src/lib/email.ts`
- `src/app/(protected)/learning/admin/courses/section-actions.ts`
- `docs/learning-overhaul.md`

**Modified files:**
- `src/lib/learning.ts` (55→250 lines: added section logic, Tool Shed config, duration formatting)
- `src/lib/algolia.ts` (162→250 lines: added COURSES_INDEX, course indexing)
- `src/app/(protected)/learning/admin/courses/actions.ts` (createLesson now requires section_id, publishCourse validates sections)
- `package.json` (added @react-pdf/renderer, resend)

### Existing Files That Still Need Modification (for new session)
- `src/components/layout/header.tsx` — add search icon
- `src/components/layout/sidebar.tsx` (lines 103-122) — update Learning children
- `src/components/learning/lesson-sidebar.tsx` — full rewrite for sections
- `src/components/learning/quiz-player.tsx` — adapt for section quizzes (or create new)
- `src/components/learning-admin/lesson-manager.tsx` — section-grouped view
- `src/app/(protected)/learning/page.tsx` — dashboard redesign
- `src/app/(protected)/learning/courses/page.tsx` — add Algolia search
- `src/app/(protected)/learning/courses/[id]/page.tsx` — sections accordion
- `src/app/(protected)/learning/courses/[id]/lessons/[lessonId]/page.tsx` — section context
- `src/app/(protected)/learning/tool-shed/page.tsx` — complete rewrite
- `src/app/(protected)/learning/my-courses/page.tsx` — add Certificates tab
- `src/app/(protected)/learning/admin/courses/[id]/page.tsx` — section manager UI
- `src/app/(protected)/learning/admin/reports/page.tsx` — add feedback/certs/tool shed tabs
- `src/app/(protected)/hr/profile/page.tsx` — add Learning tab
- `src/app/(protected)/hr/team/page.tsx` — add compliance summary

## Verification Checklist

- [ ] All 5 migrations run successfully on local Supabase
- [ ] Create course with multiple sections + quizzes (admin)
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
