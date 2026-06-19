# Publishing LMS-hub courses into the intranet Learning module

- **Date:** 2026-06-19
- **Status:** Design — approved for planning
- **Author:** Colin Adam (with Claude)
- **Repos affected:** `intranet` (primary), `mcr-resources` / Chat Supabase project (publish-side change)

## Summary

mcr-resources is the central LMS hub: courses are authored there (via Sparky Studio)
into the shared **Chat** Supabase project (`lurydmkwfcpstmupolvm`) as
`content_collections` / `content_items` / `content_item_options`. Today those courses
surface in **mcr-mentor-portal**, which reads the same Chat project directly with an anon
query filtered by `status='published' AND is_public=true`.

This design adds a second consumer: the **intranet**. A course can be explicitly
published to the intranet, where it appears in the existing **Learning module** for staff,
renders with full fidelity via a ported Sparky course player, and — on completion — flows
through the intranet's existing certificate + email + notification pipeline.

## Background and the key constraint

The mentor-portal integration was **not** a real "publish" — the portal and mcr-resources
**share one Supabase project**, so "publishing" is just flipping status flags that an anon
read already honours.

The intranet is a **separate Supabase project** with its own ~99 migrations and a distinct
schema (`posts`, `resource_articles`, `courses`/`course_sections`/`course_lessons`,
`course_enrolments`, `certificates`). It has **no** `content_*` tables. So the portal trick
cannot be reused verbatim — the intranet needs a genuine cross-project mechanism.

Two existing intranet facts shape the design:

1. **The Learning module already has a native completion → certificate pipeline.** Setting
   `course_enrolments.status = 'completed'` fires the `trg_auto_issue_certificate` trigger
   (migration `00067`), which inserts a `certificates` row; completion notifications
   (`00068`) and emails (`00063`) follow. We drive this pipeline rather than rebuild it.
2. **`external_courses` (migration `00021`) is unrelated.** It is a self-reported CPD log
   ("I completed a course elsewhere"). We do **not** reuse that table or name. Hub courses
   are first-class `courses` rows.

## Goals

- An author in Sparky can explicitly choose to publish a course to the intranet.
- Published "hub" courses appear in the intranet Learning catalogue alongside native courses
  and behave natively (assignment, required flags, due dates, reporting).
- The course body renders **faithfully** — all ~16 Sparky `content_item` component types
  (section headers, video, text, multiple-choice / multi-select / yes-no / ordering quizzes,
  flashcards, card carousels, interactive tiles, accordions, scenario decks, feature lists,
  callouts, contact lists, completion blocks).
- On completion, the learner gets the intranet's native PDF certificate, completion email,
  and notification — with no new completion tables.
- The Chat project remains the single source of truth for course content; no body content is
  duplicated into the intranet.

## Non-goals (explicitly out of scope)

