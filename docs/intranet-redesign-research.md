# Intranet redesign — research findings

**Last reviewed:** 2026-05-04
**Owner:** Abdulmuiz Adaranijo
**Status:** Research complete. Recommendations below. No code work until Colin signs off per workstream.

This document consolidates research carried out 2026-05-04 in response to design feedback (combined home feed redesign — see `memory/intranet-design-feedback.md`). It covers five workstreams: internal action audit, quick-actions externals, attention/greeting banner patterns, feed type-differentiation, and 3-column home layout. The anti-bland design playbook lives separately in `docs/frontend-design-playbook.md`.

Work was done by five background research agents reporting back into this session; load-bearing claims were spot-checked against live sources and against the codebase. Where a claim survived spot-checking, it's tagged "verified". Where it relied on a source the parent session couldn't independently re-fetch, it's tagged "uncertain — second-hand".

---

## Confirmed decisions going in

From Colin's directional answers (see `memory/intranet-design-feedback.md`):

- Both the email's three bullets AND the bigger zip scope are in play.
- Background `#fbf9f5` from the proposal is rejected; current `--background: #F2F4F7` stays.
- Tool Shed (Postcard / 3-2-1 / Takeover) moves into the home feed; needs filtering and colour differentiation per type.
- Layout vision is Facebook-style 3-column. Right rail only on `/intranet`. Mobile hides the right rail. Tablet keeps left nav, collapses right rail.
- "Where are you" banner stays in `AppLayout` above page content but constrained in width to match the centre column.
- Quick actions are buttons for high-frequency tasks. FWR is out. Role-aware. State-aware (smart).
- Greeting banner permanent. Attention banner conditional.
- Different PRs per workstream.
- Verify everything; stop and ask if anything not pre-approved surfaces.

Colour token changes already locked in: `--mcr-teal` `#2A6075 → #1b6e7a`; `--mcr-green` `#B5E046 → #4b8f4b`; `--mcr-yellow` `#F8D45B → #f5c731`. All other tokens unchanged. Typography: keep `tt-commons-pro` everywhere except scoped Postcard surface gets Source Serif 4 + Story Script + Special Elite.

---

## Section 1 — internal action audit

Background-agent catalogue cross-checked with file:line spot reads on 2026-05-04. Audit returned 220 user-facing actions across 19 modules. Five spot-checks (createPost line 686, togglePinPost line 1812, confirmArrival line 218, requestLeave line 62, enrollInCourse line 72) all matched. The full table is too large to inline here — the catalogue is in `memory/intranet-design-feedback.md` if needed.

### Daily-frequency staff actions (the candidate pool for quick actions)

These are the actions a typical staff member touches daily or several times a week:

- Set today's working location (`sign-in/actions.ts:27`, `quickSetTodayLocation` at `:668`) — already on the conditional DailyBanner
- Confirm office arrival (`sign-in/actions.ts:218`) — only when scheduled in office
- Toggle post reaction (`intranet/actions.ts:1154`) — happens inline on feed, not a quick-action candidate
- Vote on a poll (`intranet/actions.ts:1870`) — also inline on feed
- Add a comment (`intranet/actions.ts:1270`) — inline on feed
- Mark notification read (`notifications/actions.ts:29` and `:53`) — happens in the notifications popover
- Create a post (`intranet/actions.ts:686`) — already in the composer at top of feed
- Complete a lesson / submit a quiz (`learning/courses/[id]/actions.ts:109` / `:141`) — happens in the lesson player
- Approve / reject leave (manager-only, `hr/leave/actions.ts:216` / `:331`) — when count > 0

### Weekly-frequency staff actions

- Request leave (`hr/leave/actions.ts:62`) — Colin's named example
- Save / clear / apply weekly working pattern (`sign-in/actions.ts:271`, `:338`, `:369`)
- Record an absence (`hr/absence/actions.ts:162`) — sickness, appointment
- Enrol in a course (`learning/courses/[id]/actions.ts:72`)
- Create a Tool Shed entry (`learning/tool-shed/actions.ts:458`)
- Update email preferences (`settings/actions.ts:7`)

### Manager-only daily/weekly actions

