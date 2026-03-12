# MCR Pathways Intranet — Design System

**Last reviewed:** 2026-03-12
**Owner:** Abdulmuiz Adaranijo

---

## 1. Current State (Revert Reference)

This section documents the exact current design system values. If any proposed changes cause regressions, revert to these values.

### 1.1 Brand Colour Tokens

Defined in `src/app/globals.css` `:root`:

| Token | Hex | Usage |
|-------|-----|-------|
| `--mcr-dark-blue` | `#213350` | Primary actions, navigation, text, logo, kiosk background |
| `--mcr-light-blue` | `#5BC6E9` | Focus ring (dark mode only) |
| `--mcr-orange` | `#F09336` | Sidebar induction prompt, learning warnings, kiosk accents |
| `--mcr-yellow` | `#F8D45B` | Pending status badge (via `--status-pending`) |
| `--mcr-green` | `#B5E046` | **Unused** — defined but zero usage in any component |
| `--mcr-teal` | `#2A6075` | **Unused** — defined but zero usage in any component |
| `--mcr-pink` | `#FF82B2` | Action buttons (via `--action` token) — sign-out, special CTAs |
| `--mcr-wine` | `#751B48` | **Unused** — defined but zero usage in any component |
| `--mcr-ivory` | `#FDF9EA` | **Unused** — defined but zero usage in any component |

### 1.2 Semantic Colour Tokens (Light Mode)

| Token | Value | Purpose |
|-------|-------|---------|
| `--background` | `#F2F4F7` | Page background (light grey) |
| `--foreground` | `var(--mcr-dark-blue)` | Default text colour |
| `--card` | `#ffffff` | Card/modal surfaces |
| `--primary` | `var(--mcr-dark-blue)` | Primary buttons, active nav, checkboxes, switches, tooltips, progress bars, links |
| `--primary-foreground` | `#ffffff` | Text on primary backgrounds |
| `--secondary` | `#E8ECF0` | Secondary buttons |
| `--accent` | `#E2E8F0` | Hover/focus highlights |
| `--action` | `var(--mcr-pink)` | Special action buttons (pink) |
| `--muted` | `#F0F2F5` | Muted backgrounds |
| `--muted-foreground` | `#6b7280` | Secondary text |
| `--destructive` | `#ef4444` | Delete/error actions |
| `--border` | `#e5e7eb` | Default borders |
| `--ring` | `var(--mcr-dark-blue)` | Focus outlines |
| `--table-header` | `#E4E7EC` | Table header backgrounds |
| `--status-active` | `#22c55e` | Active/success status |
| `--status-pending` | `var(--mcr-yellow)` | Pending status |
| `--status-inactive` | `#9ca3af` | Inactive/disabled status |

### 1.3 Semantic Colour Tokens (Dark Mode)

| Token | Value | Notes |
|-------|-------|-------|
| `--background` | `hsl(210, 50%, 8%)` | Dark page background |
| `--primary` | `var(--mcr-dark-blue)` | Same as light mode |
| `--ring` | `var(--mcr-light-blue)` | Light blue for visibility |
| `--action` | `var(--mcr-pink)` | Same as light mode |
| `--secondary` | `hsl(210, 20%, 18%)` | |
| `--accent` | `hsl(210, 25%, 22%)` | |

### 1.4 Typography

| Property | Value |
|----------|-------|
| Font family | `"tt-commons-pro", system-ui, -apple-system, ...` |
| Base font size | `110%` (set on `html`) |
| Font smoothing | Antialiased (webkit + moz) |

### 1.5 Spacing and Radius

| Token | Value |
|-------|-------|
| `--radius` | `0.75rem` |
| `--radius-sm` | `calc(var(--radius) - 4px)` |
| `--radius-md` | `calc(var(--radius) - 2px)` |
| `--radius-lg` | `var(--radius)` |
| `--radius-xl` | `calc(var(--radius) + 4px)` |

### 1.6 Component Patterns

