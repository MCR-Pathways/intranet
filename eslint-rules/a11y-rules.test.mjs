/**
 * RuleTester coverage for mcr-a11y/no-truncate-without-title.
 *
 * The handover lesson for custom AST rules is "prove it FIRES against a
 * known-bad probe before trusting a clean run" — a registered-but-broken rule
 * passes silently. This pins both the match surface (truncate / line-clamp-N /
 * arbitrary line-clamp-[…]) and what counts as a satisfying title (a real
 * value, not `""` / `{null}` / a bare boolean). Runs under vitest because
 * RuleTester uses the global `describe`/`it` that vitest provides.
 */

import { RuleTester } from "eslint";
import { noTruncateWithoutTitle } from "./a11y-rules.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

ruleTester.run("no-truncate-without-title", noTruncateWithoutTitle, {
  valid: [
    // No clipping class → nothing to flag.
    '<p className="text-sm font-medium">{name}</p>',
    // A real title (or accessible name) satisfies the rule.
    '<p className="truncate" title={name}>{name}</p>',
    '<p className="line-clamp-2" title="Full text">{name}</p>',
    '<span className="truncate" aria-label={label}>{label}</span>',
    '<span className="truncate" aria-labelledby={id}>{x}</span>',
    // Arbitrary line-clamp WITH a title is fine.
    '<p className="line-clamp-[3]" title={t}>{t}</p>',
    // line-clamp-none removes clipping, so no title is needed.
    '<p className="line-clamp-none">{t}</p>',
    // An arbitrary-variant clamp targets a child span, not this element.
    '<span className="[&>span]:line-clamp-1">{x}</span>',
    // Dynamic title expressions count — the rule can't prove them empty.
    '<p className="truncate" title={fullText || "untitled"}>{x}</p>',
  ],
  invalid: [
    // Bare truncate / numeric line-clamp, no title.
    {
      code: '<p className="truncate">{name}</p>',
      errors: [{ messageId: "needsTitle" }],
    },
    {
      code: '<p className="line-clamp-2">{name}</p>',
      errors: [{ messageId: "needsTitle" }],
    },
    // Arbitrary line-clamp is now flagged too (fix 1).
    {
      code: '<p className="line-clamp-[3]">{name}</p>',
      errors: [{ messageId: "needsTitle" }],
    },
    {
      code: '<p className="line-clamp-[var(--max-lines)]">{name}</p>',
      errors: [{ messageId: "needsTitle" }],
    },
    // Empty / boolean / null / undefined titles don't satisfy the rule (fix 2).
    {
      code: '<p className="truncate" title="">{name}</p>',
      errors: [{ messageId: "needsTitle" }],
    },
    {
      code: '<p className="truncate" title="   ">{name}</p>',
      errors: [{ messageId: "needsTitle" }],
    },
    {
      code: '<p className="truncate" title>{name}</p>',
      errors: [{ messageId: "needsTitle" }],
    },
    {
      code: '<p className="truncate" title={null}>{name}</p>',
      errors: [{ messageId: "needsTitle" }],
    },
    {
      code: '<p className="truncate" title={undefined}>{name}</p>',
      errors: [{ messageId: "needsTitle" }],
    },
    // A cn()-built className still resolves to a truncate token.
    {
      code: '<p className={cn("text-sm", "truncate")}>{name}</p>',
      errors: [{ messageId: "needsTitle" }],
    },
  ],
});