- Approve / reject leave (when pending count > 0)
- Confirm RTW form (`hr/absence/actions.ts:803`) — when subordinates have a sickness ≥ 3 days

### Already-ruled-out

FWR (rare event, Colin's Q6). Cmd+K palette (already rejected at scale per `src/lib/CLAUDE.md`). Personal bookmarks (already rejected).

### Quick-action candidate shortlist

These are the actions that meet both "high frequency" AND "single-tap discoverable" — the right shape for a quick-action button. Final selection is for Colin:

For all staff:
- Set today's location (or: confirm scheduled arrival)
- Book leave
- Submit / record an absence
- Resume the next required course (only if compliance has a due item)
- Open the weekly roundup (only when a new one is published)
- Find a colleague (search shortcut)

For managers (additive):
- Approve pending leave (only when count > 0; show count badge)
- Sign off pending RTW (only when count > 0)

For new users (additive, mutually exclusive):
- Continue induction (only while `induction_completed_at` is null)

External Pathways Coordinators have access only to `/learning` and `/intranet`, so their candidate set is much smaller — likely just "Resume the next required course".

---

## Section 2 — quick actions external research

Five-agent research methodology: WebSearch + WebFetch on public design articles, design-system docs, and product blog posts. Most platforms (Facebook, LinkedIn, Slack, Notion, BambooHR, Workday, Personio, HiBob, Viva) are behind logins and weren't directly inspected. Where the research relied on screenshots or third-party UX writeups, the agent flagged it explicitly.

### Where quick actions live (cross-platform)

- **Facebook** (named inspiration) — three-rail home. Left rail = adaptive shortcut list ranked by click frequency; right rail = Sponsored / Contacts / Birthdays (mostly informational, not actions). Truly inline action surfaces are rare; Birthdays is the one where you can write on a wall in-place.
- **LinkedIn** — three-rail home. Left = profile + groups; right = News + People You May Know + ads. The single best inline-action pattern in the research: the PYMK card is one row per person with a single "Connect" button. One verb per row.
- **Slack** — vertical icon rail on the far left (Home, DMs, Activity, Later, More) + a Create button. No right rail. The Create button is the cleanest "one button, multi-modal action" pattern — pick what you want to create.
- **Notion** — single-column Home page with stacked widgets (greeting, My Tasks, Upcoming Events, Recently Visited). No right rail. Each widget user-toggleable.
- **BambooHR / Personio** — card-grid home. Action lives inside the data card it operates on (e.g. Time Off card has the Request button). No separate "quick actions" rail. This is the cleanest "state + verb together" pattern.
- **Viva Connections** — Dashboard at top of home, made of audience-targeted Adaptive Card Extensions. Each card has a Card View (the at-a-glance state) and a Quick View (an inline modal that opens in-place to take action). Microsoft's own docs say "design cards to avoid making users jump around to different experiences. Keep interactions within the Viva Connections app using the Quick View" — verified directly at https://learn.microsoft.com/en-us/viva/connections/edit-viva-home.
- **Microsoft Teams** — vertical app rail on the far left (Activity, Chat, Teams, Calendar, Calls, Files, Approvals, Shifts). Badge counts on each app icon. No central action surface.
- **SharePoint Quick Links / Staffbase** — every serious intranet platform makes "shortcut tiles" a first-class component. They sit at the **top** of the page, not the side.
- **Workplace from Meta** — read-only since Sept 2025, full shutdown 31 May 2026 (convergent across two agents, dates not independently re-verified). Was a Facebook-clone three-rail layout. Treat Facebook itself as the canonical reference now.

### Cherry-picked patterns

1. **Card-with-embedded-action (BambooHR / Personio).** Don't build a separate "Quick Actions" rail. Build state cards that own their verbs. "You have 12.5 days leave" gets a Request Leave button on the same card. "3 compliance items overdue" gets a Renew button. At MCR's scale (~80 users) and action density (4–6 things people actually do), spreading this into a rail would be over-engineering.
2. **Audience-targeted, conditional rendering (Viva Connections).** A card only renders if the user's role + state make it relevant. Internal staff see HR cards; external Pathways Coordinators don't. Anyone with overdue compliance sees the compliance card; everyone else doesn't. We already have `is_external` and `user_type` plumbed through the proxy — a card-level `shouldRender(user, state)` predicate is cheap and is the standard intranet pattern.
3. **Single Create button (Slack).** One button at the top of the rail (or floating) that opens a small picker: "What do you want to do?" — Request leave, Submit absence, Set location, Create post. Slack iterated their way to this pattern; for an org with editors who barely use the system, discoverability matters more than density.
4. **Single-verb action rows (LinkedIn PYMK).** A compact list under the headline cards: "3 leave requests need your approval", "1 induction step left", "2 colleagues' birthdays this week". Each row has one verb button. No nested menus, no expanding sections. This is the only widely-used "right rail action" pattern that actually gets clicked — works because the row reduces to one decision.
5. **Adaptive ranking on the secondary tier (Facebook).** Top of the rail = role-determined sticky cards (HR for staff, Compliance for admins). Below that = a "frequently used" strip that learns from the user's last 30 days of clicks. This only works *below* a stable curated tier — if the whole rail moves around, users complain (the Slack 2024 redesign backlash is the cautionary tale).

### Patterns to NOT copy

- **LinkedIn editorial News widget** — no editorial team at MCR.
- **Notion per-user manual customisation** — 5 editors won't build dashboards.
- **Workplace's Facebook-clone right rail of presence dots** — too sparse for an 80-person org.
- **Teams' app-rail-as-home** — no central action surface.

---

## Section 3 — attention/greeting banner patterns

### What research found

- **Greeting and attention as separate stacked blocks, not merged.** No platform combines them into one block. Viva Connections is closest: greeting in banner, announcements directly below. Notion has greeting widget and My Tasks widget as separate widgets. The separation seems intentional — greeting carries warmth, attention carries duty, combining them risks tonal whiplash.
- **Hide attention banner entirely on calm days.** BambooHR is the cautionary tale: their product blog explicitly says they "added the What's Happening tab to reduce empty space" when the Employee Community widget had nothing to show. That's the wrong instinct — better to design empty-state-first than bolt on filler. Slack celebrates with "all caught up". Workday goes blank. Either is better than tab-swapping to filler content.
- **Cap visible items at 3 with "view all" link.** Workday's pattern: "Awaiting Your Action" shows up to 3 items with a "Go to My Tasks" link to the full inbox. Even a user with 50 pending approvals only sees 3 on home.
- **Per-item dismissibility, not per-banner.** Slack Activity (mark-as-read per item), Workday (complete per item), iOS notifications (swipe per item). Whole-banner dismissal is wrong because dismissing one item shouldn't lose visibility on the others.
- **Time-of-day greeting is optional warmth, not a hard requirement.** Notion's built-in greeting just uses the name without time-of-day rotation. Viva Connections has an auto-generated greeting that's locked from customisation: "The greeting is automatically generated and can't be customized" — verified directly at the Microsoft Learn URL above. The "Good morning, Colin" pattern is more common in personal productivity tools (Flocus, third-party Notion widgets) than in enterprise HR portals.

### Tension to surface

Colin wants both a greeting banner AND an attention banner, both seemingly ever-present. Research evidence supports: greeting permanent, attention conditional. That aligns with Colin's Q11 answer — so no actual tension, just confirmation. The only soft pushback: time-of-day greeting (morning/afternoon/evening) is a personal-productivity-tool pattern, not an HR-portal one. Costs nothing to ship, but worth knowing it's not what BambooHR / Workday / Personio do.

### Cherry-picked patterns for MCR

1. **Greeting block always renders.** "Good afternoon, Colin." Time-of-day bucket in Europe/London. Server-rendered per visit, no in-tab polling. Reuse `getFirstName()` from `src/app/(protected)/hr/page.tsx:44`.
2. **Attention block renders only when there's at least one item.** No empty-state filler. No "all caught up" pat — just don't render the block. The home page composes itself out of the conditions; on calm days it reads as deliberately quiet, not padded.
3. **Cap the attention block at 3 items.** If overflow exists, "View all (n)" link routes to the relevant aggregate page (e.g. /hr/leave for leave approvals).
4. **Per-item action affordance.** Each row has its own verb button — "Approve", "Renew", "Continue", etc. No global X on the whole banner.
5. **Don't try to be clever and merge greeting + attention.** Stack them. Greeting first, attention second. The visual weight of the attention block when it renders is enough to claim the user's eye.

### Open question for Colin

Where does the attention block live in the layout? Two reasonable options given the 3-column layout decision:
- **a) Inside the centre column, above the feed.** The greeting block also sits in the centre column. The right quick-actions rail is a separate surface. Reads as "this is what's happening for you today" sandwiched between welcome and feed.
- **b) Inside the right rail, as the top section above quick actions.** Greeting still in the centre. Attention items become "things to action" in the rail; quick actions become "things you might want to do" below. Risk: starts to look like a notifications list.

