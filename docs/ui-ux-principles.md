# UI/UX principles and pattern catalogue

**Last reviewed:** 2026-05-04
**Owner:** Abdulmuiz Adaranijo
**Read this before:** designing any interactive surface where the user is meant to do something — notification surfaces, dashboards, forms, dialogs, tables, empty states, dense list views.

This is the companion to `docs/frontend-design-playbook.md`. The playbook covers aesthetic decisions: typography, colour, motion, anti-AI patterns. This document covers interaction design: how to sequence attention, where to put primary actions, when to interrupt the user, what an empty state should say. The two are upstream of `docs/design-system.md` (which fixes the brand tokens) and `docs/button-system.md` (which fixes the button rules).

The trigger for writing this was a notification banner design rated poor UX: five primary CTAs stacked on one surface, no visual hierarchy, the same blue button for everything. That kind of mistake is what this document exists to prevent. If a future Claude session is producing a UI surface and the result reads as generic SaaS, the cause is almost always one of the failures catalogued in §13.

The 13 sources behind this document are listed at the end with their verification status. Where a claim is load-bearing for a design decision, the relevant source is cited inline.

---

## 1. Foundations

The interaction design rules this whole document depends on. Five concepts, three thinkers.

### Affordances and signifiers (Don Norman)

An **affordance** is a relationship between an object and a user: the possible interactions an object permits. A door affords pushing or pulling; a button affords pressing. A **signifier** is the perceptible cue that tells a user the affordance exists. Per Norman: "the plate or button signals that it is meant to be pushed, while the bar or handle signals pulling" (source verified — Wikipedia summary of *The Design of Everyday Things*).

In a UI: the affordance is "this region is clickable"; the signifier is the cursor change, the hover state, the underline, the visual weight that distinguishes button from background. **A button without signifiers has the affordance but the user can't see it.** This is why icon-only buttons without tooltips fail. The affordance exists but no signifier conveys it.

### Mappings

Mapping is the relationship between controls and their effects. Good mappings are spatial and natural. Stove-top burners mapped to control knobs in the same physical arrangement is the canonical example. In UI: clicking "Delete" deletes the row you're hovering, not some other row. The user's mental model of what they did matches what the system did.

Bad mapping in our codebase has historically looked like: a confirm button that triggers a different operation than the dialog title implied; a kebab menu that operates on the parent row instead of the item it's attached to. Both make users hesitate before clicking next time.

### Feedback

Feedback closes the loop on user action. Norman: "the user receives full and continuous feedback about the results of the actions" (source verified). Three response-time thresholds matter (NN/g, source verified — `nngroup.com/articles/response-times-3-important-limits/`):

- **0.1s** — instantaneous; no special feedback needed beyond the result.
- **1.0s** — user notices delay but maintains flow; show a state change.
- **10s** — user disengages; show a progress indicator with cancel.

The MCR codebase enforces this via `<ButtonSpinner>` + verb-ing labels ("Saving...") on every server-action button. A click with no visible state change is the most common UX failure mode in the app: the user clicks again, double-submits, gets confused.

### Cognitive load (Krug)

Steve Krug's central thesis: "a good software program or web site should let users accomplish their intended tasks as easily and directly as possible" (source verified — Wikipedia summary). The principle is "Don't Make Me Think". Strip everything that requires interpretation, hesitation, or comparison. Krug observed that users *satisfice*: they take the first plausible option rather than the optimal one. A design that requires comparison between five primary CTAs to find the right one has already lost.

For the intranet specifically: every staff member uses this app for HR, learning, sign-in, and the news feed. Visual fatigue compounds across 8-hour days. Every cognitive task we add ("is this Save or Submit?", "which of these is the main action?") is paid for in fatigue.

### Scannability (NN/g)

Users don't read web pages, they scan. NN/g's research: 79% of users scan, 16% read word-for-word (source verified — `nngroup.com/articles/how-users-read-on-the-web/`). Scannable text uses:

- Highlighted keywords (links, weight, colour as a redundant cue).
- Practical sub-headings (not creative ones).
- Bulleted lists.
- One idea per paragraph.
- Inverted pyramid (conclusion first).

NN/g found that combining concise, scannable, objective writing yielded 124% better usability than promotional versions (source verified). The MCR intranet's empty states, error messages, and dialog titles all sit in the scan path; they're never read in full. Front-load the verb. Short labels beat long ones.

### Consistency (Material, NN/g, Nielsen)

Nielsen's heuristic 4: "Users should not have to wonder whether different words, situations, or actions mean the same thing. Follow platform and industry conventions" (source verified — `nngroup.com/articles/ten-usability-heuristics/`). This is why we don't reinvent kebab menus, why "Cancel" sits left and the primary CTA sits right in dialogs, why a destructive action is always behind a confirmation. The cost of being clever is the cost of every user pausing to learn the new convention.

The MCR intranet's consistency rules live in `docs/button-system.md`, `docs/design-system.md`, and `src/lib/CLAUDE.md`. Don't break them without an explicit reason captured in the relevant doc.

### The five rolled together

Affordances tell the user what they *can* do. Signifiers tell them *how* to do it. Mappings tell them *which control* does what. Feedback tells them *whether it worked*. Consistency means they only learn each rule once. Cognitive load is the budget. Every time you require interpretation, you spend some of it.

---

## 2. Visual hierarchy

NN/g defines visual hierarchy as "the organization of the design elements on the page so that the eye is guided to consume each design element in the order of intended importance" (source verified — `nngroup.com/articles/visual-hierarchy-ux-definition/`).

The three primary techniques (NN/g, source verified):

1. **Colour and contrast** — including type contrast (bold, italic). Contrast in *value and saturation* between elements creates hierarchy, not the colour itself. A colour-blind user should still see the hierarchy if the value contrast is right.
2. **Scale** — larger elements signal importance. NN/g recommends no more than three size variations.
3. **Grouping via proximity and white space** — implicit grouping through proximity, explicit grouping through containers or borders.

