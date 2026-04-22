# Button system

The rules every button in the MCR intranet follows. Anchored to shadcn's button guidance (https://www.shadcn.io/ui/button) with brand-aligned colour semantics and pragmatic deviations noted inline.

Quick reference: `@/components/ui/button` is the only button primitive. Three helpers live alongside it:
- `<TooltipButton>` — wraps Button with a tooltip explaining why it's disabled.
- `<ButtonSpinner>` — the loading spinner, size-aware.
- `<DestructiveMenuItem>` — destructive-styled `DropdownMenuItem` with the full class string locked in.

## Variants (by intent)

### `default` — routine primary CTAs
Save, Submit, Continue, Create, Add, Mark as complete, Save draft. MCR dark blue `#213350` on white foreground. Commits the current flow.

**Why:** navy is the commit signal. Using it for anything else teaches users navy is decorative.

### `success` — irreversible positive commits
Approve (HR leave, flexible working), Publish (article, course, post), Enrol-self (creates L&D record). Forest green `#15803d`.

**Why:** shadcn's "green = success/go, consistent across the app" works when "go" is rare and meaningful. Reserved for actions that are hard to undo. Mark-as-complete and Save-draft stay `default` because they're reversible.

### `destructive` — negative-confirm CTAs in AlertDialog footers
Delete, Reject, Remove. MCR wine `#751B48`. Never on inline row triggers — the inline trigger uses `ghost` or sits inside a kebab; the destructive colour lives only on the AlertDialog confirm.

**Why:** wine is brand-aligned (replaces Tailwind red-500) and gives AAA contrast (10.46:1 on white). Pairing inline triggers with destructive colour creates "red wallpaper" in tables — users habituate and start clicking through confirmations without reading.

### `secondary` — Cancel, Back, Reset, Clear
shadcn's assigned role for dismissal / retreat actions. Pale blue-grey fill `#E8ECF0`.

**Why:** cleaner than our earlier outline-for-Cancel convention. Secondary has its own fill, reads clearly as "alternative button" next to a solid primary, and doesn't need the `bg-card` override hack outline required on grey pages.

### `outline` — prominent secondary on coloured backgrounds
Navigate-to-edit-route, filter toggles, Export/Download (unless it's the page's primary action), Review course (on completed state). 1px border on `bg-background` fill.

**Why:** shadcn's assigned role is "on coloured backgrounds (cards, headers, sections)". Placement-driven. Outlines pop on solid-colour areas where a secondary fill would blend in.

### `ghost` — utility actions, row actions, toolbars
Close (X), kebab triggers, notification bell, avatar menu, "Show more" expanders, inline Edit on cards. No fill, no border, hover adds `bg-accent`.

**Why:** shadcn: "for actions that shouldn't dominate the interface". Never use ghost for the primary CTA of a view — users miss it.

### `link` — inline navigation styled as text
Learn more, View details, error-boundary "Go home". MCR teal `#2A6075`, always underlined (thickens on hover).

**Why:** link-to-body contrast at this teal is 1.83:1 — fails WCAG without the underline. The underline must remain. Previous hover-only underline was non-compliant.

## Sizes

| Size | Height | Use |
|---|---|---|
| `hero` | h-12 | Auth screens (login, OTP), kiosk check-in, landing CTAs. Reserved. |
| `lg` | h-11 | Page-header CTAs, confirmation actions in wide dialogs. 44px passes WCAG 2.5.5 AAA touch target. |
| `default` | h-10 | Standard form/dialog buttons. 40px, passes WCAG 2.2 AA (24px floor). |
| `sm` | h-9 | Dense filter toolbars, table-header actions. Never a primary CTA. |
| `icon` | h-10 w-10 | Default icon-only. |
| `icon-sm` | h-8 w-8 | Table row actions, card footer actions. |
| `icon-xs` | h-7 w-7 | Hover-reveal kebabs, very dense rows. |