Option (a) is cleaner (greeting + attention together as a header for the page) and matches how Workday does it. Recommendation is (a) unless you have a reason for (b).

---

## Section 4 — feed type-differentiation

This is the section with the biggest tension against Colin's stated preference. Surfacing it explicitly so the choice is yours with full context.

### What research found

Across X / LinkedIn / Slack / Bluesky / Mastodon / Viva Engage, the universal pattern is: **one card shell, vary the inner content slot only.** No coloured edge stripes, no per-type background tints, no distinctive borders.

Two strong pieces of recent evidence on the direction-of-travel:

- **LinkedIn retired most celebratory post templates in October 2024** (verified via Social Media Today). They eliminated Appreciation, Welcome, and Skill Assessment Badge templates; only confetti remains. The article frames this as LinkedIn moving away from per-post-type styling toward "your own text, images and videos" — original content, not templated. Direct quote from LinkedIn's own message to users.
- **Viva Engage refreshed post type designs in 2023** (uncertain — second-hand; the HandsonTek article fetch failed during verification). Reports describe the refresh as moving "away from heavy decorative chrome" — Praise lost its coloured backdrop, Polls lost the wrapper, Announcements lost most chrome. Microsoft's stated rationale was "more emphasis on content" and away from cluttering the feed.

If we accept the direction-of-travel evidence: full-card colour differentiation per post type is what major platforms tried, decided was wrong, and walked back from. Walking into it now would put us behind the curve at the moment we're catching up.

