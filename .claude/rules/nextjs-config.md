---
paths:
  - "next.config.ts"
  - "next.config.js"
  - "next.config.mjs"
---

# Next.js configuration patterns

**`serverActions.bodySizeLimit` goes inside `experimental` in Next.js 16.** Not a top-level config property. Linters will revert if placed at the top level. Correct: `experimental: { serverActions: { bodySizeLimit: "50mb" } }`.
