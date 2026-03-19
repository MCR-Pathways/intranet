# Learning & Development Module — Full Overhaul Handover Document

> **Created:** 19 March 2026
> **Author:** Abdulmuiz Adaranijo + Claude Code
> **Branch:** `feature/learning-overhaul`
> **Plan file:** `.claude/plans/virtual-splashing-hippo.md`
> **Status:** Planning complete, implementation starting

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
- Existing quiz-as-lesson-type data will be migrated to section quizzes

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

### Migrations (00060–00067)
Must run in order. Key data migrations in 00060 (create default sections for existing courses, move lessons into them) and 00061 (migrate quiz lessons to section quizzes).

---

## Implementation Order

```
1.  Migrations (schema foundation)
2.  Shared utilities (learning.ts, algolia.ts, certificates.ts, email.ts)
3.  Section-based course builder (admin)
4.  Section-based learner experience (sidebar, accordion, quiz player)
5.  Certificates (PDF generation, wall page)
6.  Course feedback (dialog, admin dashboard)
7.  Tool Shed rewrite (feed, create form, admin)
8.  Individual assignment + Algolia course search
9.  Global search (header Cmd+K overlay)
10. Profile + Manager integration
11. Notifications + email (Resend)
12. Dashboard redesign + navigation updates (final polish)
```

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

## Verification Checklist

- [ ] All 8 migrations run successfully on local Supabase
- [ ] Existing courses have "Default Section" with all lessons migrated
- [ ] Quiz lessons migrated to section quizzes, old data preserved
- [ ] Existing progress_percent values unchanged
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
- [ ] Existing courses still work (backward compatibility)
- [ ] All components keyboard-navigable
- [ ] WCAG AA contrast passes