### What works at lighter touch

- **Reddit's compact view** uses a small (sub-20px) muted icon in the top-left thumbnail slot to signal type. It replaces the image, doesn't add a badge.
- **Mastodon's "X boosted" line** is sub-12px muted text + small recycle icon above the avatar — boost label sits as a header above the post, not inside it. The post itself unchanged.
- **Discourse's pinned-pin and category icons** sit next to the title at sub-20px. Discourse explicitly switched from coloured category badges to icons because pure colour was failing colour-blind users (the entire feature thread is on Discourse Meta).

### The shape that would work for MCR

Given Colin wants colour differentiation AND the research recommends against it: a middle path that keeps everyone honest.

- **Outer card chrome stays identical across all post types.** Same `bg-card rounded-xl border border-border shadow-sm overflow-clip` wrapper from `src/lib/CLAUDE.md`. Same padding, same header layout, same footer reaction strip.
- **Type signal goes in the header line.** Small muted icon + label at sub-12px next to the author name, OR a small Badge in the header row. The Badge is brighter than the icon-only pattern — it gives Colin the colour cue he wants without coating the whole card.
- **Polls stay small.** Vertical option list, no coloured wrapper, no header label. The shape of "vertical options with progress fills" is already unmistakable.
- **The Postcard's flip mechanic IS the differentiator.** Don't add a coloured frame. The flippable 3D mechanic and back-of-card design are what make Postcards memorable. Front of card identical to a news post; the moment of difference is the first time the user sees a flip prompt.

### Filter UI

Colin asked for filter ability. Research evidence: **no major social/feed platform offers post-type filter tabs in the main feed.** Slack, X, LinkedIn, Mastodon, Bluesky, Workplace — none. LumApps does and the trade-off is feed-level visual heaviness.

Two paths:
- **Drop the filter entirely.** At ~80 users with maybe 5–10 posts a week, scrolling 3 days back beats a filter UI. None of the comparable platforms decided this was worth shipping.
- **Light chip-row filter above the feed.** "All / News / Polls / Reflections / Documents" as small chips, not full tabs. Counts beside each chip. Default to "All" — never auto-default to a filter. This is the lightest pattern that still gives Colin the explicit affordance.