- **Salesforce write-back** (the portal's safeguarding-token pre-match path). Intranet staff
  completion is recorded natively only.
- **Full-text search of course bodies** in the intranet's Algolia index. Bodies live in the
  Chat DB; only the shell's title/description are searchable. (Accepted trade-off of "read
  live".)
- **A shared player npm package.** We port-and-adapt the player now; extract a shared package
  later only if a third consumer appears (YAGNI).
- **Converting Sparky content into native `course_lessons`.** Rejected — lossy and drift-prone.
- **Editing hub courses inside the intranet.** Authoring stays in mcr-resources.

## Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Target surface | Intranet **Learning module** | Deepest native integration; reuses catalogue, assignment, certificates. |
| 2 | Rendering fidelity | **Port the Sparky player** | Preserves the authored experience; no lossy mapping to the 4 native lesson types. |
| 3 | Source of truth | **Read content live from Chat DB**; completion intranet-owned | Single source of truth, no body duplication, no drift. |
| 4 | Publish control | **Explicit `destinations` in Sparky** | Truest to "the LMS publishes to the intranet"; deliberate per-destination control. |
| 5 | Completion model | **Whole-course completion + native certificate** | Player tracks progress client-side; server records one completion. |
| 6 | Completion storage | **Reuse `course_enrolments` + `certificates`** (no new tables) | The auto-issue trigger already does the work; hub courses behave like native ones. |
| 7 | Cross-DB read auth | **Dedicated read-only role** on the Chat project, server-side only | Least privilege; content never anon-readable (staff system). |

## Architecture

Three parts: the publish act (Chat side), the bridge (reconciliation), and the intranet
render + complete path.

### Part 1 — Chat project (mcr-resources): the "publish to intranet" act

- Add a first-class **`destinations text[]`** column to `content_collections` (values e.g.
  `{'portal','intranet'}`), with a **GIN index** for containment queries.
  - Backfill: existing public courses keep working in the portal unchanged — the portal read
    path is **not** modified (it still keys on `status='published' AND is_public`). `destinations`
    is additive and only the intranet read path consults it.
- `PublishPanel.tsx` (and `usePublishCourse` / the `sparky-studio-publish` edge function)
  gain a **destination picker** so the author selects targets at publish/republish time. The
  edge function persists the chosen `destinations` onto the collection.
- **Read credential:** create a least-privilege Postgres role on the Chat project with
  `SELECT` only on `content_collections`, `content_items`, `content_item_options`, restricted
  (via view or RLS) to rows where `status='published' AND destinations @> '{intranet}'`. Mint a
  PostgREST API key / signed JWT for that role; the intranet holds it **server-side only**.

### Part 2 — The bridge: reconciliation sync (intranet-side)

Postgres cannot cross-write between separate projects, so the intranet pulls.

- A **read-only Chat client** (server-only module, using the dedicated role key) exposes:
  - `listIntranetHubCourses()` → collections where `destinations @> '{intranet}'` and published.
  - `getHubCourseContent(sourceCourseId)` → the collection + nested `content_items` +
    `content_item_options` (one query, PostgREST nested select), for the view path.
- A **`reconcileHubCourses()`** server action upserts a native `courses` **shell row** per hub
  course (keyed by `source_course_id`), mapping: `title`, `description`, `duration_minutes`,
  `category` (mapped from `target_audience`/settings, default a `hub` category),
  `source='hub'`, `is_active=true`. Courses no longer destined for the intranet (or
  un-published) are set `is_active=false` (hidden) — **completions/certificates are retained**.
  - Trigger: a manual **"Refresh hub courses"** LD-admin action; optionally a daily cron
    (`pg_cron` or a Vercel cron route) for hands-off freshness.
- **No body content is copied.** Only shell metadata is synced; `content_items` are read live.

### Part 3 — Intranet Learning module: render + complete

- **Schema:** add to the intranet `courses` table:
  - `source text NOT NULL DEFAULT 'native'` with `CHECK (source IN ('native','hub'))`.
  - `source_course_id uuid NULL` (the Chat `content_collections.id`); unique when `source='hub'`.
  - Hub courses have **no** `course_sections` / `course_lessons` rows.
- **View routing:** the course view detects `source='hub'` → renders the **ported CoursePlayer**,
  fetching `content_items` live via `getHubCourseContent`. Native courses render unchanged.
- **Completion:** the player calls a **`completeHubCourse(courseId, score?)`** server action,
  which upserts the user's `course_enrolments` row to `status='completed'` (+ `score`,
  `completed_at`). The existing `trg_auto_issue_certificate` trigger then issues the
  certificate; the existing notification + email paths fire. **Zero new completion tables.**

## Data flow

```
Author (Sparky) ── publish, destinations=[portal,intranet] ──▶ content_collections (Chat DB)
        │                                                              │
        ▼ (portal reads is_public — UNCHANGED)              reconcileHubCourses() (intranet)
   mcr-mentor-portal                                   upserts `courses` shell (source='hub')
                                                                       │
Staff opens hub course ─▶ intranet course view (source='hub')         │
   ─▶ getHubCourseContent() reads content_items LIVE (Chat DB)        │
   ─▶ ported CoursePlayer renders ◀───────────────────────────────────┘
   ─▶ on finish ─▶ completeHubCourse() ─▶ course_enrolments.status='completed'
   ─▶ trg_auto_issue_certificate ─▶ certificate + completion email + notification (EXISTING)
```

## Components and boundaries