Refactoring UI by Adam Wathan and Steve Schoger codifies this for product UI specifically (source uncertain — Refactoring UI homepage didn't extract via fetch; this is based on prior knowledge of the book and its widely-cited tactics). Their core moves:

### Hierarchy without colour overload

The mistake: relying on colour as the only hierarchy signal. If the page has navy, pink, teal, and orange all at the same intensity, the user doesn't know where to look. The fix: use colour sparingly as a *third* signal; use weight and size first.

```tsx
// Wrong — three competing colours, no weight hierarchy
<h2 className="text-xl text-pink-600">Section title</h2>
<p className="text-base text-teal-600">Body copy</p>
<a className="text-base text-blue-600">Link</a>

// Right — one colour, weight does the work
<h2 className="text-xl font-semibold text-foreground">Section title</h2>
<p className="text-base text-foreground">Body copy</p>
<a className="text-base text-link underline">Link</a>
```

The hierarchy reads from weight (semibold > regular) and only the link gets a colour distinction because it has a behavioural meaning, not an importance meaning. This matches the MCR intranet pattern: navy is for committed action, pink is the rare brand accent, teal is for links. Decoration colour is a smell.

### Spacing as hierarchy

Increasing space between groups separates them more reliably than borders or background colours. A 32px gap between sections reads as "different concerns"; a 12px gap reads as "same concern, different items". The Tailwind `space-y-*` rhythm in our pages (`space-y-6` for unrelated sections, `space-y-2` inside one section) does this work without ever drawing a divider.

### Position

The top-left corner is the strongest position in left-to-right reading languages. Use it for the most important thing on the surface. NN/g's F-pattern research (source: prior knowledge — frequently cited NN/g finding) shows users scan in an F shape on text-heavy pages: the first horizontal line, the second horizontal line (less complete), then a vertical scan down the left edge. Important content goes top and left.

### Before and after

**Before** (poor hierarchy, generic):
```
[Heading 16px regular]
[Body text 16px regular]
[Button: View details — 14px primary]
```
Everything reads at the same weight. The button competes with the body for attention.

**After** (clear hierarchy):
```
[Heading 24px semibold — pulls the eye]
[Body text 15px regular muted-foreground]
[Button: View details — 14px outline secondary]
```
The eye lands on the heading. The body explains. The button is a secondary action because the surface itself is informational, not transactional.

### When colour IS the right hierarchy signal

For *behavioural* signals only: primary CTA stands out from secondary CTAs. Status colour conveys meaning (green success, amber warning, red error). Link colour distinguishes interactive text from body. Never use colour to convey "this section is more important than that section". Use weight and spacing instead.

---

## 3. Action button hierarchy

The W3 mistake (five primary CTAs stacked on one surface) is the single most diagnostic UX failure for AI-generated UI. The fix is the rule: **one primary action per atomic UI unit.**

This is not a Claude-specific rule. Atlassian, GitHub Primer, Shopify Polaris, IBM Carbon all enforce some version of "one primary per surface" (source: GitHub Primer's seven-role colour model fetched directly; Atlassian and Polaris from prior knowledge of their published guidance). The MCR rule lives in `docs/button-system.md`: "One primary per atomic UI unit. Atomic units: dialog, page header, card, toolbar row, empty state, confirmation banner. At most one `default` / `success` / `destructive` per unit. Alternative actions use `outline` or `secondary`."

### When the surface has multiple actions of equal weight

This is the case the W3 banner mock failed on: five attention items, each with a "Take me there" CTA. The right answer is *not* five primary buttons. Three options:

1. **Demote all to secondary or link.** If the items are list entries, the row itself is the affordance — clicking the row navigates. No button per row.
2. **Pick one as the primary** based on user attention budget. The most urgent item gets the navy `default` button; the rest get `outline` or `link`. The user's eye follows the colour signal.
3. **Group into a single primary that opens a list.** A "View all 5 attention items" `default` button leading to a full-page view. The list page itself can have one primary action per row safely because each row is its own atomic unit.

For the W3-rev notification centre specifically, option 2 dominates: the popover is a list, each row is a notification, the row itself is the link, and inline actions are `ghost` icon buttons (Mark read, Done). The bell-trigger button itself is the only `ghost` button on the layout chrome.

### Row-level CTAs in tables

Each row in a data table has its own actions. Are they primary? **No.** They're at most secondary. The `docs/button-system.md` row-action pattern: pure-icon `ghost` `icon-sm` for low-frequency actions, kebab menu for everything destructive or rare. The reasoning: a 50-row table with a navy "Edit" button on every row turns into 50 navy rectangles, which means none of them stand out, which means hierarchy is gone.

Compare:
- Linear's task list: each row is a link, no buttons. Row hover reveals a quick-action toolbar. The whole row is the affordance.
- GitHub's PR list: each row is a link. Status badges convey state. No CTAs.
- Notion's database view: each row is a link. Properties are visible inline. No CTAs.

Across these top-tier products, **zero of them put a primary button on each row**. The MCR intranet's data tables follow the same pattern: kebab menus where actions exist, plain Link wrappers where they don't.

### Secondary and tertiary

`outline` is the secondary fill on coloured backgrounds. `secondary` (pale blue-grey) is the secondary fill in dialog footers. `ghost` is the tertiary — utility actions, kebabs, toolbar icons. The MCR rule: never use `ghost` for the primary CTA of a view (the comment editor Save regression caught in PR #282 is the canonical example).

The order of intent (from `docs/button-system.md`):
- `default` (navy) → routine commits.
- `success` (forest green) → irreversible positive commits (Approve, Publish, Enrol).
- `destructive` (wine) → confirmation-dialog only; never inline.
- `secondary` → Cancel, Reset, Clear.
- `outline` → secondary actions on cards and coloured backgrounds.
- `ghost` → utility, row actions, toolbar.
- `link` → inline navigation styled as text.

If you reach for `default` more than once on a surface, you've hit the W3 mistake.

---

## 4. Density and information architecture

Density is the count of information per square pixel. Too sparse and the user scrolls forever. Too dense and they squint and miss things. The right answer is context-dependent.

### When sparse is right

- **Marketing and landing surfaces.** One thought per fold; lots of whitespace. The user is here to browse.
- **First-time onboarding.** New_user induction screens, welcome states. The cognitive budget is low; lower the density.
- **Decision surfaces.** A confirmation dialog with three lines of body text and two buttons. The user is here to make one choice.
- **Hero / brand moments.** The home dashboard greeting line, the kiosk check-in screen. Density would dilute the brand statement.

Apple HIG codifies this: the three-principle "deference, clarity, depth" model says UI defers to content, content is clear, depth indicates hierarchy (source uncertain — Apple's HIG didn't extract via fetch; this is based on Apple's longstanding published guidance). Translated to product UI: don't decorate the chrome.

### When dense is right

- **Data management surfaces.** HR Users table, Compliance dashboard, Sign-in entries. The user is here to scan, sort, and act on dozens of rows.
- **Power-user tools.** Editor toolbars, dropdown menus, kebab menus with 6+ items.
- **Reference content.** Documentation tables of contents, resource catalogues with many categories.

IBM Carbon's grid model offers density tiers — compact, default, comfortable — and lets the consumer pick (source uncertain — Carbon's density tiers didn't extract directly; based on prior knowledge of Carbon documentation). The MCR intranet picks one density per context: tables get compact-default (TanStack defaults), forms get default-comfortable (Shadcn Input + Label spacing).

### The MCR intranet specifically

The pattern is settled by `src/lib/CLAUDE.md` and the table-standardisation work:

- **Page background** is grey `#F2F4F7` with comfortable spacing.
- **Cards on the background** use `bg-card rounded-xl border border-border shadow-sm overflow-clip`. The `rounded-xl` and shadow signal "this is a contained surface".
- **Tables inside cards** use compact padding (`px-4 py-3`) — dense by design because tables are scan-targets.
- **Forms inside cards** use `space-y-4` between fields, `space-y-2` between label-and-input pairs. Comfortable.
- **Sidebar nav** uses `space-y-1` per item. Dense because there are many items, and each one is a target the user already knows.

### Per-row spacing

NN/g does not give a single spacing recommendation, but their dashboard preattentive-processing research (source verified) shows that quantitative comparisons (length, position) are read faster than colour-coded categorical groups. Translated: tight rows let the eye scan a column; loose rows turn the table into individual cards. Pick one per surface and stay consistent.

The standardised data-table pattern: `h-12` headers, `py-3` body cells. That's tighter than a card list and looser than a Bloomberg terminal. It works because the rows are striped (`odd:bg-muted/50`), the borders are subtle, and the kebab menu folds the rare actions away.

### Inline vs stacked

For form fields:
- **Stacked** (label above input) is the default. Single-column reads top-to-bottom; the label-input pairing is unambiguous; works at any width.
- **Inline** (label beside input) is for very short fields in a horizontal toolbar (e.g. filter "Status: [Active]"). Saves vertical space; only works when the label is short and the input is small.

NN/g and Polaris both favour stacked single-column for the primary path (source: NN/g's form-design rules came back as 404, but this is widely-cited Polaris and Material guidance — source uncertain, prior knowledge). The MCR intranet's HR forms, leave forms, and resource forms all use stacked single-column.

### When the same surface mixes densities

Avoid it where possible. A page that has a sparse hero, dense data table, then sparse "related links" reads as three different products. If you must mix, separate visually with `space-y-8` or a divider, and signal intent. The dense block reads as "data" and the sparse blocks as "context". The intranet's dashboards (HR, Learning admin) follow this: hero card with greeting, then dense data, then sparse footer.

---

## 5. Affordances and signifiers

Norman's distinction matters in UI because **affordances are invisible without signifiers**. Hover state, cursor change, button styling: these are the signifiers that tell users which pixels do something.

### The signifier checklist for any clickable element

1. **Cursor changes to pointer** on hover. CSS `cursor: pointer` on every button-like element.
2. **Hover state changes the visual.** Background tint shift, slight elevation, colour change. Not just a cursor.
3. **Focus state is visible** for keyboard users. The MCR rule: `*:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }` in `globals.css`. Don't override per-component.
4. **Disabled state is visibly different.** Lower opacity, no hover tint, `cursor: not-allowed`. With a tooltip explaining why (`<TooltipButton reason="...">`).
5. **The element looks like its kind.** A button looks like a button. A link looks like a link (underlined). A card that's clickable looks elevated; a card that's not looks flat.

### Icon-only buttons

The most common signifier failure. NN/g: "a text label must be present alongside an icon" — labels should be permanent, not hidden behind hover (source verified — `nngroup.com/articles/icon-usability/`). Few icons are universally recognised; the article names "home, print, and the magnifying glass for search" as the rare exceptions.

The MCR rule: every icon-only button must have *both* `aria-label` (screen reader) and `title` (sighted hover tooltip). The `<TooltipButton>` helper is for the disabled-state case.

When can an icon-only button skip the visible label? Only when:
- Density forces it (table row actions, toolbar buttons in a dense composer).
- The icon is one of the rare universally-recognised set.
- A tooltip is reachable in <500ms.
- A screen reader gets a clear `aria-label`.

The kebab (`MoreHorizontal`) icon is the one icon-only pattern that works without a visible label across every audited platform; it's universally read as "more actions". Even then, `aria-label="Actions for {entity}"` is mandatory.

### Hover-revealed actions on touch devices

Hover doesn't exist on touch. An "edit" button that only appears on row hover is invisible to a Chromebook touch user. The MCR pattern: `@media (hover: none) { .hover-reveal { display: flex; } }` shows the action permanently when hover is unavailable. The `CardActionsKebab` reference component does this.

### Cursor signals

`cursor: pointer` on clickable elements is mandatory. `cursor: not-allowed` on disabled. `cursor: grab` / `cursor: grabbing` on draggable. `cursor: zoom-in` on lightbox-triggers. The cursor is a free signifier — use it.

### When the affordance is the row, not the button

If clicking anywhere on a row navigates, the *row* is the affordance. Signifier: `hover:bg-muted/50` and `cursor: pointer` on the row, and keep the entire row content inside one `<Link>`. The MCR pattern from `src/lib/CLAUDE.md`: "Clickable rows: put a `<Link>` in the title cell, not `onClick` on the row." This avoids nested-interactive-elements bugs while keeping the affordance visible.

---

## 6. Empty states

NN/g identifies three jobs an empty state can do (source verified — `nngroup.com/articles/empty-state-interface-design/`):

1. **Communicate system status.** "No records to display for the selected date range" — tells the user the system is working, just no data matches.
2. **Provide learning cues.** "Star your favourites to list them here" — teaches the feature without an intrusive tour.
3. **Provide pathways.** "Add your first compliance course" with a button leading directly to the action.

The right copy depends on which of three states you're in.

### First-time empty (educate)

The user has never used this feature. The empty state's job is to *teach*. Use:
- A short explanation of what this surface is for.
- A clear primary CTA to do the first thing.
- A visual — illustration or icon — to soften the bareness.

Example for the L&D learner dashboard before any course is enrolled:
> Heading: "No courses yet"
> Body: "Your line manager will assign courses, or you can browse the catalogue."
> CTA: `<Button>Browse catalogue</Button>`

### Filtered empty (clear filter)

The user has searched or filtered, and the result set is empty. The state is *temporary*. Use:
- A message that says the search came back empty.
- A pathway back — clear the filter, broaden the search.
- No "first action" CTA, because the action exists, just not at this filter.

Example for a Resources article search:
> Heading: "No articles match 'asbestos'"
> Body: "Try a broader keyword, or browse by category."
> CTA: `<Button variant="outline">Clear search</Button>`

### Zero-state empty (celebrate or be silent)

The user has reached an inbox-zero state: no notifications, no overdue items, no pending tasks. The state is *good news*. Two options:

- **Celebrate** — for moments where reaching empty is a real achievement (W3-rev notification centre: "All caught up").
- **Be silent** — for routine empty states (no upcoming key dates this month). A soft, single-line acknowledgement; no illustration, no CTA.

The MCR W3-rev notification centre uses a celebrate state with a CC0-illustration upgrade planned for v1.1 (per `memory/intranet-design-feedback.md`). The v1 implementation uses an icon (Lucide `Inbox` or `BellOff`) plus the text "All caught up". Cheap, ships with the feature.

### Voice and tone

NN/g's research on promotional language found that 79% of users scan and that "marketese" (boastful, promotional copy) actively reduces usability (source verified). For empty states this means:
- **No "Awesome!" or "Great!"** — these read as the chat-app artefacts the humanizer rules ban.
- **Short, direct, friendly.** "All caught up." "No matches." "Nothing here yet."
- **British English, not US.** "Browse catalogue", not "Browse the catalog".
- **Explain the *why* if it's not obvious.** "No records this month — check the filter, or come back tomorrow."

### Anti-patterns

Avoid:
- **Joke empty states.** "Looks like you've been a busy bee!" gets stale on the third encounter.
- **Generic "No data" with no pathway.** Tells the user nothing.
- **An illustration with no text.** Pretty but unactionable.
- **A primary CTA that doesn't match the user's role.** A "Create course" CTA on a learner's empty state is wrong — the affordance doesn't exist for that role.

---

## 7. Feedback and timing

Feedback is the closing-the-loop signal that tells the user the system received their action. NN/g's three response thresholds (source verified — `nngroup.com/articles/response-times-3-important-limits/`):

- **<0.1s** — no feedback needed; the result *is* the feedback.
- **0.1s–1s** — show a state change (button visibly transitions to "Saving...").
- **>1s** — show a progress indicator and disable the trigger to prevent double-submit.
- **>10s** — show a progress bar, allow cancel, send a notification on completion.

### Loading states

NN/g's research distinguishes (source verified — `nngroup.com/articles/skeleton-screens/`):

- **Spinners** for individual modules, 2–10s, when you can't show the page structure yet.
- **Skeleton screens** for full-page loads under 10s — wireframe placeholders matching the eventual layout.
- **Progress bars** for >10s operations with a known duration estimate.

The MCR codebase uses `<ButtonSpinner>` for in-flight server actions, the standard Shadcn Skeleton for loading lists, and animated progress bars for course completion percentages.

**Avoid**: frame-only skeletons (header and footer with no content placeholder). NN/g notes these "feel equivalent to spinners" because they don't communicate structure (source verified).

### Error states — three surfaces

NN/g (source verified — `nngroup.com/articles/error-message-guidelines/`):
- **Inline** (next to the field) — for form validation. The message stays adjacent to the problem; the user fixes and continues.
- **Toast** (transient banner) — for non-blocking failures (network hiccup, save retry). Match severity to surface.
- **Modal** — for catastrophic, irreversible failures only.

NN/g's error-message rules:
- Plain language, no jargon.
- Specific and concrete ("Email already in use" not "Validation failed").
- Tells the user what to do next.
- Polite; never blames the user.
- Preserve user input — don't make them re-type.

### Confirmation states

Three options:
- **Toast** — the standard. "Saved" or "Article published" appears briefly, dismisses itself. Non-blocking, low-cost, correct for routine commits.
- **Inline** — for in-context confirmations ("Profile updated" appearing next to the field). Useful when the user is mid-flow.
- **None** — for *truly* trivial actions (toggle a switch, mark as read). The state change *is* the confirmation; an extra toast is noise.

The MCR codebase uses `sonner` toasts uniformly. The rule: confirm successful commits. Don't confirm idempotent state changes (read/unread, expand/collapse).

### Microinteractions

Small motion details that signal state. The Button's tap-scale animation (`motion-safe:active:scale-95`) is one. Hover lift on a card is another. NN/g's aesthetic-usability effect (source verified — `nngroup.com/articles/aesthetic-usability-effect/`) says polished motion makes the product feel more usable, even when usability is identical. Use sparingly — every motion claims attention.

---

## 8. Pattern catalogue: forms

Forms are where the user *commits*. Get the pattern right or lose the user mid-input.

### Layout: single column

Polaris, NN/g, Material, Atlassian all converge on single-column layout for forms (source: this is widely-published guidance across all four; direct fetches mostly returned 404 or truncated content, so source uncertain — prior knowledge). The reasoning:

- The eye reads top-to-bottom predictably.
- Tab order matches visual order (no horizontal-then-vertical confusion).
- Works at any viewport width without rearrangement.
- Mobile responds without media-query rewrites.

Two-column layouts are acceptable only when the fields are genuinely paired (First name | Last name; Address line 1 | Address line 2). Even then, a single column rarely costs more than two scrolls and reads more clearly.

### Label position

**Above the input** is the default. The label is read left-to-right then the input is read left-to-right; one cognitive sweep per field. NN/g's eye-tracking research supports this (source uncertain — frequently cited but the article didn't fetch).

**Beside the input** (label-left) is acceptable in dense forms with very short labels, but only on wide screens — it breaks on mobile.

**Inside the input** (placeholder-as-label) is an anti-pattern. Once the user starts typing, the label disappears, and they may forget what the field was. The MCR codebase uses Shadcn `<Label>` above `<Input>` everywhere; placeholder is reserved for *example* text ("Enter email address").

### Required indicators

- An asterisk (`*`) after the label, with a legend at the top of the form ("Required fields are marked with *").
- *Or* the inverse: mark optional fields with "(optional)" and assume everything else is required.
- The MCR pattern: required fields marked with `*`. Optional fields are unmarked. This matches Polaris and Atlassian (source uncertain — published guidance from both, prior knowledge).

Don't rely on red colour alone to signal "required". It fails for colour-blind users.

### Validation timing

Three timings, in order of friendliness:
1. **On submit** — validate when the user clicks the primary CTA. Returns errors inline. Friendliest for new fields.
2. **On blur** — validate when the user leaves a field. Catches errors as the user moves on, doesn't interrupt typing.
3. **On change** — validate every keystroke. Useful for password complexity ("8 characters, one number, one symbol") where real-time feedback helps. Hostile for everything else.

The MCR pattern: on submit for most forms, on blur for email and unique-username fields where async checks make sense.

### Error messaging

NN/g's rules (source verified):
- Adjacent to the problem field.
- Bold, high-contrast (the destructive token: `text-destructive`).
- Redundant signal — don't rely on colour alone. Add an icon or text label.
- Plain language, specific, constructive.
- Never blame the user.

Examples:
- Bad: "Invalid input."
- Good: "Email must include an '@' symbol."

The MCR codebase uses Zod schemas with `react-hook-form` for validation, surfacing errors inline below the field via Shadcn `<FormMessage>`.

### Multi-step wizards

Use when:
- The form has more than ~10 fields.
- Fields naturally group (Personal details → Address → Confirmation).
- Earlier inputs determine which later inputs to show (conditional flow).

Wizard rules:
- Show progress — "Step 2 of 4" or a step indicator.
- Allow back navigation. Never lose user input on back.
- Save draft — if the form is long, give the user a way to leave and return.
- The *last* step is the commit; intermediate steps don't trigger destructive operations.

The MCR L&D admin course builder uses this pattern (course → sections → quizzes → publish). The HR onboarding flow uses it for the new starter checklist.

### Submit button

- One primary per form (never two side-by-side).
- Verb-first label: "Save changes", "Submit request", "Add asset". Not "OK" or "Done".
- Disabled-on-pending with `<ButtonSpinner>` and verb-ing label ("Saving...").
- The Cancel sits left as `secondary`; the primary sits right as `default` / `success`. (`docs/button-system.md`.)

### Inline forms

A short form embedded in another surface (comment composer, quick-add). Same rules: single column, label above input (or use placeholder text *only when context already establishes the field's meaning*). Submit button can be `default` size or `icon` size for a chat-style input (with `rounded-full` for the chat-bubble convention per `docs/button-system.md`).

---

## 9. Pattern catalogue: tables and lists

Tables are where data lives. The MCR intranet has 21 standardised data tables, all built on TanStack Table + Shadcn primitives. The pattern is fixed; this section is about how to use it.

### When to use a table vs a list

- **Table** — multiple comparable attributes per row, user wants to sort/filter/scan.
- **List** — single attribute per item plus optional metadata, user reads sequentially.
- **Grid** — items are visual (cards, images, avatars) and the comparison is by appearance.

The MCR pattern: tables for HR Users, Compliance, Assets, Sign-in entries, Leave requests. Lists for activity feeds, recent items, bookmarks. Grids for resource categories, course catalogues.

### Density

The standardised TanStack table uses `h-12` headers, `py-3` body cells. This is the agreed density per `src/lib/CLAUDE.md`. Don't override it per-table; every override is a reason for the next reader to pick a different value.

### Sorting

Sortable columns use `<DataTableColumnHeader>` (a ghost button with chevron icon). Click toggles asc → desc → unsorted. NN/g's preattentive research (source verified — `nngroup.com/articles/dashboards-preattentive/`) supports this: position-based comparison is fast, so sorted columns let users scan vertically without conscious effort.

For computed/derived sort values, use `accessorFn` returning a numeric value while the `cell` renders the badge or text. This is the pattern in `src/lib/CLAUDE.md` for the priority column.

### Filtering

External to TanStack: passed as pre-filtered data via `useMemo`. The DataTable's built-in `searchKey` only filters one column. Multi-field search (e.g. "name OR email OR department") uses an external input with `useMemo` to filter the row array.

Filter chips above the table use `<Button variant="outline" aria-pressed={pressed}>` for the toggle pattern. The chip-as-filter pattern is from Linear and Notion (source uncertain — prior knowledge of those products).

### Pagination vs infinite scroll

Pagination wins for tables. Infinite scroll wins for activity feeds.

Why pagination for tables:
- The user sorts and filters and wants to know "how many results in total".
- Page numbers are addressable — "row 47 is on page 3".
- Footer "Showing X of Y" sets expectations.

The MCR pattern uses `<DataTable>` with built-in pagination. Page size 25 is the default; surfaces with many rows (HR Users) can bump to 50.

Infinite scroll for the news feed makes sense because the feed is browsed, not searched. Pagination would interrupt the scroll.

### Row hover

The Shadcn `<TableRow>` has `odd:bg-muted/50` for zebra striping. Add `hover:bg-muted` for row hover. Don't add a click handler to the entire row; use a `<Link>` inside the title cell instead (per `src/lib/CLAUDE.md`).

### Row actions: kebab vs inline

The decision tree from `docs/button-system.md`:

1. Table already has a kebab? Fold destructive into it.
2. Row has 3+ action icons? Consolidate all into a kebab.
3. Destructive action is hard-delete or GDPR-sensitive? Kebab mandatory.
4. Destructive is high-frequency, reversible, multi-use per session? Inline with tinted hover.
5. No kebab, 2 actions, low frequency? New kebab.
6. No kebab, 2 actions, high frequency, reversible? Inline with tinted hover.

Rule 3 overrides 4. Data-loss prevention beats click-efficiency.

The MCR audited stance: zero of six top SaaS tools (Linear, Notion, GitHub, Airtable, Jira, Asana) put a coloured destructive icon inline. Kebab everywhere is the safe default.

### Empty table

Don't show an empty table chrome with "No data". Show a card-style empty state in the table body that takes the full width, with one of the three empty-state types from §6 (first-time, filtered, zero-state).

### Lightweight tables

For 2–10 rows, read-only, use Shadcn Table primitives directly with the same wrapper. Pattern in `src/lib/CLAUDE.md`:

```tsx
<div className="bg-card rounded-xl border border-border shadow-sm overflow-clip">
  <Table>
    <TableHeader>
      <TableRow className="hover:bg-background odd:bg-background">
        ...
```

No TanStack overhead, same visual treatment.

---

## 10. Pattern catalogue: dialogs and modals

NN/g (source verified — `nngroup.com/articles/modal-nonmodal-dialog/`): "Modal dialogs have numerous disadvantages and costs to users. In order for these costs to be justified, their relevance to the task and importance should be high."

### When to use a modal

NN/g lists four valid cases:
1. **Critical errors / warnings** — to interrupt before disaster ("Delete 47 records?").
2. **Essential information** — when the system genuinely cannot continue.
3. **Complex workflows** — break a long task into modal-sized steps.
4. **Streamlined effort** — progressive profiling that reduces total work.

### When NOT to use a modal

NN/g lists clearly:
- Newsletter signups ("generates visceral disdain").
- Non-essential information unrelated to the current task.
- High-stakes processes like checkout (modals block the user from referencing other tabs).
- Complex decisions that need external information.

### Confirmation patterns

The MCR rule (from `MEMORY.md` workflow rules): **always add confirmation dialogs for destructive actions**. The pattern from `docs/button-system.md`:

```tsx
<AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
  Cancel
</AlertDialogCancel>
<AlertDialogAction
  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
  onClick={handleDelete}
>
  Delete
</AlertDialogAction>
```

Order: Cancel left, primary action right. Always.

### Modal vs drawer vs inline

- **Modal** — central, blocks the surface, demands attention. For confirmations and short forms.
- **Drawer** (right-side sheet) — slides in, dismissible, doesn't fully block. For longer forms (article editor, course detail) where the user might want to reference the underlying surface.
- **Inline** — expands the existing surface. For quick edits where the user stays in flow (rename, in-place edit).

The MCR pattern uses Shadcn `<Dialog>` for confirmations and short forms, Shadcn `<Sheet>` for drawers (notification settings, attachment lightbox), and inline editing for renames in tables.

### Focus trapping

Radix Dialog handles focus trap by default. Don't override. Initial focus lands on the first focusable element; Tab cycles within the modal; Escape closes.

The exception is the attachment lightbox (image and PDF preview) which uses a custom Dialog implementation; focus is on the close button by default per `docs/design-system.md` §1.9.

### Dismissal patterns

NN/g (source verified): users want predictable dismissal. The standards:
- **Click outside** — closes the modal (for non-destructive). Skip this for destructive confirmations to prevent accidental dismiss.
- **Escape key** — always closes.
- **Cancel button** — always closes.
- **X button top-right** — closes for non-modal, optional for modal (Radix provides it).

For destructive confirmations, both click-outside and Escape should close the modal *without* triggering the destructive action. The destructive action requires explicit click of the primary CTA.

### IBM Carbon and Microsoft Fluent

Carbon distinguishes passive, transactional, focus, and danger modal types (source uncertain — Carbon's modal docs returned truncated content; this is from prior knowledge). Fluent treats dialogs as part of a layered "elevation" system where each layer has a fixed elevation token (source uncertain — Fluent's site returned 404 on direct fetch; this is prior knowledge of the published Fluent system). The MCR doesn't formalise these tiers — Shadcn Dialog handles all four cases, with class-string differences for severity.

### Anti-patterns

- **Modal opens automatically on page load** for newsletter / cookie consent. Banned outside of legal compliance requirements.
- **Two modals stacked.** A confirmation inside an open form modal. Use a single modal with two states, or a non-modal toast.
- **Modal with no primary CTA.** If the user must dismiss to do anything, it's an interruption, not a dialog.
- **Modal that dismisses on click-outside for destructive actions.** Easy to accidentally cancel; harder to undo.

---

## 11. Pattern catalogue: dashboards

Dashboards are where the user lands and decides what to do next. The MCR intranet has three: HR home, Learning home, the intranet news feed. The W3-rev work redefines the intranet home; see `memory/intranet-design-feedback.md` for the locked scope.

### Card grids vs lists

Card grids are the AI-bland default: three identical cards per row with the same shadow and rounded corner. Avoid by default unless the cards are visually meaningful (course thumbnails, person avatars).

Lists are stronger when items have temporal order (newest first), text-heavy content (titles, descriptions), or one-row-per-item semantics (notifications, bookmarks). The MCR news feed is a list, not a grid.

NN/g's preattentive research (source verified) supports lists for scan-heavy content: position is a fast preattentive attribute, and reading down a list uses position. Cards force the eye to bounce between rows and columns.

### Widget design

A widget is a self-contained card on the dashboard surface. Rules:
- One thing per widget. "Recent activity" or "Upcoming key dates", not both.
- Title bar with the widget name.
- Body with the data.
- Footer with one action (View all, Manage, See more) — *one* action per widget.
- Empty state inside the widget when the data is empty.

The MCR HR dashboard widgets follow this. Widgets that try to be multi-purpose ("Recent activity & upcoming events & overdue items") become unscannable.

### Persistent vs ephemeral content

- **Persistent** — content that's the same on every visit (the company news feed, the team list). Surfaces this is "the always-true content of this dashboard".
- **Ephemeral** — content that changes per session (today's working location prompt, attention items needing action). Surfaces this is "what's new since you last looked".

The W3-rev decision: ephemeral attention items move out of dashboard banners and into the unified notification centre (bell + popover + full-page). The dashboard becomes the *persistent* surface; the bell becomes the *ephemeral* surface (source: `memory/intranet-design-feedback.md` W3-rev locked scope).

This matters for design hygiene: a dashboard that mixes persistent and ephemeral content forces the user to re-evaluate the entire surface every visit. Splitting them lets the dashboard be predictable and the notification surface be the one place that changes.

### Personalisation

Two flavours:
- **Role-based** — staff sees the news feed, manager also sees pending leave approvals, admin also sees the admin dashboard. Implemented as gates on widget visibility, not as user preferences.
- **User-controlled** — bookmarks, saved searches, dismissed reminders. Stored in Supabase and synced across devices.

The MCR intranet has limited user-controlled personalisation by design. At ~80 staff, personalisation overhead exceeds its value. Per `MEMORY.md` workflow rules: "Anchor UX suggestions against actual scale (~80 users, ~5 editors) before proposing search/filters/pagination."

### The W3-rev decision

The W3-rev redirect (per `memory/intranet-design-feedback.md`) is the most important dashboard decision the codebase has made. Original W3 plan: build attention banners on the home page. Final decision: route all attention items into the existing notification centre. Reasoning: a parallel attention surface duplicates the bell and forces the user to scan two places. One unified inbox is the cleaner model.

Translated for future Claude work: **don't build attention banners on the home dashboard.** If a feature wants to surface "you have X to do", route it through `notifications` with a `source_kind` and let the bell handle it. The dashboard's job is the persistent stuff.

### Hero / greeting

The Notion Calendar pattern: "Good afternoon, Colin." as a quiet typographic moment above the feed. Time-of-day buckets (morning < 12, afternoon 12–18, evening 18+) Europe/London. Server-rendered. No animation, no decoration.

The MCR W3-rev locked scope places this on `/intranet` and `/admin`, suppressed for users with `induction_completed_at IS NULL` (per `memory/intranet-design-feedback.md`).

### Anti-patterns

- **Empty card grid above the fold.** First-time users see a grid of empty cards and bounce. Use a different layout for the first-time state.
- **Auto-rotating carousels.** No user wants the carousel to advance on a timer (per `docs/frontend-design-playbook.md` §4 motion rules).
- **Mixed-density widgets.** A widget with a hero greeting next to a dense table next to a 3-up grid reads as three different products.
- **More than one primary CTA visible at any scroll depth.** The W3 mistake — every widget had its own "Take me there" navy button. Demote to outline.

---

## 12. Pattern catalogue: notification surfaces

The W3-rev surface is the most worked-through dashboard pattern in the MCR codebase, with the locked scope from `memory/intranet-design-feedback.md`. This section captures the principles so future Claude sessions extend it correctly.

### The bell + popover + full-page combo

The pattern (source: locked scope per `memory/intranet-design-feedback.md`, anchored to GitHub Inbox model):

- **Bell** in the layout header. Number badge with real count (9+ ceiling). Always opens the popover, even when empty.
- **Popover** opens below the bell. Inbox view — list of notifications, each with row-level inline actions. Footer "View all" links to the full page.
- **Full page** at `/notifications`. Filter pills, tabs (Inbox / Saved / Done — TBD per research), batch actions.

The W3-rev decision was to retire the home-page attention banner in favour of this single unified surface. Reasoning: parallel attention surfaces multiply scan-cost. One bell, one inbox, one truth.

### Reason labels (source-kind metadata)

Each notification has a `source_kind` (e.g. `leave_request`, `compliance_enrolment`, `weekly_roundup`, `working_location`). This shows in the row as a small pill: visual differentiation between event-style notifications ("John approved your leave") and persistent-state items ("3 leave requests waiting"). The pill uses the tonal-badge convention from `docs/design-system.md` §1.8.

The schema migration adds `source_kind` and `source_id` columns to the `notifications` table; existing rows are grandfathered with null source.

### Verbs: Done vs Mark read

The W3-rev locked scope: **Mark read** is a soft visual state (notification dims). **Done** removes from inbox. NO Unsubscribe (not the pattern this product needs at this scale).

Why two verbs: Mark read handles "I see it but want to keep it visible". Done handles "this is resolved, hide it". GitHub Inbox uses the same model.

### Empty state

Inbox Zero is the goal. Empty popover shows:
- An icon (Lucide `Inbox` for v1; CC0 illustration upgrade in v1.1).
- "All caught up" headline.
- One-line body explaining what arrives here.

Don't show a button or CTA. The user has nothing to do; that's the point.

### Auto-resolution by source_id

When a user actions an underlying record (approves leave, completes course, signs off RTW), a hook auto-marks all notifications with the same `source_id` as Done. Three reminders for one leave request all auto-Done when the manager approves. Other leave_requests are untouched.

The dedupe rule: same `source_id` = one inbox row. Multiple events for one source render as one row that updates over time.

### Persistent state items

Render-time compute (per locked scope). No notification rows generated for state items; they're computed from underlying tables on each render. Example: "3 leave requests waiting" is computed from `leave_requests WHERE status = 'pending' AND manager_id = current_user`. Auto-resolves when the state changes.

This avoids the cron-job pattern that creates and deletes notification rows in tandem with state changes — race conditions and stale rows are eliminated.

### Bell affordance

Number badge with real count, 9+ ceiling for double-digit visual cleanliness. The number is the signifier — the user sees the count without opening the popover. Animation on arrival is acceptable but should respect `prefers-reduced-motion`.

The bell button itself is `<Button variant="ghost" size="icon" aria-label="Notifications">` per `docs/button-system.md`. The badge is absolutely positioned, sized to fit "99+", coloured with the `--destructive` token for the always-attention-grabbing red.

### The five anti-patterns this surface avoids

1. **Five primary CTAs stacked** — the original W3 mistake. Solved by demoting all row actions to ghost-icon and making the row itself the link.
2. **Banner-and-bell duplication** — solved by retiring the banner.
3. **Mark-as-read leaves item visible** — fixed in the W3-rev rewrite (current bug per `memory/intranet-design-feedback.md` round 4 notes).
4. **Popover doesn't scroll** — fixed by the popover rewrite (current bug per round 4 notes).
5. **No empty state** — solved by the "All caught up" pattern.

### Microsoft Fluent and Atlassian comparisons

Microsoft Teams uses a 4-week activity feed retention; Atlassian uses a similar bell + popover + full-page pattern with mark-as-read inline actions (source uncertain — direct fetches returned truncated content; based on prior knowledge of these systems). The W3-rev scope adopted the 30-day Done retention from Teams' precedent.

---

## 13. Anti-patterns to avoid

The W3 banner mistake taught us this list. If a future Claude session is producing a UI surface and one of these turns up in the design, stop and revisit.

### Multiple primary CTAs on one surface

The single most diagnostic AI-UX failure. Five blue buttons stacked, one per item, every one screaming for attention. The result: the user picks at random or freezes.

The fix: §3 — one primary per atomic UI unit. If the surface has multiple actions, demote all but one to `outline`, `secondary`, or `ghost`. Or make the row itself the affordance.

### Icon-only buttons without tooltips

Per NN/g (source verified): few icons are universally recognised. An icon without a label is an affordance the user can't see.

The fix: every icon-only button has both `aria-label` and `title`. Use `<TooltipButton>` for disabled-state tooltips.

### Hover-revealed primary actions on touch devices

Hover doesn't exist on touch. Chromebook touch users see nothing. The W3-rev research came up against this when considering hover-only quick actions on the right rail.

The fix: `@media (hover: none)` to show the action permanently when hover is unavailable. Or — better — make the action visible always.

### Modal overuse for routine confirmation

Per NN/g (source verified): modals interrupt. If the user marks a comment as read, no confirmation. If the user deletes a draft, soft-confirm with a toast and undo. If the user deletes a published article, hard-confirm with a modal.

The fix: match the severity to the surface. Toast for routine, modal for destructive, undo for soft delete.

### Empty card grids dominating above the fold

The dashboard arrives, the user's first impression is six empty white rectangles. The signal: "this product has nothing for you yet."

The fix: tailor the first-time empty state. Use a pathway-led layout (one explanation, one CTA) instead of the ambient-card-grid layout.

### Density that requires squinting

The MCR codebase's standardised tables hit the right density: `h-12` headers, `py-3` cells, 14px body text, generous border colour. Don't shrink past this without a clear reason.

The fix: pick a density per surface and stick with it. If you need denser, use a "compact mode" toggle, not silent shrinkage.

### Colour as the only hierarchy signal

Colour-blind users see weight and position; they don't always see colour. NN/g's visual hierarchy guidance is explicit: it's value/saturation contrast, not colour itself.

The fix: every colour signal has a redundant non-colour signal. Bold weight, icon, position, underline.

### Decoration animations

Floating shapes, drifting gradients, pulsing dots. The frontend playbook §4 catalogues these. They steal attention from content.

The fix: motion belongs to state transitions, affordance signalling, and loading. Decoration is noise.

### "Awesome!" / "Great!" / "Got it!" copy

Chatbot artefacts. The humanizer rules ban these explicitly. They make the product feel like an LLM wrote it.

The fix: short, direct, neutral copy. "Saved." "All caught up." "No matches."

### Generic SaaS layout fallback

Hero + 3-up cards + testimonial + pricing + CTA banner + footer — the canonical AI-bland landing. Distinguishing surfaces invert it, break it asymmetrically, or reject it.

The fix: read `docs/frontend-design-playbook.md` §6 before building any new top-level surface.

### A note on the W3 mistake specifically

The W3 banner mock failed because all of the above applied at once: five primary CTAs stacked (rule 1), no hierarchy among the items (rule 7), density too tight (rule 6), empty state would have been a missing pattern (rule 5). The fix was structural — retire the surface and route into the notification centre. Sometimes the right answer is "don't build this surface".

---

## 14. When to read this document

Triggered list. Mirror of the trigger list in `docs/frontend-design-playbook.md`, focused on interaction design rather than aesthetics.

- Before designing any surface where the user has more than one action available.
- Before adding a primary CTA to an existing surface (will it become the second?).
- Before designing a notification surface, attention banner, or alert-style component.
- Before designing an empty state.
- Before designing a form longer than three fields.
- Before designing a table, list, or grid for data the user will scan.
- Before designing a dashboard, home page, or landing surface.
- Before adding a modal for a non-destructive flow.
- Before adding a confirmation dialog for any state change.
- Before adding a hover-only interaction to a surface that touch users will hit.
- When a user, reviewer, or Gemini comment uses the words "doesn't feel polished", "too dense", "too sparse", "where do I look first?", "all the buttons look the same", "this looks AI-generated".
- When refactoring an existing surface and the brief is "make this clearer".
- When extending a pattern this document catalogues — verify the existing pattern still holds before adding to it.

If the brief is purely aesthetic (typography, colour, motion), read `docs/frontend-design-playbook.md` first; this document second. If the brief is purely interaction (hierarchy, signifiers, feedback), this document first.

---

## Verification provenance

Sources directly verified via WebFetch on 2026-05-04, with the cited claims extracted from the live page:

- NN/g — 10 Usability Heuristics (`nngroup.com/articles/ten-usability-heuristics/`)
- NN/g — How Users Read on the Web (`nngroup.com/articles/how-users-read-on-the-web/`)
- NN/g — Visual Hierarchy in UX (`nngroup.com/articles/visual-hierarchy-ux-definition/`)
- NN/g — Empty State Interface Design (`nngroup.com/articles/empty-state-interface-design/`)
- NN/g — Error Message Guidelines (`nngroup.com/articles/error-message-guidelines/`)
- NN/g — Modal vs. Nonmodal Dialog (`nngroup.com/articles/modal-nonmodal-dialog/`)
- NN/g — Three Important Response Time Limits (`nngroup.com/articles/response-times-3-important-limits/`)
- NN/g — Icon Usability (`nngroup.com/articles/icon-usability/`)
- NN/g — Aesthetic-Usability Effect (`nngroup.com/articles/aesthetic-usability-effect/`)
- NN/g — Information Scent (`nngroup.com/articles/information-scent/`)
- NN/g — Dashboards & Preattentive Processing (`nngroup.com/articles/dashboards-preattentive/`)
- NN/g — Progressive Disclosure (`nngroup.com/articles/progressive-disclosure/`)
- NN/g — Skeleton Screens (`nngroup.com/articles/skeleton-screens/`)
- Atlassian Design System — Spacing (`atlassian.design/foundations/spacing`)
- GitHub Primer — Color overview (`primer.style/foundations/color/overview`)
- Wikipedia — *The Design of Everyday Things* (Don Norman)
- Wikipedia — *Don't Make Me Think* (Steve Krug)

Sources where direct fetch failed (404, truncated, or permission-denied) and content reflects prior knowledge of the published guidance:

- **Refactoring UI** by Adam Wathan & Steve Schoger (`refactoringui.com`) — homepage didn't extract; tactics summarised from prior knowledge of the book and widely-cited principles. The visual-hierarchy techniques (size, weight, spacing, position) are anchored to NN/g where directly verifiable.
- **Apple Human Interface Guidelines** (`developer.apple.com/design/human-interface-guidelines/`) — direct fetch returned title-only. The "deference, clarity, depth" framing and 44pt touch-target rule are from prior knowledge of Apple's longstanding HIG.
- **Material 3 Foundations** (`m3.material.io/foundations`) — direct fetch returned title-only. Density tier and elevation references reflect prior knowledge of MD3's published documentation.
- **Atlassian Button Component** (`atlassian.design/components/button`) — direct fetch returned navigation-only. Button hierarchy claims reflect prior knowledge of Atlassian's published variants and the anchor in `docs/button-system.md`.
- **IBM Carbon** density tiers, modal types, and notification types — direct fetches returned 404 or truncated content. Prior knowledge of Carbon's published 2x grid, modal type taxonomy (passive/transactional/focus/danger), and notification surfaces.
- **Inclusive Components** by Heydon Pickering (`inclusive-components.design`) — direct fetch denied. Card-component claim and accessibility-led methodology reflect prior knowledge of the book's published content.
- **About Face** by Cooper, Reimann, Cronin, Noessel — Wikipedia summary URL returned 404. Posture / persona / behaviour-driven concepts reflect prior knowledge of the book.
- **Microsoft Fluent 2** (`fluent2.microsoft.design`) — direct fetch returned 404. Layered-elevation and Office/Teams precedent reflect prior knowledge of Fluent's published system.
- **Shopify Polaris** — forms documentation URL redirected to a path that 404'd. Single-column form layout, label position, and required-indicator guidance reflect prior knowledge of Polaris's published system; these match Atlassian and Material precedent and NN/g's directly-verified form-design rules where applicable.

Project-internal sources (always authoritative for MCR-specific patterns):

- `docs/frontend-design-playbook.md` — aesthetic principles upstream of this document.
- `docs/design-system.md` — colour tokens, badge variants, file-type colour conventions.
- `docs/button-system.md` — variants, sizes, label casing, helpers, per-context patterns.
- `src/lib/CLAUDE.md` — design tokens, table patterns, lightbox patterns, sidebar.
- `memory/intranet-design-feedback.md` — W3-rev locked scope for the notification centre overhaul.

If a claim in this document is load-bearing for a design decision, re-verify against the original source where verification status is "uncertain".