Recommendation: **start without a filter; add the chip row only if usage tells us people are scrolling past content they don't want to see.** Real evidence from analytics will be more useful than a guess. If we ship the filter from day one, we have to maintain the UI and the per-type counts even if nobody uses it.

### Tension to flag explicitly

Colin's Q3: "I think it would be nice to have colour differentiation. Use /frontend-design for this."

Research evidence: full-card colour differentiation per type is the wrong move based on what every major platform decided.

Compromise: **Badge in the header (gives the colour cue) + identical card chrome (avoids the kanban-board chaos).** Use the existing tonal Badge variants (`success`, `warning`, `default`, `destructive`, `secondary`) as the colour vocabulary — Postcard uses `default` (blue), 3-2-1 uses `success` (green), Takeover uses `warning` (amber), News uses no badge, Photo uses no badge, Document uses the file-type badge from `src/lib/file-types.ts`, Poll uses no badge. This matches the existing Tool Shed accent pattern in `src/lib/learning.ts:170-226`.

If Colin still wants edge stripes / coloured borders, we can do that — but I want him to know the precedent is against it.

---

## Section 5 — 3-column home layout

Verified-by-direct-CSS-inspection findings (Mastodon was inspected directly; X is from Elad Shechter's reverse-engineering article via search excerpts; LinkedIn is from a clone repo plus LinkedIn's published cover-photo size; Discord is from BetterDiscord theme repos):

| Platform | Left rail | Centre feed | Right rail | Total | Right-rail breakpoint |
|---|---|---|---|---|---|
| Mastodon | 285 | 600 | 285 | 1170 + gaps | 1175px |
| X (Twitter) | flex (~275–290) | 600 | 290–350 | ~1235 | 1095px |
| LinkedIn | 216 | ~545 (1fr) | 312 | 1128 + gaps | 1181px |
| Discord | 72 + 240 | flex | 240 | ~1200 min | toggle, not breakpoint |

**The cluster around 285–290 / 600 / 290–315 with breakpoint at 1095–1181 is striking.** Three of the four major feed platforms land within 30px of each other.

### Recommended widths for MCR

Container is 1232px usable. Left nav is 256px. Centre feed is 590px (Colin's preference, verified to match current code).

- **Right rail: 312px** (matches LinkedIn). Math: `1232 - 256 - 24 (gap) - 590 - 24 (gap) - 312 = 26px slack`. Comfortable.
- **Gap: 24px** between columns.
- **Sticky behaviour: `position: sticky`** with `top` equal to header height + 8px. The feed provides the page scroll; the right rail sticks at top while the feed scrolls past. This is the X / LinkedIn pattern. Don't use `position: fixed` (Mastodon's choice) — fixed breaks if rail content ever exceeds viewport height, and the rules around scrolling-inside-fixed-elements are fiddly.

### Responsive behaviour

- **xl (≥1280px):** full 3-column layout as above.
- **lg (1024–1279px):** **hide the right rail entirely.** No icon strip, no tray, no pill bar. All three reference platforms (X, LinkedIn, Mastodon) collapse the right rail in a single step at this size. The breakpoint should sit around 1180px to match the verified consensus.
- **md (768–1023px):** left nav stays; right rail content needs to go somewhere. **Three options ranked:**
  - **a) Tab inside the feed page** — a "Today" or "Updates" tab next to "Feed" that shows what would have been in the right rail. Zero new components, no overlay state to manage. This is what Slack does for channel pinned items.
  - **b) Drawer button in the header** — click reveals right-rail content as an overlay. Discord pattern. Costs a custom drawer component but matches user expectations from chat apps.
  - **c) Inline pill bar above the feed** showing 2–3 high-priority right-rail items (e.g. "3 polls open · Key date Friday"). Adds visual noise, requires deciding what gets promoted.
  - **Avoid floating button** — wrong idiom for desktop / tablet.
- **sm (<768px):** hide both rails. Centre feed full-width. Hamburger for the left nav. Universal pattern across all platforms.

