# Colour-rework knock-on audit (post-ivory)

Triggered 2026-06-16. The home-feed colour rework (ADR-014, PR1–5) changed `--background` from cool grey `#F2F4F7` to warm ivory `#FDF9EA`, **uniform across every route**. Many components' contrast/border/shadow/surface decisions were tuned for the grey canvas. This audit walks the whole intranet asking, per the intentionality bar: what was there, why, is it still the best call now the ground shifted, and how to improve.

Status key: 🔴 confirmed issue · 🟡 candidate (needs visual) · 🟢 checked, fine · ⚪ not yet looked at

---

## F1 — Neutral palette is still cool-grey under warm ivory 🟡 (systemic)

**What.** Light-mode neutral tokens (`src/app/globals.css` `:root`):
- `--border`/`--input` `#e5e7eb`, `--muted` `#F0F2F5`, `--secondary` `#E8ECF0`, `--accent` `#E2E8F0`, `--table-header` `#E4E7EC` — all cool/blue-leaning greys.
- `--background` is now warm ivory `#FDF9EA`; `--card` stays `#ffffff`.

**Why a candidate.** The grey era's canvas (`#F2F4F7`) was itself cool, so neutrals + canvas shared a temperature. Ivory is warm; cool-grey borders/muted surfaces against a warm cream can read cold/mismatched. The handoff explicitly listed these as "neutrals to review against ivory" + "bump card shadow alpha slightly" — and that review was never done (PR1 only swapped `--background` + did the `bg-card` sweep). Blast radius: every surface, every page (`bg-muted` alone is in 79 files).

**Status.** 🔴 CONFIRMED (visual + computed, hr/users on ivory). The table-header band (`#e4e7ec`) and card borders (`#e5e7eb`) read distinctly cool/blue-grey against the warm cream — a ~25-pt R−B temperature delta (ivory +19 warm vs neutrals −6 cool). It's softened where neutrals sit *on* white cards, but card **borders** (white card ↔ ivory canvas) and any muted-on-canvas surfaces clash directly. This is the "greyscale" cast the brief tried to escape, lingering in the neutrals.

**Recommendation.** A neutral re-tune PR (the review the handoff asked for): warm `--border`, `--input`, `--muted`, `--secondary`, `--accent`, `--table-header` toward the ivory hue — low-saturation warm greys/greige, keeping enough lightness contrast for borders/bands to still read. Tune exact values visually on ivory. Highest-leverage fix; touches every page. NB: keep this separate from the Tailwind `gray/blue/*` ramps the status badges (§1.7/1.8) depend on.

**🟢 SHIPPED (P1-A).** Warmed to `--secondary #EBE7DD` · `--accent #E7E2D7` · `--muted #F3F0E7` · `--border`/`--input #E5E0D5` · `--table-header #E9E4D9`. Temperature delta cut ~25→~3 pts. Verified visually on hr/users (warm band on cream, not cold blue) + the feed (composer/borders harmonise, brand accents fine; also auto-fixes the cool "skeletons on canvas"). design-system §1.2 updated. `--muted-foreground` left cool for now (text temperature far less perceptible; contrast risk) — optional follow-up.

---

## F2 — Tonal status badges wash out on non-white surfaces 🔴 (Colin-spotted)

**What.** The `-50`/`-700` tonal status badges (`badge.tsx` variants + §1.8 set: green/amber/red/blue/grey) have near-white fills. Measured on hr/users: `bg-green-50` Active badge = **L≈98**; white row = L100; striped row (`odd:bg-muted/50`) = **L≈96**.

**Why a problem.** ~2 ΔL either way, and the contrast **flips**: badge is darker than a white row (soft pill reads) but *lighter* than the stripe (pill dissolves → floating text). Same on the ivory canvas. The `-50` fills were tuned for an all-white surface; the zebra stripe + warm ivory swallow them.

