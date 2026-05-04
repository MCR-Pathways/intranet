# Frontend design playbook

**Last reviewed:** 2026-05-04
**Owner:** Abdulmuiz Adaranijo
**Read this before:** any UI work — new page, redesign, component refactor, hero, marketing page, dashboard surface.

This is a working playbook of what makes top-tier product design feel deliberate, and what makes AI-generated UI feel bland. Every typographic measurement, colour value, font name, and CSS property cited from a "verified" site was extracted via JavaScript inspection of live DOM on 2026-05-04 by a background research agent. The parent session has not independently re-verified every measurement — if a specific value is load-bearing for a decision, re-verify against the live site.

The MCR Pathways intranet has its own visual identity codified in `docs/design-system.md`. This playbook is upstream of that — it's about the principles to apply when extending the system, not about overriding it. Where the playbook conflicts with `docs/design-system.md`, the design system wins (it's the brand). Where the playbook fills gaps the design system doesn't address, follow the playbook.

---

## How distinctive products do typography

### Linear (linear.app)

Body and headings: `Inter Variable` with `SF Pro Display` fallback. H1 hero "The product development system for teams and agents" is **64px / weight 510 / line-height 64px / letter-spacing -1.408px**. The weight is unusual — 510 sits between Regular (400) and Medium (500), only available in variable fonts. Line-height equals font-size, which is brutally tight for a 64px display line. The site's body-text token sets letter-spacing `-0.011em` and the title-3 token sets `-0.012em` — Linear leans negative on letter-spacing across the whole scale, not just headings.

Background `rgb(8, 9, 10)`. Text `rgb(247, 248, 248)`. Tertiary text `#8a8f98`. Easing tokens like `--ease-in-out-quart: cubic-bezier(0.77, 0, 0.175, 1)` and `--ease-in-out-circ: cubic-bezier(0.785, 0.135, ...)` are exposed as CSS variables — the site treats motion timing as a first-class design token, not a per-component decision.

**Takeaway:** variable fonts unlock weights between the round numbers. 510 reads as "almost medium but more like a magazine deck". The tight line-height on display type is the signature.

### Vercel (vercel.com/home)