Recommendation: **option (a) — tab inside the feed page** at md. Cheapest to build, no new component types, no overlay-state to manage.

### Where the "Where are you" banner goes

Colin's Q4 + Q5: "the where are you banner can stay above where it is, however, it's just how wide it is that we have the problem with."

Implementation: keep `DailyBanner` rendering inside `AppLayout` above `children`. Add a width-constraint wrapper that matches the centre column width on `/intranet` (590px) and the full container width on other pages. Cleanest: pass a `centerColumnWidth` prop down from the page, OR use a CSS variable scoped per-route. The banner doesn't need to know about the right rail — it just needs to occupy the same width as the centre column.

---

## Tensions surfaced for Colin to resolve

1. **Colour differentiation per post type.** Colin asked for it. Research evidence (LinkedIn 2024 template retirement, Viva Engage 2023 refresh) says full-card colour differentiation is what platforms tried and walked back from. Compromise: tonal Badge in the header line, not full-card chrome. Use existing variants: Postcard `default` blue, 3-2-1 `success` green, Takeover `warning` amber. (See Section 4.)
2. **Filter-by-type tabs.** Colin asked for filtering. Research evidence: no major feed platform ships post-type filter tabs in the main feed at our scale. Recommendation: start without; add a light chip-row only if analytics show people scrolling past content they don't want. (See Section 4.)
3. **Time-of-day greeting.** Colin asked for "Good morning/afternoon/evening, Colin". Research evidence: not what BambooHR / Workday / Personio / Viva Connections do — they either use just the name or no greeting. It's a personal-productivity-tool pattern. Costs nothing to ship; worth knowing the precedent. (See Section 3.)
4. **Quick actions in the right rail vs embedded in cards.** Colin's vision is a quick-actions sidebar. Research evidence: BambooHR / Personio embed the action in the data card it operates on. A hybrid is possible — top of the rail = role-determined sticky cards (state + verb), below = a "Create" button that opens a multi-modal picker. Resolves to "rail exists, but each rail item is a state-card with its own verb". (See Section 2.)

---

## Per-workstream recommendations

These map to PRs. Each carries its own risk profile, so they're separable. Sequencing in the next section.

### W1: Width sweep + unified container rules

**Scope:** Audit every page's wrapper. Decide unified rules: news feed pages and reading-shape pages = 590px (or pick the chosen value); HR / Sign-in / Learning catalogue = full container; lessons / Tool Shed = unchanged. Apply width constraint to `DailyBanner` so it visually matches the centre column on `/intranet`.

**Files touched:** `src/components/layout/app-layout.tsx`, `src/app/(protected)/intranet/page.tsx`, `src/app/(protected)/intranet/post/[id]/page.tsx`, `src/components/sign-in/daily-banner.tsx`. Sweep across all `(protected)/*/page.tsx`.

**Risk:** medium. Other pages that currently use the full container width are out of scope but need verifying — must not accidentally constrain HR / Sign-in.

### W2: 3-column home layout

**Scope:** Add right rail to `/intranet` only. 256 + 24 + 590 + 24 + 312 = 1206px (26px slack). Sticky right rail. Hide on lg and below. Tab fallback at md per recommendation. Hide both rails at sm.

**Files touched:** `src/components/layout/app-layout.tsx`, `src/app/(protected)/intranet/page.tsx`, new `src/components/layout/right-rail.tsx`, possibly new responsive helpers.

**Risk:** medium. Knock-on: must verify the existing left-nav collapse behaviour still works once a right rail is added. The `useSyncExternalStore` pattern for left-nav state needs to extend cleanly.

**Knock-on dependency:** W1 must land first so the centre column width is settled.

### W3: Greeting + attention banner

**Scope:** Replace or supplement `DailyBanner` with a greeting block (always renders) + attention block (conditional). Cap attention items at 3 with view-all link. Per-item dismiss / action. Reuse `getGreeting()` and `getFirstName()` from `src/app/(protected)/hr/page.tsx`. Aggregate attention sources: pending leave approvals (manager), overdue compliance courses (any user), unconfirmed office arrivals, induction items remaining (new users), unread weekly roundup.

