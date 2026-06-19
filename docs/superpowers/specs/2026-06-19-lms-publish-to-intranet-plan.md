# Implementation plan — LMS-hub courses → intranet Learning module

Companion to `2026-06-19-lms-publish-to-intranet-design.md`. This records the concrete
build, grounded in the verified codebase facts from the understanding pass.

## Verified facts that shape the build

- **`courses.category` is a Postgres ENUM** `course_category('compliance','upskilling','soft_skills')` (migration `00001`). No `training` value. Hub shells default to **`upskilling`**; admins can recategorise. We do **not** add an enum value (CLAUDE.md: avoid enum churn).
- **`course_enrolments.status` is ENUM** `enrolment_status('enrolled','in_progress','completed','dropped')`.
- **Completion → certificate is trigger-driven:** `trg_auto_issue_certificate` (migration `00072`) fires on `course_enrolments.status → 'completed'` and inserts a `certificates` row **only if `courses.issue_certificate = true`**. `trg_notify_course_completed` (`00068`) fires the in-app notification.
- **The completion EMAIL is application-level**, not a trigger — `sendCompletionEmails()` in `learning/courses/[id]/actions.ts`. `completeHubCourse` must call the same logic.
- **The progress RPC computes from lessons+quizzes; a course with none stays at 0% forever.** So hub courses cannot use `complete_lesson_and_update_progress`; `completeHubCourse` sets the enrolment to `completed` directly.
- **Certificate PDF** is rendered on demand at `src/app/api/certificate/[id]/route.ts` from the `certificates` row (course title via join). The hub shell row supplies the title.
- **Next intranet migration number: `00100`.** Highest existing is `00099`.
- **`node_modules` is not installed** — `npm install` is required before `next build`/lint/test.
- **Player uses MCR Tailwind tokens** (`mcr-db-*`, `mcr-lb-*`, `shadow-brutal/lift/float`, `animate-course-reveal`, `tt-commons-pro`) and `react-markdown` + `remark-gfm`. The intranet (Tailwind v4) has none of these — the port brings a scoped theme + the two deps.
- **Chat content schema (read target):** `content_collections` (id, type, title, description, target_audience, status, is_public, settings jsonb, estimated_duration_minutes, published_at, + new `destinations`), `content_items` (id, collection_id, parent_id, type, title, content, is_required, correct_answer jsonb, settings jsonb, sort_order), `content_item_options` (id, item_id, label, value, image_url, sort_order). ~20 item types render in the player.

## Repos, branches, PRs

- **intranet** (primary) — branch `feature/lms-publish-to-intranet`, PR → `MCR-Pathways/intranet` `main`. Holds the spec, schema, read client, player port, view, completion, cron, tests.
- **mcr-resources** (Chat side) — new branch `feature/course-destinations` off `main`, PR → `colinmcrp/mcr-resources`. Holds the `destinations` column + RLS/role + PublishPanel picker + hook + edge function + `republish_course` RPC change.

## Cross-project read auth (decision 7: dedicated read-only role)

Chat migration creates a `nologin` role `intranet_reader`, `GRANT SELECT` on the three
content tables, and additive RLS policies `TO intranet_reader` gated on
`status='published' AND destinations @> '{intranet}'`. The intranet stores a server-only
JWT minted for that role:
- `CHAT_SUPABASE_URL` (server-only)
- `CHAT_SUPABASE_READONLY_KEY` (server-only JWT, `role: intranet_reader`)

Never `NEXT_PUBLIC_` — content is fetched server-side and passed as props, so it is never
anon-readable. Existing portal anon RLS (`is_public`) is untouched.

## Workstreams

### A — Chat side (mcr-resources)
1. Migration `*_course_destinations.sql`: `alter table content_collections add column destinations text[] not null default '{}'` + GIN index; create `intranet_reader` role + grants + additive RLS policies (collections, items, options) `TO intranet_reader` gated on published + `destinations @> '{intranet}'`. Idempotent.
2. Update `republish_course` RPC to accept `p_destinations text[]` and set it.
3. `sparky-studio-publish/index.ts`: accept `destinations?: string[]`, write on the new-course `.insert()` and pass `p_destinations` on republish. Default `['portal']` when absent.
4. `usePublishCourse.ts`: add `destinations` to `PublishArgs`, pass in the invoke body.
5. `PublishPanel.tsx`: a Destinations multi-select (Portal / Intranet checkboxes, ≥1 required) below the summary, state passed to the mutation. Portal checked by default; Intranet annotated.

### B — Intranet schema
1. Migration `00100_add_hub_course_source.sql`: `alter table public.courses add column source text not null default 'native' check (source in ('native','hub'))`, `add column source_course_id uuid`; partial unique index `on courses(source_course_id) where source='hub'`. Idempotent (`IF NOT EXISTS` / `DROP POLICY IF EXISTS`).
2. Hand-edit `src/types/database.types.ts` — add `source` + `source_course_id` to `courses` Row/Insert/Update (we cannot run `supabase gen types` without prod creds; the edit matches generator output).
3. Sweep `*_SELECT`/inline selects on `courses` so the new columns are fetched where needed (catalogue + detail).

### C — Chat content read client (intranet, server-only)
- `src/types/chat-content.ts` — hand-defined `ChatDatabase` (the three tables) **and** the in-memory `ContentItem` / `ContentItemWithOptions` / `LoadedContent` / per-type settings types (ported from mcr-resources `src/types/content.ts`).
- `src/lib/chat-content/client.ts` — `createChatClient()` from `@supabase/supabase-js` using the server-only env vars; throws if missing.
- `src/lib/chat-content/queries.ts` — explicit-SELECT constants; `listIntranetHubCourses()` (collections where `destinations @> '{intranet}'` + published) and `getHubCourseContent(sourceCourseId)` (collection + nested items + options, ordered by sort_order). Log + return null/[] on error.