| Unit | Location | Responsibility | Depends on |
|------|----------|----------------|------------|
| `destinations` column + RLS/view + role | Chat project migrations | Gate intranet-visible courses; least-privilege read | content_* tables |
| Destination picker | mcr-resources `PublishPanel` + publish edge fn | Author chooses targets | `content_collections.destinations` |
| Chat read client | intranet, server-only | List + fetch hub course content | dedicated read-only key |
| `reconcileHubCourses` | intranet server action / cron | Chat catalogue → `courses` shells | Chat read client, `courses` |
| Ported `CoursePlayer` + renderers | intranet `components/learning/hub-player/` | Faithful render of ~16 component types | `content_items` shape |
| `completeHubCourse` | intranet server action | Enrolment upsert → existing pipeline | `course_enrolments` |

The boundary contract is the **`content_items` shape** (the Chat read client returns it; the
ported player consumes it). If Sparky adds a new component type, only the player's renderer map
needs extending — the bridge and schema are unaffected.

## Error handling

- **Chat DB unreachable at view time:** show a "content temporarily unavailable" state; the
  catalogue, shells, and prior completions/certificates are unaffected (they live in the
  intranet DB).
- **Course un-published / `intranet` removed from `destinations`:** reconciliation flips the
  shell to `is_active=false` (hidden from catalogue). Existing completions and certificates are
  **retained** — a learner who completed it keeps their record.
- **Client-reported score:** advisory only. The server clamps to `[0,100]`; the
  `uq_certificates_user_course` unique constraint prevents duplicate certificates on re-takes.
- **Reconciliation partial failure:** per-course upsert is idempotent (keyed by
  `source_course_id`); a failed row is logged and retried next run, others proceed.

## Security

- The dedicated read-only role is **least privilege** (SELECT on content_* only, restricted to
  intranet-destined published rows) and is held **server-side only** in the intranet — never
  shipped to the browser. Course content is therefore never anon-readable.
- Intranet access to hub courses is gated by the intranet's own staff auth before any content
  is fetched server-side.
- The Chat project's existing anon/portal RLS is untouched; the new role is purely additive.

## Testing strategy

- **Chat side:** migration test that `destinations @> '{intranet}'` returns only intended
  courses; the read-only role cannot read drafts or non-intranet courses, and cannot write.
- **Reconciliation:** unit test the Chat-collection → `courses`-shell mapping; idempotent
  upsert (run twice, one row); un-publish flips `is_active=false` and preserves completions.
- **Player port:** snapshot/interaction tests per component type against fixture `content_items`;
  a known seed course (e.g. Safeguarding) renders end-to-end.
- **Completion:** integration test that `completeHubCourse` → enrolment `completed` → a
  certificate row exists with the right `course_title`/`score`; re-take issues no duplicate.
- **E2E (Playwright):** staff opens a hub course, completes it, sees the certificate; un-publish
  hides it from the catalogue but the certificate remains.

## Open questions for planning

1. **Category mapping** — which `course_category` enum value(s) do hub courses map to (a new
   `hub`/`training` category, or reuse `compliance`/`upskilling`)? Confirm the enum values.
2. **Reconciliation cadence** — manual admin action only for v1, or also a daily cron?
   (Recommend: ship manual first, add cron if drift is a problem.)
3. **Player port surface area** — confirm which component types are in active use so the first
   port covers them; rarer types can follow.
4. **Assignment/required semantics** — should hub courses be assignable/required like native
   courses from day one, or read-only-catalogue first?

## Affected files (approximate)

**Chat project / mcr-resources**
- New migration: `content_collections.destinations text[]` + GIN index + read-only role + view/RLS.
- `src/components/studio/PublishPanel.tsx`, `src/hooks/usePublishCourse.ts`,
  `supabase/functions/sparky-studio-publish/index.ts` — destination picker + persist.

**intranet**
- New migration: `courses.source` + `courses.source_course_id` (+ unique partial index).
- `src/lib/chat-content/` (server-only read client + queries).
- `src/app/(protected)/learning/**` — catalogue includes hub shells; course view routes
  `source='hub'` to the ported player.
- `src/components/learning/hub-player/**` — ported CoursePlayer + renderers.
- Server actions: `reconcileHubCourses`, `completeHubCourse`.
- Env: dedicated Chat read-only key (server-only).