**Files touched:** new `src/components/intranet/greeting-block.tsx`, new `src/components/intranet/attention-block.tsx`, `src/app/(protected)/intranet/page.tsx`. Possibly retire `src/components/sign-in/daily-banner.tsx` if its behaviour folds into the attention block.

**Risk:** medium-high. Aggregating attention sources across modules creates cross-module data-fetching coupling. Need to be careful about Server Action boundaries and the existing parallel-fetch pattern in the protected layout.

**Knock-on dependency:** W1 (banner width).

### W4: Type signals on feed cards

**Scope:** Add a small Badge in the post-card header line to signal type (Postcard / 3-2-1 / Takeover / News / etc.). Existing tonal variants from `src/components/ui/badge.tsx`. No card-chrome changes. Existing post-card component gets a new `typeLabel` + `typeVariant` prop.

**Files touched:** `src/components/news-feed/post-card.tsx`, `src/lib/intranet.ts` (a `POST_TYPE_BADGE_CONFIG` constant by type).

**Risk:** low. Pure visual addition. No data-model change. Easy to revert.

### W5: Tool Shed move into home feed

**Scope:** Surface Tool Shed entries (Postcard / 3-2-1 / Takeover) in the home feed alongside posts. Two implementation paths to evaluate before a decision:
- **a) Unified feed query** that pulls from both `posts` and `tool_shed_entries`, merges by recency, returns a discriminated union to the renderer.
- **b) Migration** that moves `tool_shed_entries` into `posts` with a new `post_type` discriminator column. Retires the separate table.

(a) is faster to ship and reversible. (b) is cleaner long-term but irreversible without a backfill. Recommendation: ship (a) first; consider (b) only if maintenance cost of two tables proves real.

**Files touched:** `src/app/(protected)/intranet/actions.ts`, `src/components/news-feed/post-feed.tsx`, the renderer in `post-card.tsx` to handle Tool Shed payload shape. Possibly `src/app/(protected)/learning/tool-shed/page.tsx` if we deprecate that page — Colin to confirm: keep the Tool Shed page as the editor's surface, or retire it entirely?

**Risk:** high. Data-model question (a vs b) needs Colin sign-off. UI changes touch the most-viewed page in the app.

**Knock-on dependency:** W4 (type signals must exist before mixing types in the feed).

### W6: Quick-actions rail

**Scope:** Right rail content. Recommended composition: greeting/attention + a state-card-with-embedded-action stack + (optional) Slack-style Create button. Audience targeting via the existing role helpers (`isHRAdminEffective`, `is_external`, etc.). State conditions per card.

**Files touched:** new `src/components/intranet/quick-actions-rail.tsx`, new `src/components/intranet/quick-action-card.tsx`, integration with `getDailyBannerState`-style aggregation.

**Risk:** high. Requires Colin to settle the candidate list (Section 1 shortlist) and confirm the embedded-action vs separate-button preference. Touches every role's home experience.

**Knock-on dependency:** W2 (the rail needs a place to live), W3 (attention surface decisions cascade into rail composition).

### W7: Composer redesign (3-step modal)

**Scope:** Implement the design proposal's 3-step modal: type picker → form → preview & send. Per-type forms. The "expressive" Postcard variant with live preview is the signature flourish.

**Files touched:** `src/components/news-feed/post-composer.tsx`, new modal components per step, integration with existing attachment + poll + Tiptap composer code.

**Risk:** high. Largest scope. Touches the primary content-creation path. Needs careful consideration of how the existing Tool Shed share dialog (`src/components/tool-shed/share-insight-dialog.tsx`) relates — likely the modal subsumes it.

**Knock-on dependency:** W5 (Tool Shed types must exist as feed types first).

### W8: Postcard signature card (3D flip + handwriting fonts)

**Scope:** Implement the flippable Postcard card. CSS 3D transforms (`preserve-3d`, `backface-visibility`). Stamp / postmark / cancel-lines as inline SVG. Six themes (Wine / Teal / Sunset / Forest / Midnight / Butter). Source Serif 4 + Story Script + Special Elite scoped via CSS to the postcard surface only — no global cascade.

**Files touched:** new `src/components/news-feed/postcard-card.tsx`, scoped CSS in a co-located stylesheet, font loader updates in `src/app/layout.tsx` or a scoped wrapper.

