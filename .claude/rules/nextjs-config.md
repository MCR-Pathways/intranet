---
paths:
  - "next.config.ts"
  - "next.config.js"
  - "next.config.mjs"
---

# Next.js configuration patterns

**`serverActions.bodySizeLimit` goes inside `experimental` in Next.js 16.** Not a top-level config property. Linters will revert if placed at the top level. Correct: `experimental: { serverActions: { bodySizeLimit: "50mb" } }`.

**Strict CSP must include `'unsafe-eval'` in development only.** Production omits `unsafe-eval` (correct), but `next dev`'s React runtime needs `eval` for stack reconstruction; a CSP without it makes the dev bundle fail and the page reload in a nonstop loop. Gate it on the environment so prod output stays byte-identical: `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`. A comment claiming "dev-only" isn't enough; the value must actually branch on `NODE_ENV`. Fixed in PR #372.

**Turbopack can panic on a deleted route still cached in `.next`.** Symptom: `FATAL: An unexpected Turbopack error ... Failed to write app endpoint /<route>/page ... Cell ... no longer exists ... directory_tree_to_loader_tree`, with the browser reload-looping; the route's files are gone but the stale `.next` cache still references them. Fix: stop the dev server, `rm -rf .next`, restart. Generalises the globals.css `.next`-clear note in `ui-components.md`.