**Touch-target rule:** primary CTAs must be `default`, `lg`, or `hero` — never `sm`. Both `default` (40px) and `lg` (44px) are acceptable on mouse-primary desktop contexts; `lg` mandatory if the CTA is touch-reachable on Chromebooks or kiosk.

**Never use `className` for sizing.** `className="h-12 text-base"`, `className="h-8 w-8"`, `className="h-7"` on a Button are all banned — use the `size` prop. An ESLint rule (`no-custom-button-sizing`) catches violations.

**Why:** size drift creates three problems. (1) The design system loses a single source of truth. (2) Per-variant SVG sizing breaks when size is bypassed (the icon stays default 16px regardless). (3) Future design changes need to chase every custom className instead of updating the variant table.

## Button vs Link

- Click changes the URL → `<Button asChild><Link href={...}>...</Link></Button>`. Add `prefetch={false}` on row actions and kebab items to avoid hammering the server.
- Click performs an action on the current page → `<Button onClick={...}>`.
- `router.push` inside `onClick` is a smell — convert to Link + asChild.
- `<div onClick={router.push}>` on card wrappers is also a smell — convert to Link wrapper.
- **Never combine `asChild + disabled + <Link>`.** `disabled` isn't a valid anchor attribute; the rendered anchor stays clickable. Gate the render: `disabled ? <span className={buttonClasses}>...</span> : <Link>...</Link>`.

**Why:** `<Button asChild>` with a Link preserves Cmd/Ctrl+click, right-click menu, and middle-click-to-open-new-tab — all of which a `router.push` onClick silently breaks.

## Labels

- **Sentence case.** "Save changes", "Add key date", "Send magic link". Not Title Case, not ALL CAPS. Proper nouns stay capitalised: "Continue with Google".
- **Verb-first.** "Add asset", not "New asset". Exception: "Cancel" is conventional.
- **Keep short.** "Save" over "Save changes" when context is obvious.

**Long labels:** base class is `whitespace-nowrap`. For labels longer than ~20 characters, add `className="max-w-xs truncate"` plus `title={fullText}`. Screen readers still read the full accessible name; sighted users see the full text on hover.

**Why:** shadcn's FAQ: "Sentence case reads more naturally. Title Case feels like shouting." British English convention reinforces sentence case.

## Hierarchy

**One primary per atomic UI unit.** Atomic units: dialog, page header, card, toolbar row, empty state, confirmation banner. At most one `default` / `success` / `destructive` per unit. Alternative actions use `outline` or `secondary`.

**Why:** shadcn's FAQ: "Multiple primary buttons create decision paralysis. Users need one clear next step."

## Accessibility

### Icon buttons
Icon-only buttons require **both** `aria-label` (screen reader) and `title` (sighted hover tooltip). Drop `title` only when the tooltip is actively annoying (post reactions, chat emoji).

When an icon changes to reflect state (filled-star vs outline-star for favourites), `aria-label` must update in lockstep: "Add to favourites" → "Remove from favourites". Not just `title`.

### Disabled buttons
Use `<TooltipButton reason="...">` — never a bare disabled Button. Native `title` and bare Radix Tooltip don't fire on disabled buttons because the browser applies `pointer-events: none`. `TooltipButton` wraps the disabled button in a focusable span so the tooltip reaches screen readers (via `aria-describedby`) and sighted users alike.

**Why:** shadcn's FAQ: "Hidden buttons confuse users. Disabled buttons show the action exists but explain why it's unavailable." Silent-disabled is the worst of both worlds.

### Toggle buttons (filter chips, view switchers)
Set `aria-pressed={boolean}` on every toggle. Visual state via variant swap:
```tsx
<Button variant={pressed ? "secondary" : "outline"} aria-pressed={pressed}>
```

This is an interim pattern until the `<ButtonGroup>` primitive (Radix ToggleGroup wrapper) lands as a follow-up.

### Focus rings
Don't add `focus-visible:ring-*` classes on Button. The global `*:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }` in `globals.css` handles it uniformly.