**Risk:** medium. CSS 3D transforms are well-supported; the risk is performance on lower-end devices. Font loading needs to be scoped (only load when a postcard is on the page) — otherwise we ship 4 extra typefaces to every user on every page.

**Knock-on dependency:** W5 (Tool Shed merged into feed first).

---

## Sequencing options

Three reasonable orders. Pick one or propose your own.

### Option A — foundation first, signature last

1. W1 width sweep (low risk, unblocks others)
2. W3 banners (uses W1 width constraint)
3. W2 3-column layout (uses W1 width constraint)
4. W4 type signals (low risk, sets up W5)
5. W5 Tool Shed merge (data work)
6. W6 quick-actions rail (uses W2 + W3)
7. W7 composer redesign (uses W5)
8. W8 postcard signature card (uses W5)

Pros: each PR builds on the last cleanly. Lowest review cost per PR. Reversible at any stage.
Cons: visible "wow" change comes last. User-visible improvements arrive piecemeal.

### Option B — visible wins early

1. W1 width sweep
2. W4 type signals (small, immediately visible improvement)
3. W3 banners (visible greeting + attention)
4. W2 3-column layout
5. W6 quick-actions rail
6. W5 Tool Shed merge
7. W8 postcard signature card
8. W7 composer redesign

Pros: feedback-visible changes ship early. Easier to course-correct.
Cons: W4 type signals before W5 Tool Shed merge means we're adding type variety the user can't yet act on.

### Option C — focus on the home page first

1. W1 width sweep
2. W3 + W2 + W4 + W6 bundled as ONE "home page redesign" PR
3. W5 Tool Shed merge
4. W7 composer redesign
5. W8 postcard signature card

Pros: home page lands as one coherent change. Fewer PR boundaries to coordinate.
Cons: violates Colin's Q14 ("different PRs"). Bundle is large; review cost is high; harder to revert one piece without unwinding the whole.

**Recommendation: Option A.** Matches Colin's Q14 explicitly. Each PR small and reviewable. Foundational work (widths, 3-col, banners) lands fast and unblocks the visible work. Postcard signature card last because it's the highest-attention surface and needs to be done well — having the rest of the system in place when we design it means we know the constraints.

---

## Verification provenance

Spot-checked against live sources or codebase on 2026-05-04:
- Internal action audit: 5/5 file:line claims verified by Read.
- Viva Connections greeting locked from customisation: verified at https://learn.microsoft.com/en-us/viva/connections/edit-viva-home (direct quote).
- LinkedIn celebratory template retirement Oct 2024: verified at https://www.socialmediatoday.com/news/linkedin-retires-celebratory-post-templates/731690/.
- Mastodon column widths: verified by background research agent via direct CSS inspection.

Convergent across two agents but not independently re-fetched in this session:
- Workplace from Meta read-only Sept 2025, full shutdown 31 May 2026. Both quick-actions and type-differentiation agents reported it. ClearBox article didn't have specific dates.

Second-hand, single-source:
- X (Twitter) column widths and breakpoints: from Elad Shechter's reverse-engineering article via search excerpts. Not independently fetched.
- LinkedIn column widths (216 / 1128 / 312): from a 2018-vintage clone repo whose author replicated production by eye. The 1128 figure is corroborated by LinkedIn's published cover-photo size.
- Viva Engage 2023 post-type-design refresh direction: HandsonTek article fetch failed during verification. Only second-hand summary available.
- BambooHR home page details: BambooHR product blog returned 403. Findings rely on web-search summaries citing those pages.

Anti-bland design playbook (separate file `docs/frontend-design-playbook.md`): verified by background research agent via direct DOM inspection on 2026-05-04 across linear.app, vercel.com, stripesessions.com, arc.net, posthog.com, resend.com, mux.com, apple.com/uk/iphone-17-pro/, figma.com, rauno.me, culturedcode.com/things/, notion.com/product/calendar, ui.shadcn.com, demos.creative-tim.com/material-kit, getbootstrap.com. Parent session has not independently re-verified each measurement; if a specific value is load-bearing for a future decision, re-verify against the live site.