Body and headings: `Geist` (Vercel's own typeface). H1 "Build and deploy on the AI Cloud." is **48px / weight 600 / line-height 48px / letter-spacing -2.4px**. Section labels like "Framework-Defined Infrastructure" are **14px / weight 500 / letter-spacing -0.28px**. The system uses dramatic scale jumps: 48px hero, 24px section title, 14px label — no mid-range filler sizes.

Body bg `rgb(0, 0, 0)` (pure black). Text `rgb(237, 237, 237)` (off-white, never `#fff`). Custom property scale: `--ds-blue-600: oklch(64.94% .1982 251.813)` — Vercel uses OKLCH for colour, not hex, which means perceptually uniform brightness across the palette.

**Takeaway:** commission your own typeface if you can; otherwise pick one hardly anyone uses. Pure black backgrounds work if your text is true off-white. `#fff` on `#000` is a slop tell because nobody good actually does it.

### Stripe Sessions (stripesessions.com)

Body and headings: `sohne-var` (Söhne Variable by Klim Type Foundry). H1 "The internet economy conference" is **89.5px / weight 250 / line-height 76.075px / letter-spacing -2.685px**. Weight 250 is so thin it's practically a line drawing. Line-height 76px on a 89.5px font — line-height is **shorter** than font size, an aggressively typographic move that only works at very large sizes.

Body bg `rgb(249, 247, 247)` (warm off-white). Body color `rgb(32, 3, 60)` — a deep desaturated purple-black. Stripe never uses true black for text; the slight purple tint reads as "considered" rather than "default browser".

**Takeaway:** at 80px+, line-height under 1.0 is a typography flex. Body colour that isn't `#000` is the most underrated polish move on the web.

### Resend (resend.com/home)

H1 hero "Email for developers" is **96px / weight 400 / `domaine` / letter-spacing -0.96px**. `domaine` is Domaine Display by Klim — a high-contrast modern serif. Section H2s like "First-class developer experience" use **56px / weight 400 / `aBCFavorit` / letter-spacing -2.8px**. `aBCFavorit` is Favorit by Dinamo Foundry — a geometric sans with a quirky lowercase 'a'.

Two-typeface pairing: editorial serif for the brand-defining hero, geometric sans for everything else. The serif appears only in the hero, which makes it earn its keep. Pure black bg `rgb(0, 0, 0)`. Single signature accent: `color(display-p3 0.376 0.996 0.655 / 0.114)` — a wide-gamut mint green at 11% opacity. Wide-gamut P3 is rare on the web — most sites still use sRGB and lose the saturation that P3 displays can render.

**Takeaway:** if you pair two typefaces, give them opposite personalities (serif + geometric sans). If you have one accent, use it sparingly and pick a colour few others use.

### Mux (mux.com)

H1 "VIDEO FOR DEVELOPERS" is **66px / weight 400 / `Rotonto` / line-height 75.9px / letter-spacing 1.32px**. `Rotonto` is custom. Note the **positive** letter-spacing — opposite of Linear, Stripe, Vercel — because the hero is set in **uppercase**, where letters need breathing room. Bold H2s use `Aeonik` (geometric sans by Cofounders) at 50px / weight 700.

Two-typeface pairing again, with different roles: `Rotonto` for personality moments (hero, "Mux Robots" section title), `Aeonik` for the workhorse. Accent palette has `rgb(255, 178, 0)` warm yellow appearing 22 times — the dominant accent — plus sage `rgb(226, 228, 221)` and dark `rgb(36, 38, 40)` (charcoal, not black).

**Takeaway:** uppercase hero + positive letter-spacing is the brutalist alternative to the lowercase-tight convention. If you uppercase, you must add letter-spacing or it reads as shouting.

### Apple iPhone 17 Pro (apple.com/uk/iphone-17-pro/)

Section headers like "Unibody enclosure. Makes a strong case for itself." are **80px / weight 600 / SF Pro Display / letter-spacing -1.2px** — and they're inside `<p>` tags, not `<h2>`. Apple uses `<h1>` only once per page (for the product name "iPhone 17 Pro"), then drops to `<p>` for everything else. Semantically minimal, visually maximal.

Body bg `rgb(0, 0, 0)`. 133 sticky/pinned elements on the page — the entire experience is scroll-driven. No GSAP, no ScrollMagic — Apple rolls its own scroll choreography on `position: sticky` and `IntersectionObserver` primitives.

**Takeaway:** semantic HTML and visual hierarchy are not the same thing. Apple reserves `<h1>` for brand/product name and lets large styled `<p>` tags carry the storytelling. Their scroll work is custom because off-the-shelf libraries don't survive their performance budget.

### Figma (figma.com)

H1 "Make anything possible, all in Figma" is **64px / weight 400 / `figmaSans` / letter-spacing -0.64px**. Note: weight **400**, not bold. Most sites would use 700+ here. Figma uses the typeface's regular weight at very large size — confidence move, like a fashion ad. Demo CTA reads "Make my cursor reveal an image" — a direct invitation to interact, copy as the affordance.

**Takeaway:** the more bold weight you use, the less impact each instance has. A 64px regular-weight headline reads more elevated than a 64px bold one, especially in a custom typeface where the regular cut is what the designer drew first.

### Notion Calendar (notion.com/product/calendar)

H1 "It's time." — three syllables. **64px / weight 700 / `NotionInter` / letter-spacing -2.125px**. The whole hero is two words and a punctuation mark. The product name doesn't even appear above the fold.

**Takeaway:** restraint as a flex. If your product name has to appear in the hero copy, you might be hedging. The most distinctive heros are confident enough to leave the brand to the logo.

### Things 3 (culturedcode.com/things/)

Body font: `ui-sans-serif` (system font — San Francisco on Mac). Body bg `rgb(242, 245, 247)` — pale blue-grey. Body text `rgb(48, 51, 54)` — soft charcoal, never `#000`. Section H3s only 36px / weight 700.

**Takeaway:** for a Mac-native product, the system font is the right call — it makes the website feel continuous with the OS. Restraint pays off when your product is itself about restraint.

### Rauno Freiberg (rauno.me)

Body font is literally named **"X"** in the CSS (`font-family: X, ...`). H1 only 32px / weight 500. Background `rgb(237, 237, 237)` — the same value Vercel uses for body text, likely a deliberate family-tie since Rauno works at Vercel. Custom cursor present. Wide-gamut P3 orange `color(display-p3 0.99 0.4 0.02)` accent. Yellow `rgb(255, 255, 2)` appears as a highlight colour — true CMYK yellow, not a softened tone.

**Takeaway:** for a personal site, modesty in size + extreme commitment to typography (custom font called "X") + one weird colour choice = signature. The site doesn't try to look like a SaaS landing — it looks like an artefact.

### PostHog (posthog.com)

Body font: `IBM Plex Sans Variable`. Body bg `rgb(238, 239, 233)` — sage green, distinctive paper colour. Background images include `carpet_light` and `keyboard_garden_bg_light` — actual raster textures, not gradients. Accent palette: bright orange `rgb(245, 78, 0)`, ochre `rgb(235, 157, 42)`, red `rgb(243, 84, 84)`, leaf green `rgb(106, 168, 79)` — playful kid's-book palette. Image filenames reference `hogzilla` (the giant hedgehog mascot).

**Takeaway:** PostHog is the maximalist counter-example. Five accent colours work because the illustration system carries them, not the UI chrome. Real raster textures (carpet, garden) instead of CSS gradients. If your brand has personality of its own, lean in — don't sand it down to look like Stripe.

---

## How AI-generated UI gives itself away

### Material Kit (demos.creative-tim.com/material-kit)

Body font: `Inter, Helvetica, Arial, sans-serif`. Body bg `rgb(229, 229, 229)`. The same `linear-gradient(195deg, rgb(236, 64, 122), rgb(216, 27, 96))` magenta-to-pink gradient appears six times on the homepage — every CTA, every card, every section header. This is the canonical AI-bland gradient: 195deg angle, hot pink to magenta, applied to anything that needs "emphasis".

### Bootstrap (getbootstrap.com)

Body font: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Liberation Sans", Arial, sans-serif`. The 11-deep system font stack is itself a slop tell — distinctive sites pick a specific typeface and commit. Default Bootstrap blue `rgb(13, 110, 253)` and purple `rgb(113, 44, 249)` appear together. These exact RGB values are recognisable on sight as "this team didn't pick colours, they accepted defaults".

### Composite portrait of AI-generated UI

If a generated landing page has all of the following, it's slop:

1. **Inter or Roboto** (or unspecified `system-ui` stack) for everything, no custom typeface.
2. **Pure white `#fff`** body background with **pure black `#000`** text — no warmth, no off-white, no consideration.
3. **Purple-to-pink linear gradient at ~195deg** on hero CTA buttons, repeated identically across cards and headers.
4. **Hero + 3-up feature cards + testimonial carousel + pricing + CTA banner + footer** layout, in that exact order.
5. **Letter-spacing 0** (browser default) on all headings, even at 60px+ sizes.
6. **Border-radius 8px** on every element, regardless of size.
7. **Glassmorphism panels** (`backdrop-filter: blur` over a soft gradient) used as backgrounds for "modern" feel.
8. **Stock photography** of diverse-but-generic people pointing at laptops.

None of these are individually wrong. The combination is the signal. Every distinctive site breaks at least three of these rules.

---

## 1. Typography rules

### Pairings

- One typeface is fine. Linear, Vercel, Notion Calendar, Things, Apple, Figma all use a single typeface. If you can pick a distinctive one, you don't need a second.
- If you pair two, make them opposite personalities. Resend pairs `Domaine` (high-contrast serif) with `aBCFavorit` (geometric sans). Mux pairs `Rotonto` (display) with `Aeonik` (geometric sans). Don't pair two sans-serifs that look similar.
- The pairing has roles. Resend's serif appears only in the hero. Mux's display font appears only on personality moments. Don't sprinkle both fonts everywhere — assign each one a job.
- Avoid Inter, Roboto, Open Sans, system-ui as the default. These are the AI-bland defaults. If you must use one, customise it: `figmaSans` is Inter with custom OpenType features; `NotionInter` is Inter with brand-specific tweaks. Off-the-shelf Inter is a tell.

### Scale

- Skip the middle. Vercel goes 48px hero → 24px section title → 14px label. No 18px, no 20px, no 32px. Dramatic jumps create hierarchy; gentle ones create soup. Apple goes 80px → 21px body. Stripe goes 89.5px → 28px sub-head.
- At 60px+, line-height ≤ 1.0 is a flex. Stripe's hero is 89.5px / 76px lh (line-height 0.85). Linear's hero is 64px / 64px lh (1.0). At display sizes the visual gap between lines feels right tighter than the OpenType default.
- At body sizes, 1.5–1.6 line-height is the safe zone. Don't tighten body text the way you tighten display.

### Weights

- Variable fonts unlock the in-between. Linear uses weight 510 on the hero. Most non-variable fonts only ship at 400 / 500 / 700.
- Regular weight at huge size is more confident than bold. Figma's 64px H1 is weight 400. Resend's 96px H1 is weight 400. Confidence reads as restraint.
- Reserve heavy weights for personality moments. If everything is bold, nothing is.

### Letter-spacing

- Negative on lowercase display type. -0.02em to -0.05em on anything 40px+. Stripe goes -2.685px on 89.5px (about -0.030em). Linear goes -1.408px on 64px (about -0.022em). Vercel goes -2.4px on 48px (about -0.050em — the most aggressive).
- Positive on uppercase display type. Mux's uppercase hero uses +1.32px. Letters need air when capitalised; "VI" in "VIDEO" reads cramped at 0.
- Slightly negative on body text. Linear sets `-0.011em` on body. The OpenType defaults were tuned for print at 10–12pt; on screen at 15–16px, a hint of negative tightens the rag.

### When mono is right

Code blocks, kbd shortcuts, version numbers, file paths. Never for body copy "to look technical" — it just reads as Geocities. If your product is genuinely about code (Vercel, Linear), you can extend mono to small UI labels. If your product isn't, don't.

### When serif is right

Editorial moments. The hero of a marketing page where you want the brand to feel considered (Resend uses `Domaine` once on the homepage). Long-form content. Quotes and pull-outs. Never for UI labels or buttons — serif at 12px is unreadable.

### When handwriting / display fonts are right

Almost never in product UI. Acceptable in marketing for personality moments (logo, one-off section title, a single illustrated quote). If you find yourself adding a handwriting font to a button, you've broken something earlier in the design.

---

## 2. Colour rules

### Backgrounds

- Pure white is a tell. Stripe uses `rgb(249, 247, 247)` (warm off-white). Things uses `rgb(242, 245, 247)` (cool pale blue-grey). Arc uses `rgb(255, 252, 236)` (warm cream). PostHog uses `rgb(238, 239, 233)` (sage). MCR's intranet uses `#F2F4F7` — already in the right neighbourhood.
- Pure black is a flex but specific. Vercel, Resend, Apple all use `rgb(0, 0, 0)` body backgrounds, but they pair it with off-white text (Vercel `rgb(237, 237, 237)`, never `#fff`).
- Warm vs cool. Stripe and Arc are warm. Things and PostHog are cool. Choose to reflect tone — warm reads human, cool reads precise. MCR's design system is cool. Stay in the cool family unless the brand pivots.

### Text colour

- Never `#000` on `#fff` for body. Stripe uses `rgb(32, 3, 60)` (deep purple-black). Things uses `rgb(48, 51, 54)` (soft charcoal). Linear uses `rgb(247, 248, 248)` on dark backgrounds, never `#fff`. The slight desaturation reads as considered.
- Tertiary text needs its own value. Linear's `--color-text-tertiary: #8a8f98`. MCR's `--muted-foreground: #6b7280` is in this neighbourhood — don't override per-component.

### Accent strategy

- One accent that earns its place beats five that compete. Resend has one (P3 mint). Linear's CSS exposes orange `#ff8849` and lavender `#6c76e0` as semantic colours. Vercel uses OKLCH blue `oklch(64.94% .1982 251.813)` as its only accent. PostHog is the exception — five accents — and it works because the illustration system carries them, not the UI chrome.
- Save accent for action. A button, a status indicator, a focus ring, a callout. If accent appears as decoration ("let's add a coloured stripe to the section"), you've spent the budget on nothing.
- Wide-gamut P3 colours feel different. Resend and Rauno both use `color(display-p3 ...)` for accents. On P3 displays (most modern Macs and iPhones), these render more vivid than any sRGB equivalent. The browser falls back to sRGB on older displays.
- AI-bland accents to avoid: Bootstrap blue `rgb(13, 110, 253)`, Bootstrap purple `rgb(113, 44, 249)`, Material Design indigo `rgb(63, 81, 181)`, the magenta-to-pink linear gradient `rgb(236, 64, 122) → rgb(216, 27, 96)`, the violet-to-fuchsia gradient `#7c3aed → #ec4899` (Tailwind's `from-violet-600 to-pink-500`). If you can name the framework just from the RGB, pick something else.

### Dark mode

- Don't invert. Linear's dark mode is `rgb(8, 9, 10)` background with `rgb(247, 248, 248)` text — both desaturated, both intentional. A naive inversion of light-mode tokens produces flat, lifeless dark mode.
- Tertiary text needs to brighten in dark mode. Light-mode `#6b7280` becomes too dim on dark backgrounds. Linear's tertiary `#8a8f98` works in dark mode because they tuned it for the dark surface.

### When MORE colour is the right call

- Editorial/illustration-led products (PostHog) where the colour palette is the personality.
- Status systems where colour conveys meaning (red error, amber warning, green success). Be conservative — three meaningful colours, not seven.
- Data visualisation. MCR's intranet charts can use the brand palette as a categorical scheme.

### When restraint wins

- Workflow tools (Linear, Things, Notion Calendar). The user is in the product all day; visual noise becomes friction.
- Documentation and dashboards. Colour competes with content; reserve it for state and action.

---

## 3. Layout rules

### Asymmetry and grid breaking

- Linear's homepage is asymmetrical, flowing, not gridded. Content blocks vary in width, no consistent column count. The grid exists; designed elements break it intentionally.
- A 12-column grid is a starting point, not a constraint. Stripe's marketing pages routinely have elements that span 7 of 12 columns offset by 2 — the offset is the design.
- Centre alignment is a slop tell. "Centre everything" is what a layout looks like when nobody's making decisions. Apple's iPhone pages are mostly left-aligned at large breakpoints, with carefully chosen centred moments.

### Density vs whitespace

- Linear and Notion Calendar lean whitespace. Big white spaces, sparse content per fold. Reads as confident.
- Mux and PostHog lean density. Lots of facts per fold (customer logos with metrics, stat readouts). Reads as substantive.
- Pick one; consistency reads as design. Mixing dense and sparse sections without intent reads as "we ran out of content for that fold".
- MCR's intranet is a workflow tool. Lean whitespace for primary surfaces (dashboard, profile), lean density for tabular data — the standardised table pattern in `src/lib/CLAUDE.md` gets density right.

### Scroll choreography

- Apple does scroll-driven storytelling at scale. 133 pinned/sticky elements on iPhone 17 Pro, custom-built (no GSAP). Each section "stages" before transitioning. This is hand-built per page, not a reusable component.
- Most products don't need scroll choreography. A workflow tool doesn't have a "story". Save scroll-driven layout for marketing pages.
- `position: sticky` + `IntersectionObserver` are the load-bearing primitives. No library is needed for 90% of cases.

### Card and component composition

- Avoid the "3-up card grid" by default. It's the AI-bland fallback. If you have three things to show, ask whether they're equal in importance — usually they're not, and an asymmetric layout (one large + two small) reads better.
- Cards should have a reason to be cards. Drop-shadow + rounded corners is not a reason. A card boundary should mean "this is one thing, separate from the next thing".
- Use the standardised card classes in `src/lib/CLAUDE.md` — `bg-card rounded-xl border border-border shadow-sm overflow-clip` is the agreed pattern.

### Alignment

- Optical alignment beats mathematical alignment. A 14px label next to a 32px heading should sit at the typographic baseline of the cap-height, not the bottom of the bounding box.
- Numerals belong in tabular figures. Use `font-variant-numeric: tabular-nums` on any column of numbers. Without it, "1,234" and "5,678" don't line up.

---

## 4. Motion rules

### Where motion belongs

- State transitions. Open, close, expand, collapse, focus.
- Affordance signalling. Hover lift on a clickable card. Cursor change on a draggable element.
- Loading and progress. Spinners, skeleton screens, optimistic UI.
- Personality moments. One signature animation per product. Make it count, then leave the rest static.

### Where motion does NOT belong

- Scroll-triggered fade-ins on every section. Modern AI-generated landing pages do this universally. It's the equivalent of opening every paragraph with "Additionally". One scroll-triggered moment per page is plenty; ten is noise.
- Hero text typing animations. The user has to wait for the system to finish typing before they can read. Their eye moves faster than the cursor.
- Auto-rotating carousels. Almost no user wants the carousel to advance on a timer.
- Decoration animations. Floating shapes, drifting gradients, pulsing dots. They steal attention from actual content.

### Easing language

- Linear exposes easing as design tokens. `--ease-in-out-quart: cubic-bezier(0.77, 0, 0.175, 1)` and `--ease-in-out-circ: cubic-bezier(0.785, 0.135, 0.15, 0.86)`. The site has a vocabulary of motion timings and uses them consistently.
- Avoid `ease-in-out` for state transitions. The default browser easing is symmetric and slow at both ends. Use `ease-out` for "thing arrives" (fast in, soft landing) and `ease-in` for "thing leaves" (soft start, fast exit).
- Durations: 150ms for micro (hover, focus), 250ms for state (open/close), 400ms+ for narrative (page transitions). Anything over 600ms feels slow.

### `prefers-reduced-motion`

- Respect it. Wrap any non-essential motion in `@media (prefers-reduced-motion: no-preference) { ... }`.
- Essential motion (loading spinners, progress bars) can remain. Decorative motion (parallax, fade-ins, hover lifts) must respect the preference.
- Audit any motion that survives `prefers-reduced-motion: reduce` — if the user opted out and the page still moves, you've added something they explicitly rejected.

### Performance budget

- Animate `transform` and `opacity` only. These are GPU-composited; everything else triggers layout reflow.
- `will-change` is a tool, not a habit. Apply it just before the animation starts and remove it after.
- No animation library for 90% of cases. Plain CSS transitions and CSS animations cover hover, focus, open/close. Reach for Framer Motion / Motion only when you need physics-based spring or layout animation.

---

## 5. Signature-component thinking

Every distinctive product has one or two recognisable components — the thing you'd recognise blindfolded:

- Linear's command palette (Cmd+K) — keyboard-first product feels keyboard-first because the most-used surface IS keyboard-driven.
- Vercel's deployment activity stream — real-time logs with monospace timestamps.
- Stripe's animated globe on the marketing page — pulses showing payment activity.
- Apple's product photography at 80% viewport height — the product is the design.
- Arc's coloured workspace pills in the sidebar — workspaces have colour identity, not just names.
- Figma's collaborative cursors with names attached — multiplayer made visual.
- Notion Calendar's day-density indicator — small dots showing event density per day in the side rail.
- PostHog's hedgehog mascot appearing on edges of the page — character without a 3D character.

The signature is rarely the hero. It's a smaller, recurring element that appears in every screenshot and demo. A user who has used the product for a week can describe it without prompting.

The principle: identify the one component in your product that users see every day, and design it with twice the care of any other component. For a workflow tool, that's likely the navigation pattern, the primary action surface, or the most-viewed list view. For the MCR intranet specifically: identify the screen most-viewed across all user types (probably the news feed), then identify the one component on that screen that distinguishes the experience from a generic Notion page or Atlassian dashboard. That component needs the most design attention. Today's candidates are the news-feed posts, the standardised data tables, and the sidebar nav — pick one and make it sing rather than spreading polish thinly.

---

## 6. Five anti-patterns that read as AI-generated

1. **Inter on white with `#000` text and a 6px border-radius on every element.** Inter is fine in isolation. Inter + pure white + pure black + uniform border-radius is the visual signature of "I asked an AI to make me a SaaS". Replace at least two of the four. Verified: Material Kit, Bootstrap.
2. **Purple-to-pink linear gradient at ~195deg as the only accent.** Verified on Material Kit: `linear-gradient(195deg, rgb(236, 64, 122), rgb(216, 27, 96))` repeated six times on the homepage. If your hero CTA, your card backgrounds, AND your section headers all share the same gradient, the gradient has stopped meaning "important" — it's just decoration. Pick a single solid accent (Resend, Vercel) or use illustrated colour (PostHog).
3. **Hero + 3-up cards + testimonial + pricing + footer** as the page layout, in that order. This is the v0/Lovable/Cursor-generated landing page. Distinguishing sites either invert it (Linear leads with a product video, then drops to features), break it asymmetrically (Stripe interleaves narrative sections with product screenshots), or reject it entirely (Rauno's personal site is essentially a single wall of links).
4. **Glassmorphism (backdrop-blur over a soft gradient) used as the default panel background.** Apple killed this trend in 2014 by abandoning it themselves; AI tools resurrected it in 2024. None of the verified distinctive sites use glassmorphism for content panels. If you need elevation, use a real shadow on a solid surface.
5. **Letter-spacing 0 on all headings.** The browser default. Distinctive sites set negative letter-spacing on lowercase display type (Linear -1.408px, Stripe -2.685px, Vercel -2.4px, Notion Calendar -2.125px) and positive on uppercase display type (Mux +1.32px). Letter-spacing 0 on a 64px heading reads as "I haven't thought about typography" — and an LLM that hasn't been told to set it explicitly will leave it at 0 every time.

---

## Verification provenance

Verified by background research agent via direct DOM inspection on 2026-05-04:
linear.app, vercel.com/home, stripesessions.com, arc.net, posthog.com, resend.com/home, mux.com, apple.com/uk/iphone-17-pro/, figma.com, rauno.me, culturedcode.com/things/, notion.com/product/calendar, ui.shadcn.com, demos.creative-tim.com/material-kit, getbootstrap.com.

Unverified, prior knowledge from training data (re-verify before relying):
- Stripe's main marketing site (stripe.com/payments etc.) — blocked from inspection during the research session. Prior knowledge says it uses `sohne-var` consistently with Stripe Sessions.
- Cron — acquired by Notion in 2022 and folded into Notion Calendar. Original product no longer accessible.
- Arc browser application chrome — only the marketing site (arc.net) was inspected, not the in-app interface.
- PostHog hedgehog mascot — referenced in image filenames (`hogzilla`) on the live site but not screenshot-inspected.
- Bear, Craft (mac apps) — not inspected this session. Both are well-documented for serif body text + minimal chrome.

---

## When to read this document

- Before creating a new top-level surface (page, dashboard, marketing page).
- When asked to "redesign", "polish", "modernise", or "make more distinctive".
- Before adding a hero, a landing page, or any high-visibility surface.
- Before picking colours, fonts, or accent strategies that go beyond the existing design system.
- Before adding motion or animation (especially scroll-triggered or hero-reveal).
- Before using a CSS pattern that "looks modern" — glassmorphism, soft gradients, frosted-glass cards.
- Before reaching for Inter, Roboto, Open Sans, or system-ui as the default.
- Before reaching for a purple-to-pink gradient, a violet-to-fuchsia gradient, or any gradient that's "for emphasis".
- Before designing a card grid with three identical columns.
- Before setting letter-spacing to 0 on a 40px+ heading.
- When the user uses words like "bland", "generic", "AI", "soulless", "feels like a template", "needs personality" — re-read the whole document, not just the relevant section.

If you find yourself reaching for the AI-bland default, stop and ask: which of the verified distinctive sites would handle this differently, and what would they do? Then do that.