| Surface | Pattern |
|---------|---------|
| Cards/tables | `bg-card shadow-md rounded-xl overflow-clip` |
| Page background | `bg-background` (grey #F2F4F7) |
| Dialogs/modals | `bg-card` (white, not `bg-background`) |
| Inputs | `bg-card` (white, for contrast on grey pages) |
| Table headers | `bg-table-header` (#E4E7EC) |
| Primary buttons | `bg-primary text-primary-foreground` (dark blue) |
| Sidebar active | `bg-primary text-primary-foreground` (dark blue) |
| Tab bar (line) | `border-b` underline variant with `hover:text-foreground` |
| Tab bar (pill) | `bg-muted` rounded pill |
| Badges | `bg-primary` (dark blue), `bg-secondary` (grey), `bg-destructive` (red), `bg-status-*` |

### 1.7 Status Colour Conventions

Status badges throughout the app use **Tailwind utility colours**, not MCR brand colours:

| Semantic Meaning | Tailwind Colours Used |
|--|--|
| Success/Active/Approved | `green-50/600/700` |
| Warning/Pending/Review | `amber-50/600/700` |
| Error/Expired/Rejected | `red-50/600/700` |
| Info/Submitted/In Progress | `blue-50/600/700` |
| Neutral/Draft/Inactive | `gray-50/500/600/700` |
| Special (appealed, trial) | `purple-50/700`, `teal-50/700` |

This is consistent with industry practice — semantic status colours should be universal and not brand-specific.

---

## 2. Official Brand Guidelines Reference

Source: MCR Pathways Brand Guidelines (Aug 2025, 40 pages)

### 2.1 Official Colour Palette

| Colour | Official Hex | Codebase Hex | Status |
|--------|-------------|--------------|--------|
| Orange (primary) | `#F09336` | `#F09336` | Matches |
| Dark Blue | `#213350` | `#213350` | Matches |
| Mid Blue | `#347791` | — | **Missing from codebase** |
| Light Blue | `#5BC6E9` | `#5BC6E9` | Matches |
| Yellow | `#F8D45B` | `#F8D45B` | Matches |
| Light Green | `#AFDA44` | `#B5E046` | **Differs** |
| Dark Pink | `#892055` | — | **Missing from codebase** |
| Pink | `#DA417C` | `#FF82B2` | **Differs** (codebase is lighter/more saturated) |
| Ivory | `#FFFFE3` | `#FDF9EA` | **Differs** (codebase is warmer/less green) |

**Additional codebase-only colours** (not in brand guidelines):
- `--mcr-teal` (#2A6075) — likely derived from Mid Blue
- `--mcr-wine` (#751B48) — likely derived from Dark Pink

### 2.2 Typography (Guidelines vs Codebase)

| Role | Guidelines | Codebase |
|------|-----------|----------|
| Headlines | TT Commons Pro Extra Black | TT Commons Pro (all weights) |
| Body copy | Montserrat | TT Commons Pro |

The guidelines specify Montserrat for body copy, but the intranet uses TT Commons Pro throughout. This is a deliberate choice — TT Commons Pro is the MCR headline font and works well as a system-wide typeface for an internal tool.

### 2.3 Other Brand Elements

- **Logo**: Stacked "MCR Pathways" with speech mark icon. Dark blue on light backgrounds. White on dark. Never centred — always in corners.
- **Graphic language**: Speech mark motifs (quotation marks used decoratively)
- **Photography**: "Need Tone" (empathetic) and "Impact Tone" (celebratory)
- **Tone of voice**: Warm, respectful, plain English, avoid jargon

---

## 3. Industry Research: Brand Colour in Product UI

### 3.1 The Universal Pattern

Every top productivity platform follows the same principle: **brand colour is an accent, not the foundation.** The UI foundation is neutral.

| Platform | Brand Colour | Where It Appears in Product | Where It Does NOT Appear | Foundation |
|----------|-------------|----------------------------|--------------------------|------------|
| **GitHub** | Green (#2DA44E) | Primary action buttons only ("Create repo", "Merge PR") | Sidebar, navigation, headers, backgrounds. Green ONLY at the point of commitment. | Neutral grey/white. Blue reserved for security features. |
| **Notion** | Black (#000000) | Primary buttons, text | No coloured sidebar, header, or navigation. Interface is a blank canvas. | Entirely monochrome. Zero brand colour in product. |
| **Linear** | Blue/indigo (reduced 2024) | Accent highlights, active states — minimally | Deliberately removed from most surfaces in 2024 redesign | Monochrome black/white. Prioritises content clarity over decoration. |
| **Slack** | Purple/aubergine (#4A154B) | Sidebar background — the single brand touchpoint | Purple does NOT appear on buttons, links, or interactive elements in content area. | Neutral white/grey workspace. |
| **Shopify** | Green (brand) → **Black** (product) | **Deliberately switched primary buttons from brand green to black.** Brand colour now a sparingly-used accent token. | Removed from primary buttons entirely. | Black/white neutral backbone. |
| **Figma** | Purple gradient | Top toolbar/navigation bar | Panels and canvas are neutral | Mostly neutral. |
| **Asana** | Coral/salmon | Logo only. Celebratory animations (task completion). | Almost absent from product UI. Product uses blue (#008CE3) + pink (#FF6D92) instead. | Neutral elsewhere. |
| **Jira/Atlassian** | Blue (#0052CC) | Primary buttons and links | Sidebar is neutral (white/light grey). Status uses separate semantic colours. | Traditional brand-as-interactive approach. |

### 3.2 The Shopify Insight

Shopify's deliberate switch from brand-coloured green to black primary buttons is the most explicit articulation of the industry direction. Their reasoning:

- Brand green **competed with semantic green** (success) — users couldn't distinguish "this is the main action" from "this action succeeded"
- A neutral primary button **lets semantic colours carry their full weight** — red for danger, green for success, yellow for warning
- Black is associated with "Pro" products and provides impact without competing

This is directly relevant to MCR: our dark blue primary avoids competing with any semantic colour, which is correct.

### 3.3 The 60-30-10 Rule

Widely referenced in enterprise design systems:
- **60%** neutral/dominant (white, grey, dark backgrounds)
- **30%** secondary (complementary neutral tones for cards, sidebars, alternate surfaces)
- **10%** accent (brand/interactive colour for buttons, links, focus states)

In practice, top enterprise tools use **even less than 10% brand colour** — Linear, Notion, and GitHub probably have 2-5% brand colour on any given screen.

### 3.4 Design System Framework Analysis

| System | Primary Button Colour | Brand vs Semantic Separation | Key Principle |
|--------|----------------------|------------------------------|---------------|
| **GitHub Primer** | Green ("success" role, NOT "brand" role) | Brand colours live in a completely separate system (Primer Brand) for marketing only | Seven semantic roles: accent, success, attention, danger, open, closed, done |
| **Atlassian** | Blue (brand) | Explicit rule: "Do not use accent when colour has semantic meaning" | Colour roles + emphasis levels (subtlest to boldest) |
| **Material Design 3** | Brand-derived primary | Most brand-forward system — derives entire scheme from brand primary | Five key roles: Primary, Secondary, Tertiary, Neutral, Neutral Variant |
| **Shopify Polaris** | Black (not brand green) | "Brand" token used sparingly to "pull additional focus on main actions" | Black/white foundation is intentional |
| **IBM Carbon** | Blue 60 (brand) | Core blue for interactive elements; separate data visualisation palettes | Four themes (White, Gray 10, Gray 90, Gray 100) |
| **Radix Themes** | Accent colour (configurable) | Accent = brand, used for all interactive elements. Most brand-pervasive approach. | 12-step scale per accent with auto-paired grey |
| **Apple HIG** | System blue (#007AFF) | "Tint colour" for active states, buttons, links, toggles. Advises "judicious use" — limited palette of 2-3 colours. | macOS has system-wide accent that apps inherit |

### 3.5 Key Principles Observed

1. **Brand colour touches 1-3 strategic surfaces.** Never wallpapered across the entire UI.
2. **Primary action buttons are the main brand touchpoint** — but trending toward neutral (black) or semantic rather than brand colour.
3. **Status colours are semantic and universal.** Green=success, yellow=warning, red=error. Never brand-specific. This matches our current approach.
4. **Sidebar is either neutral (GitHub, Jira, Notion) or the single brand surface (Slack).** Never both.
5. **Internal/enterprise tools lean MORE neutral than consumer products.** Staff use these 8+ hours daily — visual fatigue matters more than brand expression.
6. **Marketing websites are deliberately MORE colourful than the product.** The disconnect between MCR's public site and intranet is normal and intentional.
7. **Typography is usually one family throughout.** The intranet's use of TT Commons Pro throughout is standard.
8. **Empty states, onboarding, and celebratory moments are the one area where brand colour is used more freely** — personality and engagement surfaces vs daily work surfaces.
9. **Dark mode requires brand colour adjustment.** Bright brand hues appear neon/oversaturated on dark backgrounds. Top systems desaturate or shift to lighter tonal values (MD3 shifts from tone 600 to 400).

### 3.6 Anti-Patterns to Avoid

Based on research across design systems and common UI colour mistakes:

1. **Brand colour on every surface** — using brand colour for sidebar AND header AND buttons AND links AND badges drowns out semantic colours. Nothing stands out because everything is branded.
2. **Brand colour competing with semantic colours** — using a green brand for primary buttons when green also means "success". Users cannot distinguish intent.
3. **Too many colours competing** — using 6+ colours without clear hierarchy. When every button is bright, none are important.
4. **Coloured backgrounds on work surfaces** — light brand colour wash on the main content area causes eye fatigue and makes content harder to read. Reserve coloured backgrounds for marketing/emotional surfaces.
5. **Saturated brand colours in dark mode** — using the same hex values creates a neon/garish appearance. Desaturate or shift lighter.
6. **Inconsistent brand application** — brand colour appearing in navigation on some pages but not others.
7. **Low-contrast "trendy" palettes** — muted pastels that look modern on a designer's MacBook but fail in real-world office lighting.

### 3.7 Where MCR Intranet Aligns

- Dark blue primary button colour — matches Jira/Atlassian pattern, doesn't compete with semantic colours (unlike Shopify's old green)
- Neutral grey page background — matches GitHub, Jira
- Status colours use universal semantic colours — matches everyone
- Single font family throughout — matches industry standard
- Brand logo in header — universal
- Separate semantic token layer — matches Primer, Atlassian, Polaris architecture

### 3.8 Where MCR Intranet Differs

- **4 defined brand colours are completely unused** (green, teal, wine, ivory) — wasted design tokens
- **No brand colour in sidebar** — unlike Slack's distinctive approach
- **Orange (the stated primary brand colour) barely appears** — only in induction prompt and learning module warnings
- **Pink action token is unconventional** — most platforms use their primary colour for all actions, not a secondary brand colour
- **No brand warmth in empty states or onboarding** — missed opportunity for personality (Asana, Shopify do this well)

---

## 4. Proposals

### 4.1 Colour Token Accuracy (Investigation Needed)

**Current state**: 5 hex values differ from official guidelines, 2 colours missing entirely.

**Recommendation**: Visual comparison needed before changing. The codebase values may have been intentionally adapted for screen use (guidelines could be print-optimised). Specifically:

| Colour | Guidelines | Codebase | Visual Difference |
|--------|-----------|----------|-------------------|
| Pink | `#DA417C` (darker, muted) | `#FF82B2` (brighter, more saturated) | Significant — `#DA417C` is closer to the public website's "Donate" button |
| Light Green | `#AFDA44` (slightly duller) | `#B5E046` (brighter) | Minor shift |
| Ivory | `#FFFFE3` (green-tinted) | `#FDF9EA` (warm cream) | Noticeable — different colour feel entirely |

**Action**: Create a visual swatch comparison (side-by-side in the browser) before committing to either set. The missing Mid Blue (#347791) and Dark Pink (#892055) should be added regardless — they appear prominently on the public website.

### 4.2 Strategic Brand Colour Placement

Following the industry pattern of 1-3 brand touchpoints, here are options to consider (each independently):

**Option A — Orange accent for attention-drawing elements:**
Use `mcr-orange` for elements that need to draw the eye — notification badges, "new" indicators, important banners, featured content markers. This follows the public website's use of orange for highlights. Currently, orange only appears in the induction prompt and learning warnings.

**Option B — Subtle brand warmth in empty states / onboarding:**
Use brand colours in empty state illustrations, onboarding cards, or welcome messages. Asana does this — celebratory moments use brand colour, daily work is neutral. MCR's "Vital Spark" brand idea suits this approach.

**Option C — Primary button colour investigation:**
The current dark blue primary works well for a professional tool. However, if the organisation wants stronger MCR identity, the orange primary question should be explored with mockups. GitHub proves that a non-neutral primary button colour can work if it's consistent.

**Option D — Retire unused tokens:**
Green, teal, wine, and ivory are defined but unused. Options: (a) find appropriate uses for them, (b) remove them to reduce maintenance surface, or (c) keep them documented for future use. Recommendation: keep them defined (costs nothing) but don't force usage.

### 4.3 Typography Alignment

**Current state**: TT Commons Pro used throughout (headline font from guidelines).
**Guidelines specify**: Montserrat for body copy.

**Recommendation**: Keep TT Commons Pro throughout. Switching body text to Montserrat would:
- Require loading a second web font (bundle size impact)
- Create visual inconsistency in an app that's mostly UI, not long-form text
- Not align with industry practice (single font family is standard)

TT Commons Pro IS the MCR brand font — using it everywhere reinforces brand identity more than using Montserrat for body.

### 4.4 Page Background Colour

**Current**: Grey (#F2F4F7) — neutral, professional, matches GitHub/Jira.
**Brand guidelines**: Ivory (#FFFFE3 or #FDF9EA) is in the palette.
**Public website**: Uses ivory/cream background.

**Recommendation**: Keep grey. Ivory as a page background would:
- Create a warm/vintage feel unsuitable for a data-heavy HR/productivity tool
- Reduce contrast with white cards (ivory is closer to white than grey is)
- Not match any top-tier productivity platform

The public website's ivory background suits its emotional, charity-marketing purpose. The intranet's grey background suits its functional, daily-use purpose. This divergence is intentional and correct.

---

## 5. Open Questions

These decisions require stakeholder input or visual prototyping:

1. **Should orange replace dark blue as `--primary`?** — Needs mockup comparison
2. **Should we correct hex values to match guidelines exactly?** — Needs visual swatch comparison (especially pink: #FF82B2 vs #DA417C)
3. **Where (if anywhere) should unused brand colours appear?** — Green, teal, wine, ivory
4. **Should the sidebar have a brand-coloured background?** — Slack pattern (distinctive but polarising)
5. **Should the `--action` token remain pink, or merge with `--primary`?** — Most platforms use one action colour, not two

---

## 6. File Reference

| File | Purpose |
|------|---------|
| `src/app/globals.css` | All colour tokens, typography, animations |
| `src/components/ui/button.tsx` | Button variants (primary, secondary, action, destructive, outline, ghost, link) |
| `src/components/ui/badge.tsx` | Badge variants |
| `src/components/layout/sidebar.tsx` | Navigation, logo, sidebar structure |
| `src/components/layout/header.tsx` | Header bar |
| `src/lib/hr.ts` | HR-specific constants (leave type colours, status colours) |
| `src/lib/sign-in.ts` | Sign-in module constants |
| `public/MCR_LOGO-1.svg` | Logo file (dark blue #213350) |
