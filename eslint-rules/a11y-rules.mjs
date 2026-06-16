/**
 * Accessibility ESLint rules (plugin namespace: `mcr-a11y`).
 *
 * RULE: no-truncate-without-title
 *   CSS truncation (`truncate`, `line-clamp-N`) clips text visually but leaves
 *   it in the DOM — screen readers still read it, but SIGHTED users see "…"
 *   with no way to read the full string. The fix is a `title` (hover tooltip)
 *   carrying the full text. AST-based, so it catches multi-line JSX a grep
 *   misses (the lesson from PR #347).
 *
 *   Flags an element whose className contains `truncate`, `line-clamp-{n}`,
 *   or an arbitrary `line-clamp-[…]`, and carries no usable `title` (or
 *   `aria-label`/`aria-labelledby`). Empty, `{null}`/`{undefined}`, and bare
 *   boolean values don't count: they give no tooltip. Not autofixable, since
 *   the title is the runtime text the rule can't synthesise. Severity `warn`
 *   while existing sites are swept, then `error`.
 *   See `.claude/rules/ui-components.md`.
 */

import {
  getClassNameAttr,
  extractStringsFromValue,
} from "./no-custom-button-sizing.mjs";

const TRUNCATE_TOKEN_RE = /^(truncate|line-clamp-(?:\d+|\[.+\]))$/;

function findTruncateClass(str) {
  for (const cls of str.split(/\s+/)) {
    if (cls && TRUNCATE_TOKEN_RE.test(cls)) return cls;
  }
  return null;
}

// A string literal counts only when it's non-empty after trimming. Direct JSX
// attribute literals are always strings; the typeof guard also handles numeric
// literals that appear inside an expression container (e.g. `title={42}`).
function isNonEmptyLiteral(node) {
  if (!node || node.type !== "Literal") return false;
  return typeof node.value === "string"
    ? node.value.trim().length > 0
    : node.value != null;
}

// True only when the attribute carries a value that could actually name the
// element. Boolean shorthand (`<div title>`), empty/whitespace strings, and
// `{null}`/`{undefined}`/`{}` give no tooltip or accessible name, so they don't
// satisfy the rule. Any other expression (`title={fullText}`, a template, a
// ternary) counts — the rule can't prove it empty at lint time and shouldn't
// guess.
function hasMeaningfulValue(value) {
  if (value == null) return false; // boolean shorthand: <div title>
  if (value.type === "Literal") return isNonEmptyLiteral(value); // title="" / "x"
  if (value.type === "JSXExpressionContainer") {
    const expr = value.expression;
    if (!expr || expr.type === "JSXEmptyExpression") return false; // title={}
    if (expr.type === "Literal") return isNonEmptyLiteral(expr); // {""} {null} {42}
    if (expr.type === "Identifier" && expr.name === "undefined") return false;
    return true;
  }
  return true;
}

function hasAttr(openingElement, names) {
  return Boolean(
    openingElement.attributes?.some(
      (a) =>
        a.type === "JSXAttribute" &&
        names.includes(a.name?.name) &&
        hasMeaningfulValue(a.value),
    ),
  );
}

export const noTruncateWithoutTitle = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Truncated text (truncate / line-clamp-N) needs a title attribute so the full content is readable on hover.",
    },
    schema: [],
    messages: {
      needsTitle:
        "`{{ cls }}` clips text but there's no `title` — truncated content is unreadable on hover for sighted users. Add `title={fullText}` (or `aria-label`). See .claude/rules/ui-components.md.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const classNameAttr = getClassNameAttr(node);
        if (!classNameAttr) return;

        const strings = extractStringsFromValue(classNameAttr.value);
        let match = null;
        for (const s of strings) {
          match = findTruncateClass(s);
          if (match) break;
        }
        if (!match) return;

        // A title (hover tooltip) or an accessible name satisfies the rule.
        if (hasAttr(node, ["title", "aria-label", "aria-labelledby"])) return;

        context.report({
          node: classNameAttr,
          messageId: "needsTitle",
          data: { cls: match },
        });
      },
    };
  },
};