### D — Player port (intranet)
- Theme: add scoped MCR tokens to the intranet Tailwind v4 layer (a `src/app/course-player.css` imported by the player route, or `@theme` additions) — `mcr-*` colours, `shadow-brutal/lift/float`, `animate-course-reveal` keyframe, `tt-commons-pro` fallback. Scoped so it cannot bleed into the rest of the app.
- Deps: add `react-markdown` + `remark-gfm`.
- Libs → `src/lib/course/`: `courseSections.ts`, `courseQuiz.ts`, `courseAccent.ts` (ported verbatim, adjusted imports).
- Components → `src/components/learning/hub-player/`: `CoursePlayer.tsx` (`'use client'`), `BlockRenderer.tsx`, `QuizSection.tsx`, `CourseChrome.tsx`, `CourseIcon.tsx`, and all block/preview renderers for the ~20 types (Video, Image, Text, SingleQuestion, MultiQuestion, YesNoQuestion, OrderingQuestion, Flashcard, Scale, TextInput, TextArea, DateItem, Callout, CardCarousel, InteractiveTiles, Accordion, ScenarioDeck, FeatureList, ContactList, Completion), plus `MarkdownRenderer.tsx` (+ a Mermaid fallback to a styled code block in v1 — note as follow-up). Unknown item types render a safe fallback block.
- Media: `useSignedMediaUrls` ported to sign Chat-storage paths via the Chat client server-side (best-effort; absolute URLs pass through). Document the read-only-role storage caveat.
- All stateful components get `'use client'`; no Supabase import inside client components (data arrives as props).

### E — Course view + catalogue integration
- `learning/courses/[id]/page.tsx`: when the course row has `source='hub'`, fetch `getHubCourseContent(source_course_id)` server-side and render `<HubCoursePlayer content={...} courseId={...} enrolment={...} />` instead of the native section accordion. Ensure an enrolment exists (auto-enrol on open: upsert `enrolled`/`in_progress`).
- Catalogue + course card action button: route hub courses to the same `[id]` page; "Completed" state from the enrolment as for native courses. No body content fetched in the catalogue (counts/badges only).

### F — Completion
- `learning/courses/[id]/hub-actions.ts` (new `"use server"` file): `completeHubCourse(courseId, score?)` — `getCurrentUser`, verify the course is `source='hub'`, upsert `course_enrolments` to `status='completed', progress_percent=100, completed_at=now(), score=clamp(score)`. Triggers issue the cert + notification. Then call the shared completion-email logic (extract `sendCompletionEmails` into a reusable helper if needed). `revalidatePath('/learning/courses/[id]','page')` and `/learning/courses`.
- Client player calls it via `useTransition` with `.catch()/.finally()` per CLAUDE.md.

### G — Reconciliation (daily cron + manual)
- `src/lib/chat-content/reconcile.ts` — `reconcileHubCourses()` core: read `listIntranetHubCourses()`, upsert a `courses` shell per source course (keyed by `source_course_id`). **On insert:** `source='hub'`, title/description/`duration_minutes` from source, `category='upskilling'`, `status='published'`, `is_active=true`, `issue_certificate=true`, `is_required=false`. **On update:** sync title/description/duration + set `is_active` by whether still present; do **not** overwrite admin-owned `category`/`is_required`/`issue_certificate`/`status`. Courses absent from the source set → `is_active=false` (hidden; completions/certs retained). Idempotent; per-course try/catch with a `blockErrors` array.
- `src/app/api/cron/reconcile-hub-courses/route.ts` — GET, `timingSafeTokenCompare` against `CRON_SECRET`, `cron_runs` start/finish audit, production guard, `maxDuration`, accurate failed status when `blockErrors` non-empty.
- Migration `00101_reconcile_hub_courses_cron.sql` — pg_cron + pg_net schedule (daily `30 5 * * *`) via vault secrets `app_base_url` + `cron_secret`; idempotent unschedule-first + extension guards.
- Manual trigger: `manualReconcileHubCourses()` server action (`requireLDAdmin`) that fetches the cron route with the bearer secret; surfaced as a "Refresh hub courses" button in admin/courses.

### H — Tests (Vitest, co-located, mock `@/lib/auth`)
- `completeHubCourse`: sets enrolment completed + score clamp; rejects non-hub course; idempotent re-take.
- `reconcile`: collection→shell mapping; idempotent upsert; absent course → `is_active=false`; admin-owned fields preserved on update.
- `chat-content/queries`: SELECT shape + error → empty/null.
- `courseSections`/`courseQuiz`: ported pure-function tests.
- Cron route: unauthorised without bearer; audit row written.

## Verification (must pass before commit)
1. `npm install` (+ the two new deps).
2. `npm run lint` and `npm run lint:a11y` clean (player components must satisfy strict jsx-a11y + no-truncate-without-title).
3. `npm test` green.
4. `npm run build` green (stricter TS than tests — the real gate).
5. Migrations idempotent (re-runnable) — reviewed by reading, since no prod `DATABASE_URL` here.

## Out of scope / follow-ups
- Live Mermaid rendering in course markdown (v1 renders fenced blocks as code).
- Algolia indexing of hub course bodies (catalogue title/description only).
- Salesforce write-back. Cross-project storage signing hardening for the read-only role.
- `supabase gen types` regeneration against prod (done at deploy with prod parity; columns hand-added meanwhile).
