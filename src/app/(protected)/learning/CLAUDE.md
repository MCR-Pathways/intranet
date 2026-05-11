# Learning Module

Course management, section-level quizzes, and admin builder.

## Architecture

**Learning module uses section-level quizzes, not lesson-level.** The `lesson_type` CHECK is `('video', 'text', 'slides', 'rich_text')`. Quizzes live in `section_quizzes` table (one per section), not as a lesson type. The section quiz gates progression to the next section. See migrations 00060-00065.

**Course feedback is private to L&D, not public ratings.** The `course_feedback` table stores 5 structured fields (overall, relevance, clarity, duration, free text). User_id is stored for dedup (UNIQUE constraint) but hidden from L&D reports. No star ratings on catalogue cards.

## Security

**Never expose quiz `is_correct` to the client before submission.** Strip `is_correct` from the client query; return correct answers server-side only after submission via server action.

## Design Patterns

**Snapshot columns on normalised data are usually YAGNI.** Only snapshot if you genuinely hard-delete the source records. The certificates table JOINs to profiles + courses.

**Prefer simple logs over queues until you need retry.** Resend handles email retry. Start with a log; add queueing when you have evidence of failures.

**When parallel implementations exist, assess each design decision independently.** Don't blanket "keep ours" or "take theirs." Evaluate each area on its merits.

## Course Detail Page

**Fetch data conditionally based on user enrolment state.** The course detail page fetches completions, quiz attempts, and builds sectionAccordionData — but unenrolled users only need section names and quiz indicators for the syllabus preview. Always-fetch-and-ignore-empty is architecturally wrong even when fast. Split into: always-fetch (sections, quizzes) and enrolled-only (completions, attempts, accordion data).

## Certificates

**Include charity registration on certificates.** "MCR Pathways is a SCIO regulated by OSCR, Scottish Charity SC045816" in small text at the bottom. Adds legitimacy for a registered charity. Cherry-picked from NSPCC Learning certificate design.

## Email Notifications

Phase D is ACTIVE. Emails send immediately via Resend. Colour-coded headers by type (green/amber/red/blue/wine), XSS-safe templates, branded logo, preheaders, welcome email. Email preview at `/api/email-preview?type=X` (dev only). 11 email types, preferences UI on Settings page. L&D triggers: `course_assigned` (admin assigns), `course_completed` and `certificate_earned` (learner finishes), `course_overdue_digest` and `course_overdue_manager` (daily cron).


## Buttons

Button rules live in `docs/button-system.md` (single source of truth for variants, sizes, label casing, a11y, helpers, per-context patterns). Never put `h-X w-X` on a Button `className` — use the `size` prop; an ESLint rule enforces this.
