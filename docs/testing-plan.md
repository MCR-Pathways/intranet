# Testing Plan — MCR Pathways Intranet

## Context

The intranet has 15 test files (333 tests) covering server actions and utility libs, but **zero component tests** and major gaps in the HR module. Of 18 action files, 7 have no tests — all in HR. The largest untested file (`hr/absence/actions.ts`) is 966 lines handling sensitive health data. `src/lib/hr.ts` (799 lines of pure business logic for leave calculations, Bradford Factor, trigger points) is completely untested. PRs #50 (CSP enforcement) and #51 (Facebook-style composer) are open and undeployed.

**Goal**: ~500 new tests across 7 phases, bringing coverage from ~6% to ~25-30% file coverage (~830 total tests).

---

## Phase 0: Test Infrastructure ~~(branch: `test/infrastructure`)~~ DONE
**Tests: 0 | Effort: 0.5 sessions | Priority: Pre-requisite | Status: COMPLETE**

Extend `src/__mocks__/supabase.ts` with:
- **Storage mocks**: `upload`, `remove`, `createSignedUrl` (needed by absence/compliance actions)
- **Missing chain methods**: `mockDelete`, `mockUpsert`, `mockIs`, `mockLimit`, `mockIn`, `mockNeq`

Create shared mocks:
- `src/__mocks__/next-navigation.ts` — `useRouter`, `useSearchParams`, `usePathname`
- `src/__mocks__/next-cache.ts` — `revalidatePath`, `revalidateTag`

**Files to modify/create:**
- `src/__mocks__/supabase.ts` (extend)
- `src/__mocks__/next-navigation.ts` (new)
- `src/__mocks__/next-cache.ts` (new)

---

## Phase 1: HR Pure Functions ~~(branch: `test/hr-lib-pure-functions`)~~ DONE
**Tests: 143 actual | Effort: 1 session | Priority: HIGH | Status: COMPLETE**
**Combined with Phase 0 into branch: `test/phase-0-1-infrastructure-and-pure-functions`**

### `src/lib/hr.test.ts` (~90 tests)
Every function is pure/deterministic with zero DB calls:
- `calculateWorkingDays` (~20) — weekends, holidays, half-days, edge cases
- `calculateFTEAdjustedDays` (~6) — proportional scaling, rounding
- `calculateProRataEntitlement` (~12) — mid-year starters/leavers, clamping
- `calculateBradfordFactor` / `getBradfordFactorSeverity` (~10) — formula, boundaries
- `calculateTriggerPoint` (~10) — thresholds, window filtering, sick-only types
- `getWellbeingPrompt` (~8) — severity levels
- `getLeaveYearForDate` (~4) — year boundaries
- `formatFTE`, `formatLeaveDays`, `formatHRDate`, `formatHRDateLong` (~14) — formatting + null handling
- `calculateLengthOfService` (~6) — singular/plural, sub-month
- `validateHRDocument` (~5) — size, type validation
- `getHolidayCalendar` (~4) — region mapping
- `mapToLeaveRequestWithEmployee` (~4) — null-safe join mapping

### `src/lib/intranet.test.ts` (~8 tests)
- `validateFile` — size limit, invalid type, valid types
- `isImageType` — image vs document MIME types

### `src/lib/sign-in.test.ts` (~8 tests)
- `formatSignInTime`, `formatSignInDate`, `getLocationLabel`

### `src/lib/learning.test.ts` (~8 tests)
- `getLockedLessonIds` — quiz blocking logic

---