**Why:** adding Button's own ring classes doubles the focus indicator. Kept it clean on base.

### Contrast reference (do not re-derive)

| Variant | Light mode on white | Dark mode on dark card |
|---|---|---|
| `default` (navy / lightened navy) | 11.4:1 AAA | ~3.4:1 UI (was 1.41:1 fail) |
| `success` (`#15803d`) | 5.83:1 AA body | 3.4:1 UI |
| `destructive` (wine / lightened wine) | 10.46:1 AAA | ~4.4:1 AA body (was 1.83:1 fail) |
| `outline` on `bg-background` | Requires `bg-card` to render visibly on grey pages | n/a |

## Loading states

- Use `<ButtonSpinner size={...} />` inside the Button, with `disabled` and `aria-busy`.
- Label text stays as the verb-ing form ("Saving...", "Submitting...", "Approving...") while pending. Keep the button disabled during pending.

```tsx
<Button disabled={pending} aria-busy={pending} onClick={...}>
  {pending && <ButtonSpinner size="default" />}
  {pending ? "Saving..." : "Save"}
</Button>
```

**Deliberate deviation from shadcn's FAQ:** shadcn prefers "keep original text visible" during loading. We chose verb-ing because it matches UK UI convention and because "Save" → "Saving..." communicates progress distinctly from a stuck disabled button.

## Patterns by context

### Kebab triggers
```tsx
<DropdownMenuTrigger asChild>
  <Button variant="ghost" size="icon-sm" aria-label="Actions for {entity}" title="Actions">
    <MoreHorizontal />
  </Button>
</DropdownMenuTrigger>
```

Never raw styled triggers. `CardActionsKebab` is the reference pattern for hover-reveal card kebabs — and always visible on touch devices via `@media (hover: none)`.

### Destructive DropdownMenu items
Use `<DestructiveMenuItem>`:
```tsx
<DestructiveMenuItem onSelect={() => handleDelete()}>
  <Trash2 />
  Delete
</DestructiveMenuItem>
```

### AlertDialog footers
Radix's `AlertDialogAction` and `AlertDialogCancel` are raw `<button>` elements with their own base styling (`rounded-md`, `h-10`, `font-medium`, focus ring). They do NOT accept a `variant` prop, and they should NOT be styled with `buttonVariants()` — that would override their native layout/radius/focus treatment with Button's styles and create coupling between the AlertDialog and Button systems.

Instead, override only the colour with semantic utility classes:
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

This respects AlertDialog's native sizing and focus behaviour, keeps AlertDialog decoupled from Button, and still conveys variant intent through colour.

Order: Cancel (secondary) left, primary action (default/success/destructive) right. Always.

### Inline destructive row actions
**Default: move to the row's kebab menu** (matches Linear/Notion/GitHub/Airtable/Jira/Asana — zero of six top SaaS tools expose a coloured destructive icon inline).

If the table truly has no kebab and density demands inline access, use `ghost` with destructive-tinted hover:
```tsx
<Button
  variant="ghost"
  size="icon-sm"
  className="hover:bg-destructive/10 hover:text-destructive"
  aria-label={`Delete ${entity}`}
>
  <Trash2 />
</Button>
```

Apply the six-question decision tree per table:
1. Table already has a kebab? → fold destructive into it.
2. Row has 3+ action icons? → consolidate all into a new kebab.
3. Destructive action is hard-delete or GDPR-sensitive? → kebab mandatory.
4. Destructive action is high-frequency (reversible, multiple uses per admin session)? → keep inline with tinted hover.
5. No kebab, 2 actions, low frequency, reversible? → new kebab.
6. No kebab, 2 actions, high frequency, reversible? → keep inline with tinted hover.

Rule 3 overrides rule 4. Data-loss prevention beats click-efficiency.

### Edit patterns (four slots)

Pick the slot by the structural test, not by intuition:

- **Slot 1 — dense row action (tables, repeating lists).** `<TooltipButton variant="ghost" size="icon-sm" aria-label="Edit {entity}" title="Edit">` with a `<Pencil />` icon. Pure icon; density context justifies dropping text.
- **Slot 2 — section header Edit (one per card/section).** `<Button variant="ghost" size="sm"><Pencil /> Edit</Button>`. Icon plus text; clarity beats density.
- **Slot 3 — navigation to an edit route.** `<Button variant="outline" size="sm" asChild><Link href={...} prefetch={false}><Pencil /> Edit</Link></Button>`.
- **Slot 4 — page-level primary Edit (rare).** `<Button variant="outline" size="lg"><Pencil /> Edit</Button>`. Size carries the weight; colour stays outline so Save can still claim navy unambiguously.

### Patterns by specific context

| Pattern | Recipe |
|---|---|
| Form Reset / Clear | `<Button variant="secondary">` — same as Cancel. |
| Search input submit icon | Usually decorative — input handles Enter. If clickable: `<Button variant="ghost" size="icon-sm">`. |
| Clear-search X inside input | `<Button variant="ghost" size="icon-xs" aria-label="Clear search">` with `<X />`. |
| Pagination prev/next | `<Button variant="ghost" size="icon-sm" aria-label="Previous page">` with chevron. |
| Pagination page number | Current: `<Button variant="outline" size="sm" aria-current="page">`. Other: `<Button variant="ghost" size="sm">`. |
| Back button | `<Button variant="ghost" size="sm" asChild><Link>` with `<ArrowLeft />` + "Back". |
| Close (X) on banners | `<Button variant="ghost" size="icon-sm" aria-label="Close">` with `<X />`. |
| Empty-state CTA | `<Button variant="default">` — empty state is an atomic unit. |
| Error-boundary retry | Primary: `<Button variant="default">Try again</Button>`. Secondary: `<Button variant="link">Go home</Button>`. |
| File upload trigger | `<Button variant="outline">` with `<Upload />` + "Choose file". |
| Copy-to-clipboard | `<Button variant="ghost" size="icon-sm" aria-label="Copy {thing}">` with `<Copy />`. Toast on success. |
| Export / Download | `<Button variant="outline">` with `<Download />`. Becomes `default` only if it's the page's primary action. |
| Show more / Load more | `<Button variant="ghost" size="sm">` with trailing `<ChevronDown />`. |
| Sidebar nav item | `<Button variant="ghost" asChild><Link>`. Active state: `aria-current="page"` + `bg-accent`. |
| Notification bell | `<Button variant="ghost" size="icon" aria-label="Notifications">` with `<Bell />`. Badge absolutely positioned. |
| Avatar menu trigger | `<DropdownMenuTrigger asChild><Button variant="ghost" className="rounded-full">` with `<Avatar>`. |

## Do not do

- Do not use `variant="default"` for Edit buttons — Edit isn't a commit.
- Do not pair `asChild + disabled + <Link>` — the rendered anchor is clickable.
- Do not nest `<Button>` inside a `<Link>` wrapper (or vice versa) — invalid HTML.
- Do not use `className="h-X w-X"` on Button — use the `size` prop.
- Do not add `variant="action"` — the variant was removed.
- Do not use `variant="destructive"` on an inline row trigger — use `ghost` + tinted hover, or move into the kebab.
- Do not use the `sm` size for a primary CTA — fails WCAG touch-target on Chromebooks.

## See also

- `src/components/ui/button.tsx` — the primitive.
- `src/components/ui/tooltip-button.tsx` — disabled-with-reason helper.
- `src/components/ui/button-spinner.tsx` — loading spinner.
- `src/components/ui/destructive-menu-item.tsx` — red dropdown item.
- `/dev/button-gallery` (local only) — renders every variant × size × state for visual review.
- `docs/button-baseline-2026-04-22.md` — pre-sweep state, preserved for revert.