**Status.** 🔴 CONFIRMED (measured + Colin's screenshot). Applies to every tonal badge on every striped/tinted/ivory surface.

**Recommendation.** Give the badge variants a subtle tonal **border** (the `border-transparent` slot → e.g. `border-{colour}-600/20`) so the pill *outline* defines the shape on white, stripe, and ivory alike — keeps the soft-tonal §1.8 look, avoids the "noisy solid fill" the convention rejected. One change in the badge variant classes.

**🟢 SHIPPED (P1-B).** `badge.tsx` variants `border-transparent` → tonal `-200` (coloured) / `border-border` (neutral). Verified on hr/users — Active pills hold their shape on striped + white + warm-band rows. `settings-drive-watches` override badges already set explicit borders (fine). **Follow-up:** HR config-driven badges (`absence-dashboard:149` `border-0` + `typeConfig.bgColour/colour` from `hr.ts`) opt out of the border → still wash out; add a `borderColour` to the leave/type config and drop `border-0`. Folded into P2-C.

## Raw-colour offenders (token bypass) ⚪
- `bg-white` (4 files), `bg-(gray|slate|zinc|neutral)-50..200` (5 files) — hardcoded cool surfaces that bypass the token system; if warmed neutrals are adopted, these won't follow. Enumerate + check.

## Module sweep (5-agent code audit + spot visual)

**HR** — mostly clean (inputs/tables tokenised). Candidates: `people-calendar.tsx:284` `gap-px bg-border` gridlines = cool seams between ivory cells (high, most-viewed HR surface); `:289` muted header band; `:103-104` raw `bg-gray-100` fallback. `org-chart-content.tsx:661` big `bg-muted/30` chart panel (second canvas, cool on ivory) + `:734` connector lines `stroke:#94a3b8` hardcoded slate. `compliance-status-grid.tsx:47/169` `bg-gray-300` Missing dot. `profile-employment-tab.tsx:40` `text-gray-600` fallback. absence/leave `loading.tsx` skeleton shells lack `bg-card`. Visual call: `sky-50`/`blue-50` info banners on ivory.

**Learning** — token-clean (no raw colours). Real items: `course-card.tsx:40` + `enrolled-course-card.tsx:41` `shadow-sm` may be too faint on ivory (design-system §3 actually specifies `shadow-md` — doc/code disagree). `page.tsx:194` `bg-primary/5` hero (navy wash, may muddy). Skeletons + `lessons/[lessonId]:239` muted track on canvas. Intentionality: `preview-mode-banner.tsx` `border-amber-300` one-off; 4× duplicated inline status pills → extract `StatusBanner`; `completion-celebration.tsx:40` `green-500` border inconsistent. NB admin (`learning-admin/**`) not swept — separate pass.

**Resources** — cleanest (ADR-014 sweep landed). Items: ~5 now-redundant `bg-card` overrides on `outline` buttons (native-article-editor, resource-header-actions, glossary-filter) → drop. Stale "grey editor surround" comments. `plate-elements:193` `border-white`→`border-card`. Dead code: `ResourceSearch`, `ArticleRenderer` (unmounted). Same `shadow-sm` vs `shadow-md` question.

**Intranet non-feed** — clean of raw colours. STANDOUT: the **9 induction pages** are near-identical copy-paste `border-dashed border-border` empty-state boxes — generic greyscale scaffolding that a warm page makes look *more* unfinished. → one branded empty-state component (§6), not 9 dashed boxes. Plus checklist completed-row grey-on-grey; skeletons on canvas.

**Sign-in / notifications / settings** — settings + notifications clean. Problem CONCENTRATED in the sign-in calendar: `lib/sign-in.ts:128` `NOT_SET_CONFIG bg-gray-50/text-gray-400` (root — every empty cell grey-on-ivory) + `day-cell.tsx` (bg-gray-50/100, dashed border-gray-200/300, text-gray-300/400), `default-week-editor:235/287`, `location-picker-dialog:137`, `team-schedule-grid:229`. `bg-background` side panels (`day-detail-panel:103`, `team-calendar:175`) now ivory-on-ivory (don't separate) + the calendar wrapper boxes (`interactive-calendar:174`, `team-calendar:160`) are bare bordered boxes, not `bg-card` cards. `sign-in.ts:109` "Other" `bg-slate-100` (coolest).

---

## Remediation plan (prioritised)

**P1 — finish the surface layer (the colour rework's missing half):**
- **A · Neutral re-tune (F1).** Warm `--border/--input/--muted/--secondary/--accent/--table-header` toward ivory. ONE token change fixes the bulk (Learning borders/skeletons/hovers, Resources zebra/prose, intranet checklist, HR token-greys). Visual-tuned on ivory. Keep separate from Tailwind `gray/*` ramps the badges use.
- **B · Badge definition (F2).** Tonal border on badge variants so pills read on white/stripe/ivory.

**P2 — the bits a token re-tune WON'T fix (need explicit edits) + card separation:**
- **C · Raw-grey → token sweep.** Sign-in calendar cluster (start `sign-in.ts:128`), HR calendar/org-chart (gridlines, connectors `#94a3b8`, fallbacks), compliance dot, employment-tab fallback. These bypass tokens.
- **D · Card separation.** Reconcile `shadow-sm` (code) vs `shadow-md` (design-system §3) on cards against ivory; bg-background side panels → `bg-card` (sign-in panels + calendar boxes — decide card vs full-bleed).

**P3 — design-debt the audit surfaced (separable, genuine improvements):**
- **E · Induction empty-state component** — collapse 9 dashed-grey placeholders into one branded empty state (§6). Highest-value cleanup.
- **F · Shared `StatusBanner`/pill** (Learning 4× + preview banner); org-chart deliberate pass (recede vs surface, token connectors); delete dead code (`ResourceSearch`, `ArticleRenderer`); drop redundant `bg-card` overrides on outline buttons.

---

## P2-C delivery notes (sign-in + HR surface greys)

**🟢 SHIPPED (P2-C).** Token mapping for the raw greys that a `:root` re-tune can't reach (utility classes bypass tokens): empty/not-set fills `bg-gray-50`/`bg-slate-100` → `bg-muted`; hover-deepen → `bg-accent`; dashed dividers + empty-cell borders `border-gray-200/300` → `border-border`; faint label text `text-gray-400` → `text-muted-foreground`; faint icons `text-gray-300` → `text-muted-foreground/60` (kept lighter than the label); dark config fallbacks `text-gray-600/700` → `text-muted-foreground`/`text-foreground`. Sites: `lib/sign-in.ts` (NOT_SET_CONFIG + "Other"), `day-cell`, `default-week-editor`, `location-picker-dialog`, `team-schedule-grid`, `day-detail-panel`, `team-calendar`, plus HR `profile-employment-tab` fallback. The `.hex` config fields are unused (no consumers) and untouched.

**Compliance "Missing" dot** `bg-gray-300` → `bg-gray-400` at both the dot and its legend: this is a §1.7 *status* dot (siblings `amber-500`/`red-500`), so it stays on the Tailwind status ramp — just bumped one step for weight parity and to hold on white/ivory. Not a surface-token swap.

**Deliberately NOT in P2-C:**
- **Org-chart connectors** (`org-chart-content.tsx:734` `<style>` `stroke:#94a3b8`, `org-chart-person-card.tsx:56` `deptColour ?? "#94a3b8"`). A blind swap to `var(--border)` risks invisible 2px connectors on the chart panel; stroke weight needs a visual call. → **P3-F** (the org-chart deliberate pass), where recede-vs-surface is decided together.
- **`border-0` config badges** (F2 follow-up). The grep found **9** sites, not the 1 the audit assumed (`absence-dashboard`, `profile-absence-tab`, `flexible-working-detail` ×3, `flexible-working-dashboard`, `onboarding-*` ×3), all `{config.bgColour} {config.colour} border-0`. Fixing them means adding a `borderColour` to several config maps in `hr.ts` then dropping `border-0` — a config-schema change with its own review surface. → **own follow-up PR**, not folded into the surface sweep.
- **`certificates.ts`** greys (`#9ca3af`/`#d1d5db`) render the certificate PDF, not an on-ivory UI surface. Out of scope.
- **`kiosk-checkin`** `text-gray-400` is the search icon/placeholder *inside a white input* on the kiosk's own dark full-screen theme — correct in context, left alone.

---

## P2-D delivery notes (card separation on ivory)

**🟢 SHIPPED (P2-D).** Colin's call (shown the live preview first): bump card/table resting shadows `shadow-sm` → `shadow-md` so white cards lift off the ivory — measured `0 1px 2px` @5% → `0 4px 6px` + `0 2px 4px` @10%. Delivers ADR-014's "shadow carries separation" intent; before, the 1px border was doing the separating alone and the shadow was decorative. Applied to the `Card` + `DataTable` primitives (cascade widely), the inline `bg-card … shadow-sm overflow-clip` table/card wrappers, and the two learning course cards (base `md`, hover `md`→`lg` so they still rise on hover). design-system §1.6 already specified `shadow-md`; aligned the code + the `ui-components.md` / `lib/CLAUDE.md` wrapper strings to it.

**NOT bumped (deliberately left `shadow-sm`):** buttons (`bg-primary`/`success` variants), the bell unread badge, comment-count pills, Plate floating mini-controls, the org-chart floating toolbar, day-cell "today" ring + hover, selected-state rings, hover-only affordances — none are resting card surfaces.

**Documented exception — the article card.** `ARTICLE_CARD_CLASSES` (resources article view) deliberately stays `shadow-sm`: it's a large reading surface where `shadow-md` reads as a heavy slab (a prior "soft-retreat" decision, guarded by `article-constants.test.ts`). The bump's rationale is canvas separation; the article card's is recede-on-a-big-surface, which wins here. The sed initially caught it; reverted and the divergence is now recorded in the constant's comment.

**Side panels `bg-background` → `bg-card`.** The sign-in `day-detail-panel` + `team-calendar` side panels were ivory-on-ivory (didn't separate from the calendar canvas); now white `bg-card` panels with their existing `border-l`, reading as elevated.

---

## P3-F notes (cleanup + decomposition)

P3-F split into three because the pieces are unrelated:

**🟢 SHIPPED (P3-F cleanup).** Deleted verified-dead code — `ArticleRenderer` (388-line Tiptap-JSON renderer, superseded by the Plate static renderer per ADR-010; zero refs) and `ResourceSearch` (180-line per-module Algolia search, superseded by the Cmd+K global search; only a stale comment in `resources/actions.ts` referenced it) plus its test; repointed that comment at `global-search.tsx`. Dropped **10** redundant `bg-card` overrides on `outline` buttons across 6 files (the variant fills `bg-card` natively since ADR-014): `native-article-editor` ×2, `resource-header-actions` ×2, `glossary-filter` ×1, `people-calendar` ×2, `team-schedule-grid` ×2, `plate-glossary-elements` ×1. The first grep pass found 6; the AST ESLint rule `no-bg-card-on-outline` (added to enforce this) caught the other 4 the grep missed — including a multi-line case 7 lines below the `variant` attr.

**Org-chart pass — DROPPED.** Colin is rebuilding the org chart, so the deferred `#94a3b8` connector swap (`org-chart-content:734`, `org-chart-person-card:56`) and the `bg-muted/30` chart panel (`org-chart-content:661`) fold into that rebuild rather than a standalone fix. See `memory/org-chart-rebuild.md`.

**StatusBanner — no component; bug-fixing helper extracted.** The "Learning 4× duplicated status pills" didn't hold up. Enrolment-status pills (completed / in-progress / enrolled) live only in `course-card`. Due-date status renders in two places with different shapes — a compact `<Badge>` on `enrolled-course-card` vs a two-line alert block on the course detail page — so a shared UI component fits neither. But the due-date *computation* was duplicated and (Gemini review) hid a real boundary bug: `Math.ceil` of a sub-day overdue gap returns `-0`, so `-0 < 0` is false and a course overdue by under 24h showed "due soon" (amber) instead of "overdue" (red) on both sites. Extracted a unit-tested `getDueStatus(dueDate, now)` (`src/lib/learning.ts`) that classifies overdue on the raw timestamp, fixing both. The `<=14`-day list filters are a separate "upcoming" concept, left as-is. `preview-mode-banner.tsx` is used in 3 places (not dead).
