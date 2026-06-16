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
 *   Flags an element whose className contains `truncate` or `line-clamp-{n}`
 *   and has no `title` (or `aria-label`/`aria-labelledby`) attribute. Not
 *   autofixable — the title value is the runtime text, which the rule can't
 *   synthesise. Severity `warn` while existing sites are swept, then `error`.
 *   See `.claude/rules/ui-components.md`.
 */

import {
  getClassNameAttr,
  extractStringsFromValue,
} from "./no-custom-button-sizing.mjs";

const TRUNCATE_TOKEN_RE = /^(truncate|line-clamp-\d+)$/;

function findTruncateClass(str) {
  for (const cls of str.split(/\s+/)) {
    if (cls && TRUNCATE_TOKEN_RE.test(cls)) return cls;
  }
  return null;
}

function hasAttr(openingElement, names) {
  return Boolean(
    openingElement.attributes?.some(
      (a) => a.type === "JSXAttribute" && names.includes(a.name?.name),
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
