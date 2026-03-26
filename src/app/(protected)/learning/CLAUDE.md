# Learning Module

Course management, section-level quizzes, Tool Shed social learning, and admin builder.

## Architecture

**Learning module uses section-level quizzes, not lesson-level.** The `lesson_type` CHECK is `('video', 'text', 'slides', 'rich_text')`. Quizzes live in `section_quizzes` table (one per section), not as a lesson type. The section quiz gates progression to the next section. See migrations 00060-00065.

**Course feedback is private to L&D, not public ratings.** The `course_feedback` table stores 5 structured fields (overall, relevance, clarity, duration, free text). User_id is stored for dedup (UNIQUE constraint) but hidden from L&D reports. No star ratings on catalogue cards.

**Tool Shed is a social learning framework, NOT a resource library.** Based on MCR Pathways Social Learning Framework. Staff share insights from external training via structured formats (Digital Postcards, 3-2-1 Model, 10-Minute Takeover). Content stored as JSONB in `tool_shed_entries`. Key files: 6 components in `src/components/tool-shed/`, server actions in `tool-shed/actions.ts`, config in `src/lib/learning.ts`.

## Security

**Never expose quiz `is_correct` to the client before submission.** Strip `is_correct` from the client query; return correct answers server-side only after submission via server action.

## Design Patterns

**Snapshot columns on normalised data are usually YAGNI.** Only snapshot if you genuinely hard-delete the source records. The certificates table JOINs to profiles + courses.

**Prefer simple logs over queues until you need retry.** Resend handles email retry. Start with a log; add queueing when you have evidence of failures.

**When parallel implementations exist, assess each design decision independently.** Don't blanket "keep ours" or "take theirs." Evaluate each area on its merits.

## Tool Shed UX

**Give the "Golden Nugget" (most actionable item) distinct visual treatment.** Use a tinted background while others use whitespace + border separators.

**Use specific, inspiring placeholder text, not generic numbered prompts.** Each placeholder should prompt a different angle of reflection: "A key concept or idea that stuck with you...", "Something that challenged your thinking...", "A practical tip the team can use straightaway...".

**Don't show unbounded user-generated data as top-level UI.** Make tags on cards clickable to activate a filter, show a dismissible "Filtered by: tag x" indicator only when active.

## Email Notifications

Phase D (PR #175) is DORMANT until Resend account setup (`RESEND_API_KEY` + `CRON_SECRET` + domain verification). Queue + Cron + preferences + 11 email types across L&D/HR/Intranet.