## Phase 2: HR Absence & Leave Actions (branch: `test/phase-2-hr-absence-leave-actions`) DONE
**Tests: 112 actual | Effort: 1 session | Priority: CRITICAL | Status: COMPLETE (PR #53)**

### `src/app/(protected)/hr/absence/actions.test.ts` (~65 tests)
Largest untested action file (966 lines, 12 functions):
- `recordAbsence` (~10) — auth, whitelist, date/type validation, working days calc
- `updateAbsence` (~8) — whitelist, recalculates total_days
- `deleteAbsence` (~5) — cascades fit note cleanup from storage
- `uploadFitNote` / `deleteFitNote` (~8) — file validation, storage ops, DB sync
- `createRTWForm` (~5) — authority check, duplicate prevention
- `saveRTWForm` / `submitRTWForm` / `confirmRTWForm` / `unlockRTWForm` (~15) — status transitions, authority at each stage
- `fetchAbsenceHistory` / `fetchRTWForm` / `fetchTriggerPointStatus` (~8) — auth, data shape

### `src/app/(protected)/hr/leave/actions.test.ts` (~45 tests)
- `requestLeave` (~10) — only requestable types, date validation, working days
- `withdrawLeave` (~5) — ownership check, pending-only
- `approveLeave` / `rejectLeave` / `cancelLeave` (~12) — status transitions, rejection reason required
- `recordLeave` (~5) — HR admin records on behalf, all types allowed
- `upsertLeaveEntitlement` (~5) — upsert logic
- `fetchPublicHolidays` (~5) — region mapping

---

## Phase 3: Remaining HR Actions (branch: `test/phase-3-hr-remaining-actions`) DONE
**Tests: 118 actual | Effort: 1 session | Priority: HIGH | Status: COMPLETE (PR #56)**

### `src/app/(protected)/hr/leaving/actions.test.ts` (~25 tests)
- `verifyLeavingAuthority` (~5) — line manager, HR admin, neither
- `createLeavingForm` / `updateLeavingForm` (~6) — whitelist, valid reasons
- Status transitions: draft → submitted → processing → completed + cancel (~10)
- `fetchLeavingFormSummary` (~4)

### `src/app/(protected)/hr/assets/actions.test.ts` (~25 tests)
- `createAsset` / `updateAsset` (~9) — whitelist, duplicate tag
- **`assignAsset`** (~8) — **rollback tests**: assignment insert succeeds but status update fails → verify rollback deletes the assignment
- **`returnAsset`** (~6) — **rollback tests**: similar pattern
- `retireAsset` (~3) — cannot retire if assigned

### `src/app/(protected)/hr/compliance/actions.test.ts` (~20 tests)
- `calculateDocumentStatus` (~5) — pure date logic (expired, expiring_soon, valid)
- `uploadComplianceDocument` (~5) — file validation, storage, DB
- `deleteComplianceDocument` (~4) — DB-first delete, storage cleanup
- `getComplianceDocumentUrl` (~3) — ownership check

### `src/app/(protected)/hr/profile/actions.test.ts` (~15 tests)
- `updatePersonalDetails` (~6) — self-only, whitelist blocks `date_of_birth`/`ni_number`
- `upsertEmergencyContact` (~5) — max 2 limit
- `deleteEmergencyContact` (~4) — ownership check

### `src/app/(protected)/hr/key-dates/actions.test.ts` (~12 tests)
- CRUD operations (~12) — straightforward HR admin gate + whitelist

---

## Phase 4: Intranet Resources + Notifications (branch: `test/phase-4-intranet-resources-notifications`) DONE
**Tests: 51 actual | Effort: 1 session | Priority: MEDIUM | Status: COMPLETE (PR #57)**

### `src/app/(protected)/intranet/resources/actions.test.ts` (~40 tests)
- Category CRUD (~15) — slug generation, unique slug dedup, delete-with-articles guard
- Article CRUD (~18) — slug generation, Tiptap JSON extraction, draft/published
- `getCategoryArticleCount` (~3)

### `src/lib/notifications.test.ts` (~12 tests)
- `createNotification` (~6) — correct shape, optional fields default to null
- `dismissSignInReminders` (~6) — deletes correct type+user combo

---

## Phase 5: Component Tests — News Feed (branch: `test/phase-5-news-feed-components`) DONE
**Tests: 76 actual | Effort: 1 session | Priority: MEDIUM | Status: COMPLETE (PR #58)**
**Establishes component testing patterns for all future component tests**

### `src/components/news-feed/tiptap-renderer.test.tsx` (~10)
- Plain text fallback (null `content_json`), formatted JSON, @mentions, href sanitisation

### `src/components/news-feed/poll-display.test.tsx` (~10)
- Vote buttons vs results view, expired poll, percentage calculation, zero votes

### `src/components/news-feed/post-composer.test.tsx` (~12)
- Collapsed card → dialog open, character count, discard confirmation, disabled when empty

### `src/components/news-feed/attachment-editor.test.tsx` (~10)
- File validation, max count enforced, remove from list

### `src/components/news-feed/image-lightbox.test.tsx` (~8)
- Keyboard nav (arrows, Escape), image counter

### `src/components/news-feed/comment-section.test.tsx` (~10)
- Comment list, reply form, edit toggle, empty state

---

## Phase 6: Component Tests — HR & Learning (branch: `test/phase-6-hr-learning-components`) DONE
**Tests: 83 actual | Effort: 1 session | Priority: LOWER | Status: COMPLETE (PR #61)**

### `src/components/news-feed/comment-item.test.tsx` (18 tests)
- Three-dot menu visibility (author, HR admin, non-author non-admin)
- Edit indicator, preferred name, reply link visibility, reactions, delete confirmation
- Interactions: delete confirm calls action, edit save/cancel, Like reaction

### `src/components/hr/leave-request-table.test.tsx` (21 tests)
- Table rendering, employee column visibility, search filter, action buttons (withdraw/approve/reject/cancel)
- Team overlap notice, empty state, rejection reason display
- Interactions: withdraw/approve/reject (with reason)/cancel confirm calls actions

### `src/components/learning/quiz-player.test.tsx` (15 tests)
- Completed state, question rendering, answer selection (single/multi), submit disabled/enabled
- Pass/fail results, retry reset, error display, last lesson messages

### `src/components/learning-admin/quiz-editor.test.tsx` (13 tests)
- Empty state, question display, Multi badge, add question flow with validation
- Edit mode, option management (max 6), question type toggle

### `src/components/hr/return-to-work-form.test.tsx` (16 tests)
- Header/status display, field editability per role+status, conditional sections (fit note >7 days)
- Action button visibility (save draft, submit, confirm, unlock), employee confirmation notice
- Interactions: save draft, submit with confirmation, employee confirm, HR unlock

---

## Phase 7: Hook Tests (branch: `test/hooks`)
**Tests: ~22 | Effort: 0.5 sessions | Priority: LOWER**

- `use-auto-link-preview.test.ts` (~10) — debounce, fetch, clear, no re-fetch same URL
- `use-new-posts-poll.test.ts` (~8) — interval, count reset, tab visibility
- `use-auto-resize-textarea.test.ts` (~5) — height on input, reset on clear

---

## Summary

| Phase | Branch | Tests | Sessions | Priority | Status |
|-------|--------|-------|----------|----------|--------|
| 0+1 | `test/phase-0-1-infrastructure-and-pure-functions` | 143 | 1 | Pre-req + HIGH | DONE (PR #52) |
| 2 | `test/phase-2-hr-absence-leave-actions` | 112 | 1 | CRITICAL | DONE (PR #53) |
| 3 | `test/phase-3-hr-remaining-actions` | 118 | 1 | HIGH | DONE (PR #56) |
| 4 | `test/phase-4-intranet-resources-notifications` | 51 | 1 | MEDIUM | DONE (PR #57) |
| 5 | `test/phase-5-news-feed-components` | 76 | 1 | MEDIUM | DONE (PR #58) |
| 6 | `test/phase-6-hr-learning-components` | 83 | 1 | LOWER | DONE (PR #61) |
| 7 | `test/hooks` | ~22 | 0.5 | LOWER | |
| **Total** | | **~546** | **~10.5** | | |

**Dependency graph**: Phases 2-5 require Phase 0+1. Phase 6 benefits from Phase 5 patterns. Phase 7 is independent.

**Recommended order**: ~~0 + 1 (parallel)~~ DONE → ~~2~~ DONE → ~~3~~ DONE → ~~4~~ DONE → ~~5~~ DONE → ~~6~~ DONE → 7

---

## Areas Not in the User's Original List

1. **`src/lib/notifications.ts`** — `createNotification` + `dismissSignInReminders` (service role client, untested)
2. **`src/app/(protected)/intranet/resources/actions.ts`** — 7 functions for knowledge base CRUD (slug generation, unique enforcement)
3. **`verifyAbsenceAuthority` / `verifyLeavingAuthority`** — security-critical helper functions checking line-manager-or-HR-admin
4. **`calculateDocumentStatus`** in compliance — pure date logic exported from a `"use server"` file
5. **`mapToLeaveRequestWithEmployee`** in `src/lib/hr.ts` — data transformation with null-safe fallbacks
6. **`app-layout.tsx`** — `useSyncExternalStore` for SSR-safe localStorage (reference implementation worth testing)
7. **Middleware JWT fallback path** — existing `middleware.test.ts` should verify both fast-path (JWT claims) and slow-path (DB fallback) are covered

## Verification

After each phase:
1. `npm test` — all tests pass
2. `npm run build` — no type errors from test-adjacent changes
3. PR with test count in description
